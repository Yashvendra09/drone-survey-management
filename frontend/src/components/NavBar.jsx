// frontend/src/components/NavBar.jsx
import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getUser, getToken, clearAuth } from '../services/auth';

export default function NavBar() {
  const [user, setUser] = useState(null);
  const navigate = useNavigate();

  // sync initial user from storage
  useEffect(() => {
    setUser(getUser());
    // update on storage changes (other tabs or window)
    const onStorage = (e) => {
      if (e.key === 'droneapp_token' || e.key === 'droneapp_user') {
        setUser(getUser());
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const handleLogout = async () => {
    if (!window.confirm('Sign out?')) return;
    try {
      clearAuth();
      // ensure axios header cleared and localStorage cleared
      setUser(null);
      navigate('/login', { replace: true });
    } catch (err) {
      console.error('Logout failed', err);
      // still force redirect & clear
      setUser(null);
      navigate('/login', { replace: true });
    }
  };

  const token = getToken();

  return (
    <nav className="bg-white border-b">
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex justify-between h-14 items-center">
          <div className="flex items-center gap-4">
            <Link to="/" className="text-lg font-semibold">Drone Survey</Link>
            <Link to="/drones" className="text-sm text-gray-600 hover:text-gray-900">Fleet</Link>
            <Link to="/planner" className="text-sm text-gray-600 hover:text-gray-900">Planner</Link>
            <Link to="/missions" className="text-sm text-gray-600 hover:text-gray-900">Missions</Link>
            <Link to="/monitor" className="text-sm text-gray-600 hover:text-gray-900">Monitor</Link>
            <Link to="/reports" className="text-sm text-gray-600 hover:text-gray-900">Reports</Link>
          </div>

          <div className="flex items-center gap-3">
            {!token && (
              <>
                <Link to="/login" className="px-3 py-1 text-sm border rounded">Sign in</Link>
                <Link to="/register" className="px-3 py-1 text-sm bg-blue-600 text-white rounded">Register</Link>
              </>
            )}

            {token && (
              <div className="flex items-center gap-3">
                <div className="text-sm text-gray-700">
                  <div className="font-medium">{user?.name || user?.email || 'User'}</div>
                  <div className="text-xs text-gray-500">{user?.role || ''}</div>
                </div>

                <button
                  onClick={handleLogout}
                  className="px-3 py-1 text-sm bg-red-500 text-white rounded"
                >
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
