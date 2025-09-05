// src/pages/Reports.jsx
import { useEffect, useState, useMemo } from "react"
import { fetchMissions } from "../services/api"
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, BarChart, Bar
} from "recharts"

const COLORS = ["#3b82f6", "#22c55e", "#facc15", "#ef4444"]

export default function Reports() {
  const [missions, setMissions] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")

  useEffect(() => {
    async function load() {
      try {
        const data = await fetchMissions()
        setMissions(data || [])
      } catch (e) {
        console.error("Failed to load missions", e)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  // ---- KPIs ----
  const kpis = useMemo(() => {
    const total = missions.length
    const completed = missions.filter(m => m.status === "completed").length
    const inProgress = missions.filter(m => m.status === "in-progress").length
    const aborted = missions.filter(m => m.status === "aborted").length
    const completionRate = total ? `${Math.round((completed / total) * 100)}%` : "0%"
    return [
      { title: "Total Missions", value: total },
      { title: "Completed", value: completed },
      { title: "In Progress", value: inProgress },
      { title: "Aborted", value: aborted },
      { title: "Completion Rate", value: completionRate },
    ]
  }, [missions])

  // ---- Charts ----
  const missionsOverTime = useMemo(() => {
    const map = {}
    missions.forEach(m => {
      const d = new Date(m.createdAt || m.startTime || Date.now())
      const key = d.toISOString().split("T")[0]
      map[key] = (map[key] || 0) + 1
    })
    return Object.entries(map).map(([date, count]) => ({ date, count }))
  }, [missions])

  const statusDistribution = useMemo(() => {
    const map = {}
    missions.forEach(m => {
      map[m.status || "unknown"] = (map[m.status || "unknown"] || 0) + 1
    })
    return Object.entries(map).map(([name, value]) => ({ name, value }))
  }, [missions])

  const pathLengthByMission = useMemo(() => {
    return missions.map(m => ({
      mission: m.name || m._id.substring(0, 6),
      waypoints: m.flightPath?.length || 0,
    }))
  }, [missions])

  const filteredTable = useMemo(() => {
    return missions.filter(m =>
      (m.name || m._id)
        .toLowerCase()
        .includes(search.toLowerCase())
    )
  }, [missions, search])

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <h1 className="text-3xl font-bold">Reports & Analytics</h1>
      <p className="text-gray-600">Analytics, summaries, and insights from completed missions.</p>

      {loading ? (
        <div className="text-gray-500">Loadingâ€¦</div>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {kpis.map((kpi, i) => (
              <div key={i} className="bg-white rounded-2xl shadow p-5 hover:shadow-md transition">
                <div className="text-gray-500 text-sm">{kpi.title}</div>
                <div className="text-2xl font-semibold mt-1">{kpi.value}</div>
              </div>
            ))}
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Trend Line */}
            <div className="bg-white rounded-2xl shadow p-4">
              <h2 className="font-medium mb-2">Missions Over Time</h2>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={missionsOverTime}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Status Pie */}
            <div className="bg-white rounded-2xl shadow p-4">
              <h2 className="font-medium mb-2">Missions by Status</h2>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusDistribution}
                      dataKey="value"
                      cx="50%"
                      cy="50%"
                      outerRadius={90}
                      label
                    >
                      {statusDistribution.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Waypoints Bar */}
            <div className="bg-white rounded-2xl shadow p-4 lg:col-span-2">
              <h2 className="font-medium mb-2">Waypoints by Mission</h2>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={pathLengthByMission}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="mission" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="waypoints" fill="#22c55e" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Mission Table */}
          <div className="bg-white rounded-2xl shadow">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="font-medium">Detailed Missions</h2>
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  placeholder="Search missions..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-3 pr-3 py-1 border rounded-md text-sm focus:ring focus:ring-blue-200"
                />
                <button
                  onClick={() => {
                    const blob = new Blob(
                      [JSON.stringify(filteredTable, null, 2)],
                      { type: "application/json" }
                    )
                    const url = URL.createObjectURL(blob)
                    const a = document.createElement("a")
                    a.href = url
                    a.download = "missions-report.json"
                    a.click()
                  }}
                  className="px-3 py-1 text-sm bg-blue-600 text-white rounded-md"
                >
                  Export
                </button>
              </div>
            </div>
            <div className="p-4 overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b text-gray-600">
                    <th className="py-2">Mission</th>
                    <th>Status</th>
                    <th>Created</th>
                    <th>Waypoints</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTable.map((m, i) => (
                    <tr key={i} className="border-b hover:bg-gray-50">
                      <td className="py-2">{m.name || m._id}</td>
                      <td>{m.status}</td>
                      <td>{m.createdAt ? new Date(m.createdAt).toLocaleString() : "â€”"}</td>
                      <td>{m.flightPath?.length || 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}