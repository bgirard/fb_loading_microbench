function addTiming(container, label, offsetX, deltaTime) {
  let tag = document.createElement('a');
  tag.innerText = label + "\n" + deltaTime + " ms";;
  tag.style.left = (5+offsetX) + 'px';
  tag.style.position = "absolute";
  container.appendChild(tag);
}

function renderNav(container) {
  var perfData = window.performance.timing;
  // Navigation Time Metrics
  // https://www.w3.org/TR/navigation-timing/#processing-model
  [
    {name: 'redirect', offsetX: 118, start: "navigationStart", end: "fetchStart"},
    {name: 'app_cache', offsetX: 279, start: "fetchStart", end: "domainLookupStart"},
    {name: 'dns', offsetX: 372, start: "domainLookupStart", end: "connectStart"},
    {name: 'tcp', offsetX: 454, start: "connectStart", end: "connectEnd"},
    {name: 'request', offsetX: 543, start: "connectEnd", end: "responseStart"},
    {name: 'respond', offsetX: 717, start: "responseStart", end: "responseEnd"},
    {name: 'dom_setup', offsetX: 906, start: "responseStart", end: "domLoading"},
    {name: 'interactive', offsetX: 978, start: "domLoading", end: "domInteractive"},
    {name: 'dom_content', offsetX: 1057, start: "domInteractive", end: "domContentLoadedEventEnd"},
    {name: 'dom_complete', offsetX: 1179, start: "domContentLoadedEventEnd", end: "domComplete"},
    {name: 'unload', offsetX: 0, start: "unloadStart", end: "unloadEnd"},
  ].forEach(({name, offsetX, start, end}) => {
    const from = performance.timing[start] || 0;
    const to = performance.timing[end] || 0;

    if (to >= from) {
      addTiming(container, name, offsetX, to - from);
    }
  });

  let img = document.createElement('img');
  img.src = 'timing-overview.png';
  img.style.paddingTop = '50px';
  container.appendChild(img);
}
setTimeout(function() {
  renderNav(document.getElementById('navGraph'));
}, 300);
