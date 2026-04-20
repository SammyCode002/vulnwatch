import type { Finding, Target } from "../types";
import StateBadge from "./StateBadge";

const MONO = "'JetBrains Mono', monospace";

interface Props {
  targets: Target[];
  findings: Finding[];
  /** IPs seen for the first time in the latest scan */
  newIps: Set<string>;
}

export default function DevicesTable({ targets, findings, newIps }: Props) {
  console.log("[DevicesTable] render — targets=%d newIps=%d", targets.length, newIps.size);

  const openCountByIp: Record<string, number> = {};
  for (const f of findings) {
    if (f.state === "open") {
      openCountByIp[f.ip] = (openCountByIp[f.ip] ?? 0) + 1;
    }
  }

  const headers = ["IP address", "Hostname", "OS", "Open ports", "First seen", "Status"];

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
          {targets.length === 0 && (
            <tr>
              <td
                colSpan={6}
                style={{ padding: "24px 16px", color: "#475569", textAlign: "center", fontFamily: MONO, fontSize: 12 }}
              >
                No devices found yet
              </td>
            </tr>
          )}
          {targets.map((t) => (
            <tr key={t.id} className="vw-row">
              <td style={{ padding: "10px 16px", fontFamily: MONO, fontSize: 12, color: "#94a3b8" }}>
                {t.ip}
                {newIps.has(t.ip) && (
                  <span
                    title="New device — first time seen"
                    style={{
                      marginLeft: 8,
                      fontSize: 9,
                      padding: "1px 6px",
                      borderRadius: 3,
                      background: "rgba(0,255,136,0.12)",
                      color: "#00ff88",
                      border: "1px solid rgba(0,255,136,0.3)",
                      fontFamily: MONO,
                      textTransform: "uppercase",
                      letterSpacing: "0.5px",
                    }}
                  >
                    new
                  </span>
                )}
              </td>
              <td style={{ padding: "10px 16px", fontSize: 12, color: "#e2e8f0" }}>
                {t.hostname ?? "—"}
              </td>
              <td style={{ padding: "10px 16px", fontSize: 12, color: "#64748b" }}>
                {t.os ?? "Unknown"}
              </td>
              <td style={{ padding: "10px 16px", fontFamily: MONO, fontSize: 12, color: "#00ff88" }}>
                {openCountByIp[t.ip] ?? 0}
              </td>
              <td style={{ padding: "10px 16px", fontSize: 12, color: "#64748b" }}>
                {new Date(t.first_seen).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </td>
              <td style={{ padding: "10px 16px" }}>
                <StateBadge state="open" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
