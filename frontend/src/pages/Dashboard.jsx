// frontend/src/pages/Dashboard.jsx
import React, { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { fetchDrones, fetchMissions, startMission } from '../services/api';
import StatCard from '../components/StatCard';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, BarChart, Bar } from 'recharts';
import { formatDistanceToNowStrict } from 'date-fns';
import clsx from 'clsx';

const STATUS_COLORS = {
  available: '#10b981',
  'in-progress': '#2563eb',
  scheduled: '#f59e0b',
  completed: '#6b7280',
  aborted: '#ef4444',
  offline: '#9ca3af'
};

const PATTERN_LABEL = {
  grid: 'Lawnmower',
  lawnmower: 'Lawnmower',
  crosshatch: 'Crosshatch',
  perimeter: 'Perimeter',
};

export default function Dashboard() {
  const [drones, setDrones] = useState([]);
  const [missions, setMissions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [startingId, setStartingId] = useState(null);

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [d, m] = await Promise.all([fetchDrones(), fetchMissions()]);
      setDrones(Array.isArray(d) ? d : []);
      setMissions(Array.isArray(m) ? m : []);
    } catch (err) {
      console.error('Failed to load dashboard data', err);
    } finally {
      setLoading(false);
    }
  };

  // KPI values
  const stats = useMemo(() => {
    const totalDrones = drones.length;
    const inMission = drones.filter((x) => x.status === 'in-mission' || x.status === 'in-progress').length;
    const available = drones.filter((x) => x.status === 'available').length;
    const completed = missions.filter((m) => m.status === 'completed').length;
    return { totalDrones, inMission, available, completed };
  }, [drones, missions]);

  // pie data for drone statuses
  const droneStatusCounts = useMemo(() => {
    const counts = {};
    drones.forEach((d) => {
      const s = d.status || 'offline';
      counts[s] = (counts[s] || 0) + 1;
    });
    return Object.entries(counts).map(([status, value]) => ({ name: status, value, color: STATUS_COLORS[status] || '#64748b' }));
  }, [drones]);

  // mission status distribution
  const missionStatusCounts = useMemo(() => {
    const counts = {};
    missions.forEach((m) => {
      const s = m.status || 'scheduled';
      counts[s] = (counts[s] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [missions]);

  // recent missions
  const recentMissions = useMemo(() => {
    return [...missions].sort((a, b) => {
      const ta = new Date(a.updatedAt || a.createdAt || Date.now()).getTime();
      const tb = new Date(b.updatedAt || b.createdAt || Date.now()).getTime();
      return tb - ta;
    }).slice(0, 6);
  }, [missions]);

  const handleStartFirstScheduled = async () => {
    // find first mission with status 'planned'
    const candidate = missions.find((m) => m.status === 'planned');
    if (!candidate) {
      alert('No scheduled mission found to start.');
      return;
    }
    try {
      setStartingId(candidate._id);
      await startMission(candidate._id);
      await loadAll();
    } catch (err) {
      console.error(err);
      alert('Failed to start mission: ' + (err?.response?.data?.message || err.message));
    } finally {
      setStartingId(null);
    }
  };

  const patternText = (m) => {
    const key = m.pattern ?? m.parameters?.pattern;
    return PATTERN_LABEL[key] ?? (key || 'Lawnmower');
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Overview</h1>
          <div className="text-sm text-gray-500">Fleet & mission health at a glance</div>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/planner" className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm">Create Mission</Link>
          <button
            onClick={handleStartFirstScheduled}
            disabled={startingId !== null}
            className={clsx('px-4 py-2 rounded-md text-sm', startingId ? 'bg-gray-200 text-gray-700' : 'bg-green-600 text-white')}
          >
            {startingId ? 'Starting…' : 'Start Next Mission'}
          </button>
          <button onClick={loadAll} className="px-3 py-2 border rounded-md text-sm">Refresh</button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard title="Total Drones" value={stats.totalDrones} subtitle="Registered drones" />
        <StatCard title="In Mission" value={stats.inMission} subtitle="Active missions now" />
        <StatCard title="Available" value={stats.available} subtitle="Ready for assignment" />
        <StatCard title="Completed Missions" value={stats.completed} subtitle="All-time completed" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <div className="lg:col-span-2 bg-white rounded-2xl shadow p-4">
          <div className="flex items-center justify-between">
            <h2 className="font-medium">Mission Statuses</h2>
            <div className="text-sm text-gray-500">Realtime & historical</div>
          </div>

          <div style={{ height: 240 }} className="mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={missionStatusCounts}>
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value" fill="#2563eb" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-4 text-sm text-gray-500">Recent missions</div>
          <div className="mt-3 space-y-2">
            {recentMissions.length === 0 && <div className="text-sm text-gray-500">No missions yet</div>}
            {recentMissions.map((m) => (
              <div key={m._id} className="flex items-center justify-between px-3 py-2 rounded hover:bg-gray-50">
                <div>
                  <div className="text-sm font-medium">{m.name || `Mission ${m._id.substring(0,6)}`}</div>
                  <div className="text-xs text-gray-400">{m.flightPath?.length ?? 0} waypoints • {patternText(m)}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium">{m.progress ?? 0}%</div>
                  <div className="text-xs text-gray-400">{m.status}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow p-4">
          <h2 className="font-medium">Fleet Status</h2>
          <div style={{ height: 240 }} className="mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={droneStatusCounts} dataKey="value" nameKey="name" innerRadius={40} outerRadius={80} label>
                  {droneStatusCounts.map((entry, idx) => (
                    <Cell key={idx} fill={entry.color} />
                  ))}
                </Pie>
                <Legend />
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 text-sm">
            {droneStatusCounts.map((d) => (
              <div key={d.name} className="flex items-center justify-between text-xs py-1">
                <div className="flex items-center gap-2">
                  <span style={{ width: 10, height: 10, background: d.color }} className="rounded" />
                  <div className="capitalize">{d.name}</div>
                </div>
                <div className="text-gray-500">{d.value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Missions table & rest omitted for brevity — keep unchanged */}
    </div>
  );
}
