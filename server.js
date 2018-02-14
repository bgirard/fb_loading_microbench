const express = require('express');
const app = express();

// Multiply all the delays to run in slow motion
const SLOW_MOTION_FACTOR = 1;
// Simulate a typical request. Add a 100ms RTT for users far from a server
// for their first response. Service worker should allow getting in early
// flushing this out early.
const EARLY_FLUSH_DELAY = 100 * SLOW_MOTION_FACTOR;
// Final flush is more intensive on the server and will require news feed
// ranking so this will come in much later.
const FINAL_FLUSH_DELAY = 500 * SLOW_MOTION_FACTOR;

// Mirrored in client/sw.js
const EARLY_FLUSH_RESOURCES = 40;

function earlyFlush(req, res) {
  res.set('Content-Type', 'text/html');
  let output = "";
  output += '<p>Early flush</p>';

  output += '<style>';
    output += '.resTiming{ display: inline-block; width: 100px; }';
  output += '</style>';

  // Links
  output += '<p>';
    output += `<a href='?'>Normal Load</a> `;
    output += `<a href='?sw_install=true'>Install SW Load</a> `;
    output += `<a href='?' onclick='navigator.serviceWorker.getRegistrations().then(function(registrations) { for(let registration of registrations) { registration.unregister() } })'>Un-install SW Load</a> `;
  output += '</p>\n';

  // Timing
  output += '<script>window.timing = window.timing || {}; window.timing[\'earlyFlush\'] = performance.now();</script>\n';

  // Service Worker Install
  output += '<p>Service Worker Status: <a id=sw_status>Checking...</a></p>';
  output += `
    <script>
      navigator.serviceWorker.getRegistrations().then(function(registrations) {
        window.hasSW = false;
        let sw_status = "<a style=\'color:red\'>not installed</a>";
        for(let registration of registrations) {
          sw_status = "<a style=\'color:green\'>" + registration.active.state + "</a>";
          window.hasSW = registration.active.state === 'activated';
        }
        document.getElementById("sw_status").innerHTML = sw_status;

      })
      </script>
  `;
  if (req.query.sw_install === 'true') {
    output += '<script src="sw_installer.js"></script>'
    output += '<p>Service Worker Install</p>';
  }

  // Early Flush Resources
  let resources = "";
  resources += '<div>';
  resources += `<div>Request resources at ${EARLY_FLUSH_DELAY} ms.</div>`;
  resources += `<a class=resTiming>Res Name</a> <a class=resTiming>Fetch Start</a> <a class=resTiming>Fetch End</a> <a class=resTiming>From</a> <a class=resTiming>Script Exec</a><br>`;
  for (let i = 0; i < EARLY_FLUSH_RESOURCES; i++) {
    resources += `<a class=resTiming>res${i}.js:</a> <a class=resTiming id=fetch_start_res${i}.js>Loading</a> <a class=resTiming id=fetch_end_res${i}.js>Loading</a> <a class=resTiming id=network_res${i}.js>Loading</a> <a class=resTiming id=exec_res${i}.js>Loading</a><br>\n`;
    resources += `<!-- remove-if-sw --><script src="script?scriptName=res${i}.js" async="1"></script><!-- /remove-if-sw -->\n`;
  }
  resources += '</div>';
  output += resources;
  res.write(output);
}

function finalFlush(req, res) {
  let output = "";
  output += '<p>Final flush</p>';
  output += '<script>console.log("Timings:", window.timing, performance.getEntriesByType("resource"));</script>';
  output += `
    <script>
      setTimeout(() => {
        performance.getEntriesByType("resource").forEach(r => {
          const re = r.name.match('.*scriptName=(.*)');
          if (!re) {
            return;
          }
          const resourceName = re[1];
          let fetchStart = Math.round(r.fetchStart);
          let fetchEnd = Math.round(r.responseEnd);
          document.getElementById('fetch_start_' + resourceName).innerHTML = fetchStart + " ms";
          document.getElementById('fetch_end_' + resourceName).innerHTML = fetchEnd + " ms";
          document.getElementById('exec_' + resourceName).innerHTML = Math.round(window.timing['script_' + resourceName]) + " ms";
          let from;
          // If the fetch is instant that its almost always from the in-memory cache.
          // This means the results are likely invalid because in the real world
          // the in-memory cache is almost always evicted even in back-to-back page
          // loads. However for microbenchmark pages its really effective.
          let color = "black";
          if (fetchStart == fetchEnd) {
            from = 'Memory Cache, Result not useful';
            color = "red";
          } else {
            if (r.transferSize > 0) {
              from = 'Server';
            } else {
              from = 'Cache'
            }
            if (window.hasSW) {
              from = 'SW ' + from;
            }
          }
          document.getElementById('network_' + resourceName).innerHTML = from;
          document.getElementById('network_' + resourceName).style.color = color;
        });
      }, 1000);
    </script>
  `;
  output += '<div id=navGraph></div>';
  output += '<script src=navGraph.js></script>';
  res.write(output);
}

app.use(express.static('client'))
app.get('/', function (req, res) {
  let isPreload = req.get('Service-Worker-Navigation-Preload');
  let str = "Got request: " + Date.now() + " preload: " + isPreload + " " + req.originalUrl;
  console.log(str);

  setTimeout(function() {
    earlyFlush(req, res);
    res.write(str);
    setTimeout(function() {
      finalFlush(req, res);
      res.end();
    }, FINAL_FLUSH_DELAY);
  }, EARLY_FLUSH_DELAY);
});

// Serve simple script resources that will time when they are executed.
// Generate a UUID to force a cache miss or reuse an ID to test loading
// from the SW/HTTP cache.
app.get('/script', function (req, res) {
  const scriptName = req.query.scriptName;
  console.log("Serve: ", scriptName);
  res.set('cache-control', 'max-age=315360000, public, immutable');
  res.set('ETag', 'FirefoxWorkAround');

  let output = "";
  output += `window.timing = window.timing || {};`;
  output += `console.log('exec ${scriptName} @ ' + performance.now());`;
  output += `if (!window.timing['script_${scriptName}']) { window.timing['script_${scriptName}'] = window.timing['script_${scriptName}'] || performance.now(); }`;
  // Make this file longer to add memcache pressure.
  let str = '/*';
  for (let i = 0; i < 4000 / EARLY_FLUSH_RESOURCES; i++) {
    str += "01234567890123456789012345678901234567890123456789012345678901234567890123456789\n";
  }
  str += '*/';
  output += str;
  res.write(output);
  res.end();
});

app.listen(3000, function () {
  console.log('Example app listening on port http://localhost:3000/!')
})
