import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Finding, Target } from "../types";

const MONO = "'JetBrains Mono', monospace";

interface Props {
  findings: Finding[];
  targets: Target[];
}

export default function PortChart({ findings, targets }: Props) {
  console.log("[PortChart] render — findings=%d", findings.length);

  const hostnameByIp = Object.fromEntries(targets.map((t) => [t.ip, t.hostname ?? t.ip]));

  const countByIp: Record<string, number> = {};
  for (const f of findings) {
    if (f.state === "open") {
      countByIp[f.ip] = (countByIp[f.ip] ?? 0) + 1;
    }
  }

  const data = Object.entries(countByIp)
    .map(([ip, count]) => ({ device: hostnameByIp[ip] ?? ip, count }))
    .sort((a, b) => b.count - a.count);

  if (data.length === 0) return null;

  return (
    <div
      className="vw-card"
      style={{ padding: "16px 20px", animation: "fadeIn 0.4s ease" }}
    >
      <div
        style={{
          fontSize: 11,
          color: "#64748b",
          textTransform: "uppercase",
          letterSpacing: "1px",
          fontFamily: MONO,
          marginBottom: 14,
        }}
      >
        Open ports per device
      </div>
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={data} margin={{ top: 0, right: 8, bottom: 0, left: -16 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
          <XAxis
            dataKey="device"
            tick={{ fill: "#64748b", fontSize: 11, fontFamily: MONO }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: "#64748b", fontSize: 11, fontFamily: MONO }}
            axisLine={false}
            tickLine={false}
            allowDecimals={false}
          />
          <Tooltip
            contentStyle={{
              background: "#111827",
              border: "1px solid #1e293b",
              borderRadius: 6,
              fontFamily: MONO,
              fontSize: 12,
              color: "#e2e8f0",
            }}
            itemStyle={{ color: "#00ff88" }}
            cursor={{ fill: "rgba(0,255,136,0.05)" }}
          />
          <Bar dataKey="count" fill="#00ff88" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
