const BASE = import.meta.env.VITE_API_URL ?? '';

export const url = (path) => `${BASE}${path}`;

// fetch with the login cookie; a 401 anywhere sends the user back to the login screen
export async function api(path, opts = {}) {
  const res = await fetch(url(path), { credentials: 'include', ...opts });
  if (res.status === 401) window.dispatchEvent(new Event('auth:expired'));
  return res;
}

// JSON helper; throws an Error with .status and .code (e.g. DRIVE_AUTH_EXPIRED)
export async function json(path, opts) {
  const res = await api(path, opts);
  if (!res.ok) {
    let body = {};
    try { body = await res.json(); } catch { /* not JSON */ }
    throw Object.assign(new Error(body.message || res.statusText || 'Request failed'), {
      status: res.status,
      code: body.code,
    });
  }
  return res.json();
}

// One file per request, so we get per-file progress and one bad file can't sink a batch
export function uploadOne(file, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url('/api/media/upload'));
    xhr.withCredentials = true;
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    xhr.onload = () => {
      if (xhr.status === 401) window.dispatchEvent(new Event('auth:expired'));
      if (xhr.status >= 200 && xhr.status < 300) return resolve();
      let body = {};
      try { body = JSON.parse(xhr.responseText); } catch { /* not JSON */ }
      reject(Object.assign(new Error(body.message || `Upload failed (${xhr.status})`), {
        status: xhr.status,
        code: body.code,
      }));
    };
    xhr.onerror = () => reject(new Error('Network error during upload'));
    const fd = new FormData();
    fd.append('files', file);
    xhr.send(fd);
  });
}
