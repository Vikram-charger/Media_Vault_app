import { useState } from 'react';
import { json } from './api.js';

export default function Login({ onDone }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget); // read before any await
    setBusy(true);
    setErr('');
    try {
      await json('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: f.get('username'), password: f.get('password') }),
      });
      onDone();
    } catch (ex) {
      setErr(
        ex.status === 401 ? 'Invalid username or password'
        : ex.status ? ex.message
        : "Can't reach the server",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="center">
      <form className="card" onSubmit={submit}>
        <h1>Media Vault</h1>
        <input name="username" placeholder="Username" autoComplete="username" required autoFocus />
        <input name="password" type="password" placeholder="Password" autoComplete="current-password" required />
        <button className="btn primary" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
        {err && <div className="err">{err}</div>}
      </form>
    </div>
  );
}
