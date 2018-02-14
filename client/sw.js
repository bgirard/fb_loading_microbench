// Mirrored in server.js
const EARLY_FLUSH_RESOURCES = 40;
const DONT_USE_SW_CACHE = true;

let now = Date.now();

(function() {
    var exLog = console.log;
    console.log = function(msg) {
        exLog.apply(this, arguments);
        console.timeStamp(msg);
    }
})()

console.log("Starting Service Worker");

function updateCache() {
  caches.open('v2').then(function(cache) {
    let resources = [];
    for (let i = 0; i < 100; i++) {
      resources.push("/script?scriptName=res" + i + ".js");
    }
    console.log("Download resources:", resources);
    return cache.addAll(resources);
  })
}

this.addEventListener('activate', function(event) {
  let str = 'activatingv6:' + Date.now();
  console.log(str);

  registration.navigationPreload.setHeaderValue(str);

  console.log("activated");

  event.waitUntil(async function() {
    // Feature-detect
    if (self.registration.navigationPreload) {
      // Enable navigation preloads!
      await self.registration.navigationPreload.enable();
      console.log("activated with preload");
    } else {
      console.log("activated without preload");
    }
  }());
});

// SW sends the list of scripts to start loading before we get a response
// from the server. When the server sends us this list we need to remove
// it to avoid executing these resources twice.
function removeScriptLoad(buffer) {
  console.log("remove script load");
  const textEncoder = new TextEncoder();
  const textDecoder = new TextDecoder();
  let str = textDecoder.decode(buffer);
  str = str.replace(/<!-- remove-if-sw -->.*?<!-- \/remove-if-sw -->/g, "<!-- removed by SW -->");
  return textEncoder.encode(str);
}

function pushStream(controller, stream) {
  // Get a lock on the stream
  var reader = stream.getReader();

  return reader.read().then(function process(result) {
    console.log("Result done: ", result.done);
    if (result.done) return;
    // Push the value to the combined stream
    controller.enqueue(removeScriptLoad(result.value));
    console.log("write data", result);
    // Read more & process
    return reader.read().then(process);
  });
}

function documentFetch(event) {
  const textEncoder = new TextEncoder();
  const ENCODE_OPTIONS = {stream: true};

  let dontUsePreload = false;
  let docFetch = null;
  if (!event.preloadResponse || dontUsePreload) {
    docFetch = fetch(event.request.url);
    console.log("Fetch start: " + Date.now());
  }

  var stream = new ReadableStream({
    start: async function start(controller) {
      console.log("SW Earlier Flush");
      let queue = '<p>SW Earlier Flush</p>\n';
      for (let i = 0; i < EARLY_FLUSH_RESOURCES; i++) {
        //queue += '<link rel="preload" href="script?scriptName=res' + i + '.js" as="script" crossorigin="anonymous" />';
        //queue += '<link rel="preload" href="script?scriptName=res' + i + '.js" as="script" />';
        //queue += '<script src="script?scriptName=res' + i + '.js" crossorigin="anonymous" async="1"></script>';
        //queue += '<script src="script?scriptName=res' + i + '.js" async="1"></script>\n';
      }
      for (let i = 0; i < EARLY_FLUSH_RESOURCES; i++) {
        queue += '<script src="script?scriptName=res' + i + '.js"></script>';
      }
      controller.enqueue(textEncoder.encode(queue, ENCODE_OPTIONS));
      if (event.preloadResponse && !dontUsePreload) {
        response = await event.preloadResponse;
        if (response) {
          console.log(response, stream);
          await pushStream(controller, response.body);
          controller.close();
        }
      } else {
        docFetch.then(async function(response) {
          console.log(response, stream);
          await pushStream(controller, response.body);
         controller.close();
        });
      }
    },

  });

  var response = new Response(stream, {
    headers: {'status': 200, 'content-type': 'text/html'}
  });
  event.respondWith(response);
}

function fetchDispatch(event) {
  console.log('Handling fetch event for ' + event.request.url, event);

  if (event.request.mode === 'navigate') {
    console.log('Special navigate handle');
    return documentFetch(event);
  }

  if (DONT_USE_SW_CACHE) {
    return fetch(event.request).then(function(response) {
      return response;
    });
  }

  event.respondWith(
    caches.match(event.request).then(async function(response) {
      if (response) {
        console.log('Found response in cache:', response);

        return response;
      }

      console.log('No response found in cache. About to fetch from network...');

      return fetch(event.request).then(function(response) {
        console.log('Response from network is:', response);

        return response;
      }).catch(function(error) {
        console.error('Fetching failed:', error);

        throw error;
      });
    })
  );
}

function register_fetch() {
  this.addEventListener('fetch', fetchDispatch);
}
function unregister_fetch() {
  this.removeEventListener('fetch', fetchDispatch);
}

register_fetch();

updateCache();

