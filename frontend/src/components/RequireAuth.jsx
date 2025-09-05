import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { getToken } from '../services/auth';

export default function RequireAuth({ children }) {
  const token = getToken();
  const location = useLocation();
  if (!token) return <Navigate to="/login" state={{ from: location }} replace />;
  return children;
}
