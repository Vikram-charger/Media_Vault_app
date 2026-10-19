import { useCallback, useEffect, useRef, useState } from 'react';
import { url } from './api.js';

const SPEEDS = [3, 5, 8, 12]; // seconds per photo

export default function Slideshow({ items, start = 0, onClose, onDelete }) {
  const [i, setI] = useState(start);
  const [playing, setPlaying] = useState(true);
  const [secs, setSecs] = useState(5);
  const [ui, setUi] = useState(true);
  const box = useRef(null);
  const touchX = useRef(null);
  const idle = useRef();

  const len = items.length;
  const idx = Math.max(0, Math.min(i, len - 1));
  const cur = items[idx];
  const video = !!cur?.mimeType?.startsWith('video/');

  const next = useCallback(() => setI((n) => (Math.min(n, len - 1) + 1) % len), [len]);
  const prev = useCallback(() => setI((n) => (Math.min(n, len - 1) - 1 + len) % len), [len]);

  const wake = useCallback(() => {
    setUi(true);
    clearTimeout(idle.current);
    idle.current = setTimeout(() => setUi(false), 3000);
  }, []);

  const toggleFs = () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else box.current?.requestFullscreen?.();
  };

  // nothing left (e.g. last item deleted)
  useEffect(() => { if (!len) onClose(); }, [len, onClose]);

  // auto-advance photos; videos advance when they end
  useEffect(() => {
    if (!playing || video || len < 2) return;
    const t = setTimeout(next, secs * 1000);
    return () => clearTimeout(t);
  }, [idx, playing, video, secs, len, next]);

  // preload the next photo
  useEffect(() => {
    if (len < 2) return;
    const n = items[(idx + 1) % len];
    if (n && !n.mimeType?.startsWith('video/')) new Image().src = url(`/api/media/${n.id}`);
  }, [idx, items, len]);

  // controls auto-hide
  useEffect(() => {
    wake();
    return () => clearTimeout(idle.current);
  }, [wake, idx]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'ArrowRight') next();
      else if (e.key === 'ArrowLeft') prev();
      else if (e.key === ' ' && e.target.tagName !== 'VIDEO') { e.preventDefault(); setPlaying((p) => !p); }
      else if (e.key === 'Escape') onClose();
      else if (e.key === 'f' || e.key === 'F') toggleFs();
      wake();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [next, prev, onClose, wake]);

  // lock page scroll behind the viewer
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prevOverflow; };
  }, []);

  if (!cur) return null;
  const src = url(`/api/media/${cur.id}`);

  const onTouchEnd = (e) => {
    const dx = e.changedTouches[0].clientX - (touchX.current ?? 0);
    if (Math.abs(dx) > 60) (dx < 0 ? next : prev)();
  };

  const del = () => {
    if (window.confirm(`Delete "${cur.name}" from Google Drive? This can't be undone.`)) onDelete(cur);
  };

  return (
    <div
      ref={box}
      className={`ss ${ui ? 'ui' : ''}`}
      onMouseMove={wake}
      onTouchStart={(e) => { touchX.current = e.touches[0].clientX; wake(); }}
      onTouchEnd={onTouchEnd}
    >
      <div className="stage">
        {video ? (
          <video key={cur.id} src={src} autoPlay playsInline controls onEnded={() => playing && next()} />
        ) : (
          <img key={cur.id} className="fade" src={src} alt={cur.name} draggable={false} />
        )}
      </div>

      <div className="bar t">
        <span className="name">{cur.name}</span>
        <span className="row">
          <span className="muted">{idx + 1} / {len}</span>
          <button className="btn" aria-label="Close" onClick={onClose}>✕</button>
        </span>
      </div>

      <div className="bar b" onMouseDown={(e) => e.preventDefault()}>
        <button className="btn" aria-label="Previous" onClick={prev}>‹</button>
        <button className="btn" aria-label={playing ? 'Pause' : 'Play'} onClick={() => setPlaying((p) => !p)}>
          {playing ? '❚❚ Pause' : '▶ Play'}
        </button>
        <button className="btn" aria-label="Next" onClick={next}>›</button>
        <select value={secs} onChange={(e) => setSecs(+e.target.value)} aria-label="Seconds per photo">
          {SPEEDS.map((s) => <option key={s} value={s}>{s}s / photo</option>)}
        </select>
        <button className="btn" aria-label="Fullscreen" onClick={toggleFs}>⛶</button>
        <button className="btn" aria-label="Delete" onClick={del}>🗑</button>
      </div>
    </div>
  );
}
