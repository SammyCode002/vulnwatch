import type { Scan } from "../types";

const MONO = "'JetBrains Mono', monospace";

interface Props {
  scans: Scan[];
}

function StatusBadge({ status }: { status: string }) {
  const ok = status === "completed";
  return (
    <span
      style={{
        background: ok ? "rgba(0,255,136,0.08)" : "rgba(255,82,82,0.08)",
        color: ok ? "#00ff88" : "#ff5252",
        border: `1px solid ${ok ? "rgba(0,255,136,0.25)" : "rgba(255,82,82,0.25)"}`,
        padding: "2px 10px",
        borderRadius: 4,
        fontSize: 11,
        fontFamily: MONO,
        textTransform: "uppercase",
      }}
    >
      {status}
    </span>
  );
}

export default function ScanHistory({ scans }: Props) {
  console.log("[ScanHistory] render — scans=%d", scans.length);

  const headers = ["Scan ID", "Timestamp", "Subnet", "Hosts", "Status"];

  return (
    <div className="vw-card" style={{ overflow: "hidden", animation: "fadeIn 0.3s ease" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr style={{ borderBottom: "1px solid #1e293b" }}>
            {headers.map((h) => (
              <th
                key={h}
                style={{
                  textAlign: "left",
                  padding: "10px 16px",
                  fontWeight: 500,
                  color: "#475569",
                  fontSize: 11,
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                  fontFamily: MONO,
                }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {scans.length === 0 && (
            <tr>
              <td
                colSpan={5}
                style={{ padding: "24px 16px", color: "#475569", textAlign: "center", fontFamily: MONO, fontSize: 12 }}
              >
                No scans yet
              </td>
            </tr>
          )}
          {scans.map((scan) => (
            <tr key={scan.id} className="vw-row">
              <td style={{ padding: "10px 16px", fontFamily: MONO, fontSize: 11, color: "#64748b" }}>
                {scan.id.slice(0, 8)}
              </td>
              <td style={{ padding: "10px 16px", fontSize: 12, color: "#94a3b8" }}>
                {new Date(scan.started_at).toLocaleString("en-US", {
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                  hour12: true,
                })}
              </td>
              <td style={{ padding: "10px 16px", fontFamily: MONO, fontSize: 12, color: "#64748b" }}>
                {scan.target_subnet}
              </td>
              <td style={{ padding: "10px 16px", fontFamily: MONO, fontSize: 12, color: "#e2e8f0" }}>
                {scan.hosts_found}
              </td>
              <td style={{ padding: "10px 16px" }}>
                <StatusBadge status={scan.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
