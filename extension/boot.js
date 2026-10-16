'use strict';
(() => {
  const fallbackUrl = 'https://www.nyqking.top/';
  let finished = false;
  const timer = setTimeout(fallback,8000);

  function cleanup() {
    clearTimeout(timer);
    window.removeEventListener('error',onError,true);
    window.removeEventListener('unhandledrejection',fallback);
    document.removeEventListener('DOMContentLoaded',checkReady);
  }
  function fallback() {
    if (finished) return;
    finished = true;
    cleanup();
    window.location.replace(fallbackUrl);
  }
  function onError(event) {
    const target = event.target;
    // A missing favicon must not replace an otherwise working local page.
    if (target === window || target instanceof HTMLScriptElement || (target instanceof HTMLLinkElement && target.rel === 'stylesheet')) fallback();
  }
  function checkReady() {
    const styles = [...document.querySelectorAll('link[rel="stylesheet"]')];
    if (!window.NAV_APP_READY || styles.length !== 2 || styles.some(link => !link.sheet)) return fallback();
    finished = true;
    cleanup();
  }
  window.addEventListener('error',onError,true);
  window.addEventListener('unhandledrejection',fallback);
  document.addEventListener('DOMContentLoaded',checkReady,{once:true});
})();
