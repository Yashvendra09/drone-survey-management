import axios from 'axios';

/**
 * API client
 * - baseURL uses VITE_API_BASE if present (useful for dev/prod)
 * - timeout for safety
 *
 * NOTE: be consistent about the '/api' prefix:
 *  - Either set baseURL to 'http://host:port/api' and call '/drones'
 *  - Or set baseURL to 'http://host:port' and call '/api/drones' as below.
 */
const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE || 'http://localhost:5000',
  timeout: 15000,
});

/** LocalStorage token key (keep in sync with your auth helpers) */
const TOKEN_KEY = 'droneapp_token';

/**
 * Set default Authorization header for axios and persist token
 * Call this after login.
 * @param {string|null} token
 */
export function setAuthToken(token) {
  if (token) {
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
    try { localStorage.setItem(TOKEN_KEY, token); } catch (e) { /* ignore storage errors */ }
  } else {
    delete api.defaults.headers.common.Authorization;
    try { localStorage.removeItem(TOKEN_KEY); } catch (e) { /* ignore */ }
  }
}

/** Clear auth from axios + storage (call on logout or 401) */
export function clearAuthToken() {
  delete api.defaults.headers.common.Authorization;
  try { localStorage.removeItem(TOKEN_KEY); } catch (e) { /* ignore */ }
}

/** Initialize token from storage on load (so page refresh keeps session) */
(function initAuthFromStorage() {
  try {
    const t = localStorage.getItem(TOKEN_KEY);
    if (t) api.defaults.headers.common.Authorization = `Bearer ${t}`;
  } catch (e) {
    // ignore
  }
})();

/**
 * Request interceptor
 * - attach token (in addition to initAuthFromStorage, this ensures latest token is used)
 * - set Content-Type unless FormData
 */
api.interceptors.request.use((cfg) => {
  try {
    // Prefer explicit header already set (e.g., manual setAuthToken)
    const headers = cfg.headers || {};
    // Check both header name casings
    const hasAuthHeader = headers.Authorization || headers.authorization || api.defaults.headers.common.Authorization;
    if (!hasAuthHeader) {
      const token = localStorage.getItem(TOKEN_KEY);
      if (token) {
        cfg.headers = { ...headers, Authorization: `Bearer ${token}` };
      } else {
        cfg.headers = headers;
      }
    }
  } catch (e) {
    // ignore
  }

  // If body is FormData, let axios set the header; otherwise ensure JSON content-type
  const body = cfg.data;
  if (!(body instanceof FormData)) {
    cfg.headers = cfg.headers || {};
    if (!cfg.headers['Content-Type'] && !cfg.headers['content-type']) {
      cfg.headers['Content-Type'] = 'application/json';
    }
  }

  return cfg;
}, (err) => Promise.reject(err));

/**
 * Response interceptor
 * - normalize errors
 * - on 401: clear auth and redirect to /login (quick fail-safe)
 */
api.interceptors.response.use(
  (res) => res,
  (error) => {
    // If server responded, normalize the error payload
    if (error?.response) {
      const { status, data } = error.response;

      // If unauthorized -> clear token and redirect to login page for SPA
      if (status === 401) {
        clearAuthToken();
        try {
          // preserve current path for redirect after login
          const redirect = encodeURIComponent(window.location.pathname + window.location.search);
          window.location.replace(`/login?next=${redirect}`);
        } catch (e) {
          // ignore
        }
      }

      const message = (data && (data.error || data.message || JSON.stringify(data))) || error.message || 'Request failed';
      const err = new Error(String(message));
      err.response = error.response;
      return Promise.reject(err);
    }

    // Network / timeout / CORS errors
    const netErr = new Error(error?.message || 'Network error');
    netErr.original = error;
    return Promise.reject(netErr);
  }
);

// -------------------- DRONES --------------------

export const fetchDrones = async () => {
  const { data } = await api.get('/api/drones');
  return data;
};

export const addDrone = async (payload) => {
  const { data } = await api.post('/api/drones', payload);
  return data;
};

export const updateDrone = async (id, payload) => {
  const { data } = await api.put(`/api/drones/${id}`, payload);
  return data;
};

export const deleteDrone = async (id) => {
  const { data } = await api.delete(`/api/drones/${id}`);
  return data;
};

// -------------------- MISSIONS --------------------

export const fetchMissions = async () => {
  const { data } = await api.get('/api/missions');
  return data;
};

export const createMission = async (payload) => {
  const { data } = await api.post('/api/missions', payload);
  return data;
};

export const startMission = async (missionId) => {
  const { data } = await api.post(`/api/missions/${missionId}/start`);
  return data;
};

export const pauseMission = async (missionId) => {
  const { data } = await api.patch(`/api/missions/${missionId}/pause`);
  return data;
};

export const resumeMission = async (missionId) => {
  const { data } = await api.patch(`/api/missions/${missionId}/resume`);
  return data;
};

export const abortMission = async (missionId) => {
  const { data } = await api.patch(`/api/missions/${missionId}/abort`);
  return data;
};

export default api;
