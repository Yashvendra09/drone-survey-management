// frontend/src/App.jsx
import { Routes, Route } from 'react-router-dom';
import NavBar from './components/NavBar';
import Dashboard from './pages/Dashboard';
import Drones from './pages/Drones';
import Missions from './pages/Missions';
import Monitor from './pages/Monitor';
import Reports from './pages/Reports';
import MissionPlanner from './pages/MissionPlanner';
import Login from './pages/Login';
import Register from './pages/Register';
import RequireAuth from './components/RequireAuth';

export default function App() {
  return (
    <div className="min-h-full">
      <NavBar />
      <Routes>
        {/* Public pages: login + register */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* All other routes are protected globally via RequireAuth */}
        <Route
          path="/"
          element={
            <RequireAuth>
              <Dashboard />
            </RequireAuth>
          }
        />
        <Route
          path="/drones"
          element={
            <RequireAuth>
              <Drones />
            </RequireAuth>
          }
        />
        <Route
          path="/missions"
          element={
            <RequireAuth>
              <Missions />
            </RequireAuth>
          }
        />
        <Route
          path="/monitor"
          element={
            <RequireAuth>
              <Monitor />
            </RequireAuth>
          }
        />
        <Route
          path="/reports"
          element={
            <RequireAuth>
              <Reports />
            </RequireAuth>
          }
        />
        <Route
          path="/planner"
          element={
            <RequireAuth>
              <MissionPlanner />
            </RequireAuth>
          }
        />
      </Routes>
    </div>
  );
}
