(function () {
  "use strict";
  var root = document.documentElement;
  var queued = false;

  function availableHeight() {
    // Never derive web content height from screen/outerHeight: those include
    // native window borders, title bars and (on Windows) the taskbar.
    var height = window.innerHeight;
    if (root.clientHeight > 0) height = Math.min(height, root.clientHeight);
    var viewport = window.visualViewport;
    // A keyboard can reduce the visual viewport. Pinch zoom must not resize
    // the application's layout to the magnified rectangle.
    if (viewport && Math.abs(viewport.scale - 1) < 0.01 && viewport.height > 0) {
      height = Math.min(height, viewport.height);
    }
    return Math.max(1, height);
  }

  function update() {
    queued = false;
    var value = availableHeight() + "px";
    if (root.style.getPropertyValue("--app-viewport-height") !== value) {
      root.style.setProperty("--app-viewport-height", value);
    }
  }

  function schedule() {
    if (!queued) {
      queued = true;
      window.requestAnimationFrame(update);
    }
  }

  // Read-only diagnostics; no account details, tokens or business data.
  window.benniniViewportMetrics = function () {
    function rectangle(selector) {
      var element = document.querySelector(selector);
      return element ? element.getBoundingClientRect().toJSON() : null;
    }
    return {
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
      outerWidth: window.outerWidth,
      outerHeight: window.outerHeight,
      clientWidth: root.clientWidth,
      clientHeight: root.clientHeight,
      scrollWidth: root.scrollWidth,
      scrollHeight: root.scrollHeight,
      visualViewport: window.visualViewport ? {
        width: window.visualViewport.width,
        height: window.visualViewport.height,
        scale: window.visualViewport.scale,
        offsetTop: window.visualViewport.offsetTop
      } : null,
      root: rectangle("#root"),
      workspace: rectangle('[data-testid="workspace-shell"]'),
      sidebar: rectangle('[data-testid="workspace-sidebar"]'),
      account: rectangle('[data-testid="workspace-account"]'),
      fullscreen: Boolean(document.fullscreenElement)
    };
  };

  update();
  window.addEventListener("resize", schedule);
  window.addEventListener("orientationchange", schedule);
  window.addEventListener("pageshow", schedule);
  document.addEventListener("fullscreenchange", schedule);
  if (window.visualViewport) window.visualViewport.addEventListener("resize", schedule);
})();
