// frontend/src/services/auth.js
import api, { setAuthToken, clearAuthToken } from './api';

const TOKEN_KEY = 'droneapp_token';
const USER_KEY = 'droneapp_user';

export function saveAuth(token, user) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
  } catch (e) {
    console.warn('Failed to save auth', e);
  }
}

export function clearAuth() {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  } catch (e) {}
  clearAuthToken();
}

export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch (e) {
    return null;
  }
}

export function getUser() {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY));
  } catch (e) {
    return null;
  }
}

/**
 * Call /api/auth/login
 * Returns { token, user } on success
 */
export async function login(email, password) {
  const res = await api.post('/api/auth/login', { email, password });
  // axios returns response.data
  const { token, user } = res.data || res;
  if (token) {
    setAuthToken(token);
    saveAuth(token, user);
  }
  return { token, user };
}

/**
 * Call /api/auth/register
 * Returns { token, user } on success
 */
export async function register(name, email, password) {
  const res = await api.post('/api/auth/register', { name, email, password });
  const { token, user } = res.data || res;
  if (token) {
    setAuthToken(token);
    saveAuth(token, user);
  }
  return { token, user };
}
