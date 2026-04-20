import type { Finding } from "../types";
import StateBadge from "./StateBadge";

const MONO = "'JetBrains Mono', monospace";

// Services that warrant a visual flag — unknown device running these is suspicious
const SUSPICIOUS_SERVICES = new Set(["rtsp", "telnet", "vnc", "ftp", "rsh", "rlogin"]);

interface Props {
  findings: Finding[];
  targets: Record<string, { hostname: string | null; os: string | null }>;
}

export default function FindingsTable({ findings, targets }: Props) {
  console.log("[FindingsTable] render — findings=%d", findings.length);

  const rows = findings.map((f) => ({
    ...f,
    hostname: targets[f.ip]?.hostname ?? "—",
    os: targets[f.ip]?.os ?? "Unknown",
    flagged:
      f.state === "open" &&
      f.service &&
      SUSPICIOUS_SERVICES.has(f.service.toLowerCase()) &&
      !targets[f.ip]?.hostname,
  }));

  const headers = ["IP address", "Hostname", "Port", "Service", "State", "OS"];

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
          {rows.length === 0 && (
            <tr>
              <td
                colSpan={6}
                style={{ padding: "24px 16px", color: "#475569", textAlign: "center", fontFamily: MONO, fontSize: 12 }}
              >
                No findings — run a scan first
              </td>
            </tr>
          )}
          {rows.map((row) => (
            <tr key={row.id} className="vw-row">
              <td style={{ padding: "10px 16px", fontFamily: MONO, fontSize: 12, color: "#94a3b8" }}>
                {row.ip}
              </td>
              <td style={{ padding: "10px 16px", fontSize: 12, color: "#64748b" }}>
                {row.hostname}
              </td>
              <td style={{ padding: "10px 16px", fontFamily: MONO, fontSize: 12, color: "#e2e8f0" }}>
                {row.port}
              </td>
              <td style={{ padding: "10px 16px", fontFamily: MONO, fontSize: 12, color: "#94a3b8" }}>
                {row.service ?? "—"}
                {row.flagged && (
                  <span
                    title="Suspicious service on unknown device"
                    style={{ marginLeft: 6, color: "#ff5252", fontSize: 10 }}
                  >
                    ⚠
                  </span>
                )}
              </td>
              <td style={{ padding: "10px 16px" }}>
                <StateBadge state={row.flagged ? "flagged" : row.state} />
              </td>
              <td style={{ padding: "10px 16px", fontSize: 12, color: "#64748b" }}>
                {row.os}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
