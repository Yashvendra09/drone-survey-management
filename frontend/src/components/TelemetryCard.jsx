// frontend/src/components/TelemetryCard.jsx
import React from 'react';

export default function TelemetryCard({ telemetry = {}, drone = {} }) {
  const battery = telemetry.battery ?? drone?.batteryLevel;
  const alt = telemetry.alt;
  const speed = telemetry.speed;
  const lastSeen = telemetry.lastSeen;

  const fmt = (v, suffix = '') =>
    (v === 0 || (v !== null && v !== undefined))
      ? `${Math.round(v)}${suffix}`
      : '-';

  return (
    <div className="bg-white rounded-lg shadow p-3 text-sm space-y-1">
      <div className="font-medium">Telemetry</div>
      <div className="grid grid-cols-2 gap-2">
        <div className="text-gray-500">Battery</div>
        <div className="text-right">
          {battery !== null && battery !== undefined ? `${Math.round(battery)}%` : '-'}
        </div>

        <div className="text-gray-500">Altitude</div>
        <div className="text-right">{fmt(alt, ' m')}</div>

        <div className="text-gray-500">Speed</div>
        <div className="text-right">{fmt(speed, ' m/s')}</div>

        <div className="text-gray-500">Last seen</div>
        <div className="text-right">
          {lastSeen ? new Date(lastSeen).toLocaleTimeString() : '-'}
        </div>
      </div>
    </div>
  );
}
