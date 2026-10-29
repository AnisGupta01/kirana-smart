/* Cinematic shop: runs in <head> before the page paints.
   Marks JS as available (so scroll animations can hide text until
   it is revealed) and notes reduced-motion / autoplay mode. */
(function (d, w) {
  "use strict";
  var c = d.documentElement.classList;
  c.add("js");
  try {
    if (w.matchMedia && w.matchMedia("(prefers-reduced-motion: reduce)").matches) c.add("reduce");
  } catch (e) { /* ignore */ }
  if (/[?&]autoplay=1/.test(w.location.search)) c.add("autoplay");
  if (/[?&]reel=1/.test(w.location.search)) c.add("reel");
  try {
    var l = w.localStorage.getItem("ks-cinema-lang");
    if (l === "hi") { c.add("lang-hi"); d.documentElement.lang = "hi"; }
  } catch (e) { /* storage blocked */ }
})(document, window);
