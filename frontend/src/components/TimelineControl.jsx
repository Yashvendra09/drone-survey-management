// TimelineControl.jsx
import React, { useEffect, useMemo, useState, useRef } from 'react';

export default function TimelineControl({ history = [], onSeek = () => {}, initialSpeed = 1 }) {
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(initialSpeed);
  const rafRef = useRef(null);
  const lastTsRef = useRef(null);

  // clamp
  const maxIndex = Math.max(0, history.length - 1);

  useEffect(() => {
    // reset index when history changes
    setIndex(history.length ? history.length - 1 : 0);
  }, [history.length]);

  useEffect(() => {
    onSeek(history[index]);
  }, [index, history, onSeek]);

  useEffect(() => {
    if (!playing) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      return;
    }

    let prev = performance.now();
    const step = () => {
      const now = performance.now();
      const dt = (now - prev) / 1000; // seconds
      prev = now;

      // advance index based on speed (speed = x realtime speed)
      // Compute fraction: we move one index per (1/speed) * base seconds (approx)
      // Use a simple accumulator approach:
      lastTsRef.current = (lastTsRef.current || 0) + dt * speed;
      const incrementEvery = 0.5; // seconds per history step at speed=1
      const steps = Math.floor(lastTsRef.current / incrementEvery);
      if (steps > 0) {
        lastTsRef.current -= steps * incrementEvery;
        setIndex((i) => Math.min(maxIndex, i + steps));
      }

      rafRef.current = requestAnimationFrame(step);
    };

    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [playing, speed, maxIndex]);

  const handleSeek = (e) => {
    const v = Number(e.target.value);
    setIndex(v);
    setPlaying(false);
  };

  return (
    <div className="p-3 border rounded-lg bg-white flex items-center gap-3">
      <button
        onClick={() => setPlaying(p => !p)}
        className="px-3 py-1 rounded bg-blue-600 text-white text-xs"
      >{playing ? 'Pause' : 'Play'}</button>

      <input
        type="range"
        min={0}
        max={maxIndex}
        value={index}
        onChange={handleSeek}
        className="flex-1"
      />

      <div className="flex items-center gap-2 text-xs">
        <div>Speed</div>
        <select value={speed} onChange={(e)=>setSpeed(Number(e.target.value))} className="text-sm border px-2 py-1 rounded">
          <option value={0.5}>0.5x</option>
          <option value={1}>1x</option>
          <option value={2}>2x</option>
          <option value={4}>4x</option>
        </select>
      </div>
    </div>
  );
}
