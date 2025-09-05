// frontend/src/pages/Register.jsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { register } from '../services/auth';

export default function Register() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { token } = await register(name, email, password);
      if (!token) throw new Error('No token returned');
      navigate('/', { replace: true });
    } catch (err) {
      console.error('Register failed', err);
      const msg = err?.response?.data?.error || err?.response?.data?.message || err.message || 'Register failed';
      alert(String(msg));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="max-w-md mx-auto p-4">
      <h2 className="text-xl mb-4">Create account</h2>
      <input value={name} onChange={e => setName(e.target.value)} placeholder="Full name" className="w-full mb-2 p-2 border" />
      <input value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" type="email" required className="w-full mb-2 p-2 border" />
      <input value={password} onChange={e => setPassword(e.target.value)} placeholder="Password (min 6 chars)" type="password" required minLength={6} className="w-full mb-4 p-2 border" />
      <button disabled={busy} className="px-4 py-2 bg-blue-600 text-white rounded">{busy ? 'Creating…' : 'Create account'}</button>
    </form>
  );
}
