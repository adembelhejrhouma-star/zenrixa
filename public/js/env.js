(function loadPublicEnv() {
  if (typeof window === 'undefined' || window.__ZENRIXA_ENV__) return;
  try {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', '/api/config', false);
    xhr.setRequestHeader('Accept', 'application/json');
    xhr.send(null);
    if (xhr.status >= 200 && xhr.status < 300) {
      const data = JSON.parse(xhr.responseText || '{}');
      window.__ZENRIXA_ENV__ = data && typeof data === 'object' ? data : {};
      return;
    }
  } catch (_) {}
  window.__ZENRIXA_ENV__ = {};
  console.warn('[env] Unable to load public config from /api/config. Set NEXT_PUBLIC_* vars in .env.local (see .env.example).');
})();
