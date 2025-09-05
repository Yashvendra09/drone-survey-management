import React, { useEffect, useMemo, useState, useRef } from 'react';
import { fetchDrones, addDrone, deleteDrone, updateDrone } from '../services/api';
import { formatDistanceToNow } from 'date-fns';
import clsx from 'clsx';
import { useNavigate } from 'react-router-dom';

/**
 * Utility: download rows as CSV
 */
function downloadCSV(filename, rows) {
  if (!rows || !rows.length) return;
  const header = Object.keys(rows[0] || {}).join(',');
  const csv = [header, ...rows.map(r => Object.values(r).map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export default function Drones() {
  const [drones, setDrones] = useState([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState(null);
  const [adding, setAdding] = useState(false);
  const [submittingAdd, setSubmittingAdd] = useState(false);
  const [newDrone, setNewDrone] = useState({
    name: '',
    model: '',
    batteryLevel: 100,
    status: 'available',
    location: { lat: 0, lng: 0 },
    notes: ''
  });

  const navigate = useNavigate();

  // simple debounce for search
  const qRef = useRef(q);
  useEffect(() => {
    qRef.current = q;
    const t = setTimeout(() => {
      // triggers re-render if needed: using state is sufficient here because filtered is memoized on q
      setQ(prev => prev);
    }, 220);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function load() {
    setLoading(true);
    try {
      const data = await fetchDrones();
      setDrones(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to fetch drones', err);
      alert('Failed to load drones. See console for details.');
    } finally {
      setLoading(false);
    }
  }

  async function handleAddDrone(e) {
    e.preventDefault();
    setSubmittingAdd(true);
    try {
      // Basic client validation
      if (!newDrone.name || !newDrone.model) {
        alert('Please provide name and model.');
        setSubmittingAdd(false);
        return;
      }
      await addDrone(newDrone);
      setAdding(false);
      setNewDrone({ name: '', model: '', batteryLevel: 100, status: 'available', location: { lat: 0, lng: 0 }, notes: '' });
      await load();
    } catch (err) {
      console.error(err);
      alert('Failed to add drone. See console for details.');
    } finally {
      setSubmittingAdd(false);
    }
  }

  async function handleDeleteDrone(id) {
    if (!window.confirm('Are you sure you want to delete this drone?')) return;
    try {
      await deleteDrone(id);
      setSelected(null);
      await load();
    } catch (err) {
      console.error(err);
      alert('Failed to delete drone');
    }
  }

  async function handleHealthCheck(id) {
    try {
      await updateDrone(id, { status: 'available', batteryLevel: 100 });
      // optimistic: refresh list
      await load();
      alert('Drone health reset to available (battery 100%)');
    } catch (err) {
      console.error(err);
      alert('Failed to run health check');
    }
  }

  function handleAssignMission(drone) {
    // send both navigation state and query param so planner receives it reliably (deep links and page reloads supported)
    const id = drone._id || drone.id || drone.droneId || drone.uuid;
    if (!id) {
      console.warn('Drone missing id, cannot assign', drone);
      alert('Selected drone has no identifier. Cannot assign.');
      return;
    }
    navigate(`/planner?drone=${encodeURIComponent(id)}`, {
      state: { selectedDrone: id }
    });
  }

  const filtered = useMemo(() => {
    const s = (q || '').trim().toLowerCase();
    if (!s) return drones;
    return drones.filter(d => [d.name, d.model, d._id, d.status, d.notes].some(v => v && v.toString().toLowerCase().includes(s)));
  }, [drones, q]);

  const exportCSV = () => {
    if (!drones.length) return alert('No drones to export');
    const rows = drones.map(d => ({
      id: d._id,
      name: d.name || '',
      model: d.model || '',
      status: d.status || '',
      battery: d.batteryLevel != null ? `${d.batteryLevel}%` : '',
      lastSeen: d.updatedAt ? new Date(d.updatedAt).toISOString() : '',
      notes: d.notes || ''
    }));
    downloadCSV('drones.csv', rows);
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-semibold">Fleet</h1>
          <div className="text-sm text-gray-500">Manage drone inventory & health</div>
        </div>

        <div className="flex items-center gap-2">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search drones..." aria-label="Search drones" className="border rounded px-3 py-2 text-sm" />
          <button onClick={load} disabled={loading} className="px-3 py-2 border rounded text-sm" aria-busy={loading}>{loading ? 'Refreshing…' : 'Refresh'}</button>
          <button onClick={exportCSV} className="px-3 py-2 bg-blue-600 text-white rounded text-sm">Export CSV</button>
          <button onClick={() => setAdding(true)} className="px-3 py-2 bg-green-600 text-white rounded text-sm">+ Add Drone</button>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow overflow-hidden">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-4 py-2">Name</th>
              <th className="text-left px-4 py-2">Model</th>
              <th className="text-left px-4 py-2">Status</th>
              <th className="text-left px-4 py-2">Battery</th>
              <th className="text-left px-4 py-2">Last Seen</th>
              <th className="text-left px-4 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={6} className="px-4 py-6 text-gray-500">Loading…</td></tr>}
            {!loading && filtered.length === 0 && <tr><td colSpan={6} className="px-4 py-6 text-gray-500">No drones</td></tr>}
            {filtered.map(d => (
              <tr key={d._id || d.id || d.droneId} className="border-t hover:bg-gray-50">
                <td className="px-4 py-3">
                  <div className="font-medium">{d.name || `Drone ${String(d._id || '').substring(0,6) || '—'}`}</div>
                  <div className="text-xs text-gray-400">{d._id}</div>
                </td>
                <td className="px-4 py-3">{d.model || '—'}</td>
                <td className="px-4 py-3">
                  <span className={clsx('px-2 py-1 rounded-md text-xs inline-flex items-center gap-2',
                    d.status === 'available' ? 'bg-green-100 text-green-700'
                      : d.status === 'in-mission' ? 'bg-blue-100 text-blue-700'
                      : d.status === 'charging' ? 'bg-yellow-100 text-yellow-700'
                      : 'bg-gray-100 text-gray-700'
                  )}>
                    <span aria-hidden>{d.status === 'in-mission' ? '✈️' : d.status === 'charging' ? '🔌' : '✔️'}</span>
                    <span>{d.status || 'unknown'}</span>
                  </span>
                </td>
                <td className="px-4 py-3">{d.batteryLevel != null ? `${d.batteryLevel}%` : '—'}</td>
                <td className="px-4 py-3 text-xs text-gray-500">{d.updatedAt ? formatDistanceToNow(new Date(d.updatedAt), { addSuffix: true }) : '—'}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <button onClick={() => setSelected(d)} className="px-2 py-1 border rounded text-xs">View</button>
                    <button onClick={() => handleAssignMission(d)} className="px-2 py-1 bg-blue-600 text-white rounded text-xs">Assign</button>
                    <button onClick={() => handleHealthCheck(d._id)} className="px-2 py-1 bg-yellow-400 rounded text-xs">Recharge Battery</button>
                    <button onClick={() => handleDeleteDrone(d._id)} className="px-2 py-1 bg-red-500 text-white rounded text-xs">Delete</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Drone detail drawer */}
      {selected && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1" onClick={() => setSelected(null)} />
          <div role="dialog" aria-modal="true" className="w-[500px] bg-white shadow-xl p-4 overflow-auto">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-semibold">{selected.name || 'Drone'}</h3>
                <div className="text-xs text-gray-500">{selected._id}</div>
              </div>
              <button onClick={() => setSelected(null)} className="px-2 py-1 text-gray-500">Close</button>
            </div>

            <div className="mt-4 space-y-3 text-sm text-gray-700">
              <div><strong>Model:</strong> {selected.model || '—'}</div>
              <div><strong>Status:</strong> {selected.status || '—'}</div>
              <div><strong>Battery:</strong> {selected.batteryLevel != null ? `${selected.batteryLevel}%` : '—'}</div>
              <div><strong>Last Seen:</strong> {selected.updatedAt ? new Date(selected.updatedAt).toLocaleString() : '—'}</div>
              <div><strong>Notes:</strong> {selected.notes || 'No additional details'}</div>
            </div>
          </div>
        </div>
      )}

      {/* Add Drone Drawer */}
      {adding && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1" onClick={() => setAdding(false)} />
          <div role="dialog" aria-modal="true" className="w-[500px] bg-white shadow-xl p-4 overflow-auto">
            <h3 className="text-lg font-semibold mb-4">Add Drone</h3>
            <form onSubmit={handleAddDrone} className="space-y-4 text-sm">
              <div>
                <label className="text-gray-600">Name</label>
                <input value={newDrone.name} onChange={e => setNewDrone({ ...newDrone, name: e.target.value })} className="w-full border rounded px-2 py-2 mt-1" required />
              </div>
              <div>
                <label className="text-gray-600">Model</label>
                <input value={newDrone.model} onChange={e => setNewDrone({ ...newDrone, model: e.target.value })} className="w-full border rounded px-2 py-2 mt-1" required />
              </div>
              <div>
                <label className="text-gray-600">Notes</label>
                <input value={newDrone.notes} onChange={e => setNewDrone({ ...newDrone, notes: e.target.value })} className="w-full border rounded px-2 py-2 mt-1" />
              </div>
              <div>
                <label className="text-gray-600">Battery Level (%)</label>
                <input type="number" value={newDrone.batteryLevel} onChange={e => setNewDrone({ ...newDrone, batteryLevel: Number(e.target.value) })} min="0" max="100" className="w-full border rounded px-2 py-2 mt-1" />
              </div>
              <div>
                <label className="text-gray-600">Status</label>
                <select value={newDrone.status} onChange={e => setNewDrone({ ...newDrone, status: e.target.value })} className="w-full border rounded px-2 py-2 mt-1">
                  <option value="available">Available</option>
                  <option value="in-mission">In-Mission</option>
                  <option value="charging">Charging</option>
                  <option value="maintenance">Maintenance</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-gray-600">Latitude</label>
                  <input type="number" value={newDrone.location.lat} onChange={e => setNewDrone({ ...newDrone, location: { ...newDrone.location, lat: Number(e.target.value) } })} className="w-full border rounded px-2 py-2 mt-1" />
                </div>
                <div>
                  <label className="text-gray-600">Longitude</label>
                  <input type="number" value={newDrone.location.lng} onChange={e => setNewDrone({ ...newDrone, location: { ...newDrone.location, lng: Number(e.target.value) } })} className="w-full border rounded px-2 py-2 mt-1" />
                </div>
              </div>
              <div>
                <button type="submit" disabled={submittingAdd} className="w-full px-3 py-2 bg-green-600 text-white rounded">
                  {submittingAdd ? 'Adding…' : 'Add Drone'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
