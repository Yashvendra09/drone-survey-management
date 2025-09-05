// frontend/src/pages/Missions.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { fetchMissions, startMission, pauseMission, resumeMission, abortMission } from '../services/api';
import { socket } from '../services/socket';
import { format } from 'date-fns';
import clsx from 'clsx';

const PATTERN_LABEL = {
  grid: 'Lawnmower',
  lawnmower: 'Lawnmower',
  crosshatch: 'Crosshatch',
  perimeter: 'Perimeter',
};

export default function Missions() {
  const [missions, setMissions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;
  const [selectedMission, setSelectedMission] = useState(null);

  useEffect(() => {
    loadMissions();
    // listen for realtime updates
    const handler = (data) => {
      setMissions((prev) =>
        prev.map((m) =>
          m._id === data.missionId
            ? { ...m, status: data.status, progress: data.progress }
            : m
        )
      );
    };
    socket.on('missionProgress', handler);
    return () => socket.off('missionProgress', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadMissions() {
    setLoading(true);
    try {
      const data = await fetchMissions();
      setMissions(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return missions;
    return missions.filter((m) =>
      [m.name, m.pattern, m.parameters?.pattern, m.status, m._id].some((v) =>
        v && v.toString().toLowerCase().includes(s)
      )
    );
  }, [missions, q]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleStart = async (id) => {
    try {
      await startMission(id);
      await loadMissions();
    } catch (err) {
      console.error(err);
      alert(
        'Failed to start mission: ' +
          (err?.response?.data?.error || err.message)
      );
    }
  };

  const handleControl = async (action, id) => {
    try {
      if (action === 'pause') await pauseMission(id);
      if (action === 'resume') await resumeMission(id);
      if (action === 'abort') await abortMission(id);
      await loadMissions();
    } catch (err) {
      console.error(err);
      alert(
        `Failed to ${action} mission: ` +
          (err?.response?.data?.error || err.message)
      );
    }
  };

  const patternText = (m) => {
    const key = m.pattern ?? m.parameters?.pattern;
    return PATTERN_LABEL[key] ?? (key || 'Lawnmower');
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-semibold">Missions</h1>
          <div className="text-sm text-gray-500">
            Create, start and control missions.
          </div>
        </div>
        <div className="flex items-center gap-2">
          <input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
            placeholder="Search missions..."
            className="border rounded px-3 py-2 text-sm"
          />
          <button
            onClick={loadMissions}
            className="px-3 py-2 border rounded text-sm"
          >
            Refresh
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow overflow-hidden">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-4 py-2">Mission</th>
              <th className="text-left px-4 py-2">Pattern</th>
              <th className="text-left px-4 py-2">Progress</th>
              <th className="text-left px-4 py-2">Status</th>
              <th className="text-left px-4 py-2">Waypoints</th>
              <th className="text-left px-4 py-2">Last Updated</th>
              <th className="text-left px-4 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={7} className="px-4 py-4 text-gray-500">
                  Loading…
                </td>
              </tr>
            )}
            {!loading && pageItems.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-gray-500">
                  No missions
                </td>
              </tr>
            )}
            {pageItems.map((m) => (
              <tr key={m._id} className="border-t hover:bg-gray-50">
                <td className="px-4 py-3">
                  <div className="font-medium">
                    {m.name || `Mission ${m._id.substring(0, 6)}`}
                  </div>
                  <div className="text-xs text-gray-400">{m._id}</div>
                </td>

                <td className="px-4 py-3">{patternText(m)}</td>

                <td className="px-4 py-3 w-56">
                  <div className="w-full bg-gray-100 h-3 rounded-full overflow-hidden">
                    <div
                      style={{ width: `${m.progress ?? 0}%` }}
                      className="h-full bg-blue-600"
                    />
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {m.progress ?? 0}%
                  </div>
                </td>

                <td className="px-4 py-3">
                  <span
                    className={clsx(
                      'px-2 py-1 rounded-md text-xs',
                      m.status === 'completed'
                        ? 'bg-gray-100 text-gray-700'
                        : m.status === 'in-progress'
                        ? 'bg-blue-100 text-blue-700'
                        : m.status === 'aborted'
                        ? 'bg-red-100 text-red-700'
                        : 'bg-yellow-100 text-yellow-700'
                    )}
                  >
                    {m.status || 'planned'}
                  </span>
                </td>

                <td className="px-4 py-3">{m.flightPath?.length ?? 0}</td>
                <td className="px-4 py-3 text-sm text-gray-500">
                  {m.updatedAt ? format(new Date(m.updatedAt), 'PP p') : '—'}
                </td>

                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleStart(m._id)}
                      className="px-2 py-1 text-xs bg-green-600 text-white rounded"
                    >
                      Start
                    </button>
                    <button
                      onClick={() => handleControl('pause', m._id)}
                      className="px-2 py-1 text-xs bg-yellow-400 rounded"
                    >
                      Pause
                    </button>
                    <button
                      onClick={() => handleControl('resume', m._id)}
                      className="px-2 py-1 text-xs bg-indigo-600 text-white rounded"
                    >
                      Resume
                    </button>
                    <button
                      onClick={() => handleControl('abort', m._id)}
                      className="px-2 py-1 text-xs bg-red-500 text-white rounded"
                    >
                      Abort
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* pagination */}
        <div className="flex items-center justify-between px-4 py-3 border-t">
          <div className="text-sm text-gray-500">
            Showing {(page - 1) * PAGE_SIZE + 1}–
            {Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}{' '}
            missions
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="px-3 py-1 border rounded"
            >
              Prev
            </button>
            <div className="px-3 py-1 text-sm">
              Page {page} / {totalPages}
            </div>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="px-3 py-1 border rounded"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
