export default function StatCard({ title, value, subtitle }) {
    return (
      <div className="bg-white rounded-2xl shadow p-5">
        <div className="text-gray-500 text-sm">{title}</div>
        <div className="text-3xl font-semibold mt-1">{value}</div>
        {subtitle && <div className="text-gray-400 text-xs mt-2">{subtitle}</div>}
      </div>
    )
  }
  