// frontend/src/pages/Login.jsx
import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { login } from '../services/auth';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || '/';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { token } = await login(email, password);
      if (!token) throw new Error('No token returned');
      // success -> redirect
      navigate(from, { replace: true });
    } catch (err) {
      console.error('Login failed', err);
      // Show server error if present
      const msg = err?.response?.data?.error || err?.response?.data?.message || err.message || 'Login failed';
      alert(String(msg));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-md mx-auto p-6">
      <h1 className="text-2xl font-semibold mb-4">Sign in</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm text-gray-600">Email</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} required className="w-full border rounded px-2 py-2" />
        </div>
        <div>
          <label className="block text-sm text-gray-600">Password</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} required className="w-full border rounded px-2 py-2" />
        </div>
        <div>
          <button disabled={busy} className="w-full px-3 py-2 bg-blue-600 text-white rounded">{busy ? 'Signing in…' : 'Sign in'}</button>
        </div>
        <div className="text-sm text-gray-500">
          New? <Link to="/register" className="text-blue-600">Create an account</Link>
        </div>
      </form>
    </div>
  );
}
