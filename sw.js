/* Bump CACHE after releasing changes. Same-origin shell only; no analytics. */
const CACHE_PREFIX='aspirecompass-math-'+self.registration.scope;
const CACHE=CACHE_PREFIX+'v1';
const ASSETS=['./','./index.html','./styles.css','./math-engine.js','./lessons.js','./app.js','./icon.svg','./icon-192.png','./icon-512.png','./manifest.webmanifest','./privacy.html'];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)));});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith(CACHE_PREFIX)&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',event=>{
 const url=new URL(event.request.url);if(event.request.method!=='GET'||url.origin!==self.location.origin||!url.pathname.startsWith(new URL('./',self.location).pathname))return;
 // One consistent shell per cache version. Refresh cache version on every release.
 event.respondWith(caches.match(event.request,{ignoreSearch:true}).then(hit=>hit||fetch(event.request)));
});
