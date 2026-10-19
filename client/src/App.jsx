import { useEffect, useState } from 'react';
import { api, json } from './api.js';
import Login from './Login.jsx';
import Gallery from './Gallery.jsx';

export default function App() {
  const [authed, setAuthed] = useState(null); // null = checking
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    json('/api/auth/me').then(() => setAuthed(true)).catch(() => setAuthed(false));
    const onExpired = () => setAuthed(false);
    window.addEventListener('auth:expired', onExpired);
    const t = setTimeout(() => setSlow(true), 4000);
    return () => {
      window.removeEventListener('auth:expired', onExpired);
      clearTimeout(t);
    };
  }, []);

  const logout = async () => {
    await api('/api/auth/logout', { method: 'POST' });
    setAuthed(false);
  };

  if (authed === null) {
    return (
      <div className="center muted">
        {slow ? 'Waking up the server. This can take up to a minute on free hosting…' : 'Loading…'}
      </div>
    );
  }
  return authed ? <Gallery onLogout={logout} /> : <Login onDone={() => setAuthed(true)} />;
}
