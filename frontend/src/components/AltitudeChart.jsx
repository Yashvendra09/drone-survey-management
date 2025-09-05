// AltitudeChart.jsx
import React from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

export default function AltitudeChart({ history = [] }) {
  // history: array of { t, pos: {lat,lng,alt} }
  const data = history.map((h, i) => ({
    time: new Date(h.t).toLocaleTimeString(),
    alt: h.pos?.alt ?? (h.alt ?? 0)
  }));
  
  if (data.length === 0) return <div className="text-sm text-gray-500 p-2">No altitude data</div>;

  return (
    <div style={{ width: '100%', height: 160 }} className="bg-white p-2 rounded-lg shadow">
      <ResponsiveContainer>
        <LineChart data={data}>
          <XAxis dataKey="time" hide />
          <YAxis domain={['auto', 'auto']} />
          <Tooltip />
          <Line type="monotone" dataKey="alt" stroke="#2563eb" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
