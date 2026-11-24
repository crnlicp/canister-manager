import { useId } from "react";
import type { Point } from "../bindings/backend";
import { cycles } from "../lib/format";

export function Sparkline({
  points,
  warning = false,
}: {
  points: Point[];
  warning?: boolean;
}) {
  if (points.length < 2)
    return <span className="muted small">Awaiting samples</span>;
  const values = points.map((point) => Number(point.cycles));
  const min = Math.min(...values);
  const max = Math.max(...values);
  const path = values
    .map(
      (value, i) =>
        `${(i * 96) / (values.length - 1)},${26 - ((value - min) / (max - min || 1)) * 22}`,
    )
    .join(" ");
  return (
    <svg
      className={`sparkline ${warning ? "warning" : ""}`}
      viewBox="0 0 96 30"
      preserveAspectRatio="none"
      aria-label="Cycle balance trend"
      role="img"
    >
      <polyline
        points={path}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        vectorEffect="non-scaling-stroke"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function CycleChart({ points }: { points: Point[] }) {
  const gradient = useId().replace(/:/g, "");
  if (points.length < 2)
    return (
      <div className="chart-empty">
        <span className="empty-orbit">◎</span>
        <strong>Your story starts with a snapshot.</strong>
        <p>
          Refresh a canister twice, at least a minute apart, to see its cycle
          history here.
        </p>
      </div>
    );
  const values = points.map((point) => Number(point.cycles) / 1e12);
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  const padding = Math.max((rawMax - rawMin) * 0.3, rawMax * 0.005, 0.005);
  const min = Math.max(0, rawMin - padding);
  const max = rawMax + padding;
  const first = Number(points[0].at / 1_000_000n);
  const last = Number(points[points.length - 1].at / 1_000_000n);
  const xy = points.map((point, i) => ({
    x:
      60 +
      ((Number(point.at / 1_000_000n) - first) / (last - first || 1)) * 680,
    y: 170 - ((values[i] - min) / (max - min)) * 150,
  }));
  const line = xy
    .map((point, i) => `${i ? "L" : "M"}${point.x},${point.y}`)
    .join(" ");
  const date = (timestamp: number) =>
    new Date(timestamp).toLocaleString([], {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  return (
    <div className="cycle-chart">
      <svg
        viewBox="0 0 760 215"
        role="img"
        aria-label={`Cycle balance: ${cycles(points[0].cycles)} to ${cycles(points[points.length - 1].cycles)}, ${points.length} recorded samples`}
      >
        <defs>
          <linearGradient id={gradient} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#b5edcb" stopOpacity=".19" />
            <stop offset="100%" stopColor="#b5edcb" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 1, 2, 3].map((i) => (
          <g key={i}>
            <line
              x1="60"
              x2="740"
              y1={20 + i * 50}
              y2={20 + i * 50}
              stroke="white"
              strokeOpacity=".065"
              strokeDasharray="3 5"
            />
            <text x="0" y={24 + i * 50} fill="#7f8e98" fontSize="11">
              {(max - (i / 3) * (max - min)).toFixed(2)} T
            </text>
          </g>
        ))}
        <path d={`${line} L740,175 L60,175 Z`} fill={`url(#${gradient})`} />
        <path
          d={line}
          fill="none"
          stroke="#b5edcb"
          strokeWidth="2.3"
          strokeLinejoin="round"
        />
        {xy.map((point, i) => (
          <circle
            key={i}
            cx={point.x}
            cy={point.y}
            r={i === xy.length - 1 ? 4 : 3}
            fill="#b5edcb"
            opacity={i === xy.length - 1 ? 1 : 0.15}
          >
            <title>
              {date(Number(points[i].at / 1_000_000n))}:{" "}
              {points[i].cycles.toLocaleString()} cycles
            </title>
          </circle>
        ))}
        <text x="60" y="205" fill="#7f8e98" fontSize="11">
          {date(first)}
        </text>
        <text x="740" y="205" fill="#7f8e98" fontSize="11" textAnchor="end">
          {date(last)}
        </text>
      </svg>
    </div>
  );
}
