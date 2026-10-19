import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { json, url, uploadOne } from './api.js';
import Slideshow from './Slideshow.jsx';

const isVideo = (m) => m.mimeType?.startsWith('video/');

export default function Gallery({ onLogout }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [driveDown, setDriveDown] = useState(false);
  const [filter, setFilter] = useState('all'); // all | image | video
  const [show, setShow] = useState(null); // index into `visible`, or null
  const [up, setUp] = useState(null); // { n, total, pct, name }
  const fileRef = useRef(null);

  const load = useCallback(async () => {
    try {
      setItems(await json('/api/media'));
      setDriveDown(false);
    } catch (e) {
      if (e.code === 'DRIVE_AUTH_EXPIRED') setDriveDown(true);
      else if (e.status !== 401) setError(e.message || "Can't load media");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const visible = useMemo(
    () => items.filter((m) => filter === 'all' || (filter === 'video' ? isVideo(m) : !isVideo(m))),
    [items, filter],
  );

  const onPick = async (e) => {
    const files = [...e.target.files];
    e.target.value = '';
    if (!files.length) return;
    setError('');
    const failed = [];
    for (let n = 0; n < files.length; n++) {
      const f = files[n];
      setUp({ n: n + 1, total: files.length, pct: 0, name: f.name });
      try {
        await uploadOne(f, (p) => setUp((u) => u && { ...u, pct: p }));
      } catch (ex) {
        failed.push(`${f.name} (${ex.message})`);
        if (ex.code === 'DRIVE_AUTH_EXPIRED') { setDriveDown(true); break; }
        if (ex.status === 401) break;
      }
    }
    setUp(null);
    if (failed.length) setError(`Upload problem: ${failed.join('; ')}`);
    load();
  };

  const remove = async (m) => {
    try {
      await json(`/api/media/${m.id}`, { method: 'DELETE' });
      setItems((list) => list.filter((x) => x.id !== m.id));
    } catch (ex) {
      setError(`Could not delete: ${ex.message}`);
    }
  };

  const tabs = [['all', 'All'], ['image', 'Photos'], ['video', 'Videos']];

  return (
    <div className="app">
      <div className="top">
        <h1>Media Vault {items.length > 0 && <span className="muted">· {visible.length}</span>}</h1>
        <div className="row">
          <div className="row tabs">
            {tabs.map(([k, label]) => (
              <button key={k} className={`btn ${filter === k ? 'on' : ''}`} onClick={() => setFilter(k)}>{label}</button>
            ))}
          </div>
          <button className="btn primary" disabled={!visible.length} onClick={() => setShow(0)}>▶ Slideshow</button>
          <button className="btn" disabled={!!up} onClick={() => fileRef.current?.click()}>Upload</button>
          <input ref={fileRef} type="file" accept="image/*,video/*" multiple hidden onChange={onPick} />
          <button className="btn" onClick={onLogout}>Log out</button>
        </div>
      </div>

      {driveDown && (
        <div className="banner">
          Google Drive isn’t connected, or its access expired.{' '}
          <a href={url('/api/admin/drive/connect')}>Connect Google Drive</a>
        </div>
      )}
      {error && <div className="banner bad">{error}</div>}
      {up && (
        <div className="banner">
          Uploading {up.n} of {up.total}: {up.name} {up.pct >= 1 ? '(saving to Drive…)' : `${Math.round(up.pct * 100)}%`}
          <div className="progress"><i style={{ width: `${Math.round(up.pct * 100)}%` }} /></div>
        </div>
      )}

      {loading ? (
        <div className="empty muted">Loading…</div>
      ) : !visible.length ? (
        <div className="empty muted">
          {driveDown ? '' : items.length ? 'Nothing in this filter.' : 'No photos or videos yet. Use Upload to add some.'}
        </div>
      ) : (
        <div className="grid">
          {visible.map((m, idx) => (
            <button key={m.id} className="tile" title={m.name} onClick={() => setShow(idx)}>
              <img
                loading="lazy"
                alt={m.name}
                src={url(`/api/media/${m.id}/thumb`)}
                onError={(e) => {
                  const img = e.currentTarget;
                  if (isVideo(m) || img.dataset.fb) img.style.visibility = 'hidden';
                  else { img.dataset.fb = '1'; img.src = url(`/api/media/${m.id}`); } // no thumb endpoint: use full image
                }}
              />
              {isVideo(m) && <span className="cap">{m.name}</span>}
              {isVideo(m) && <span className="badge">▶</span>}
            </button>
          ))}
        </div>
      )}

      {show !== null && (
        <Slideshow
          items={visible}
          start={show}
          onClose={() => setShow(null)}
          onDelete={remove}
        />
      )}
    </div>
  );
}
