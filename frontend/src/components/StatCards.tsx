import type { Stats } from "../types";

const MONO = "'JetBrains Mono', monospace";

interface Props {
  stats: Stats | null;
}

export default function StatCards({ stats }: Props) {
  console.log("[StatCards] render", stats);

  const cards = [
    { label: "devices", value: stats?.total_devices ?? "—", accent: "#00ff88" },
    { label: "open ports", value: stats?.total_open_ports ?? "—", accent: "#00ff88" },
    { label: "filtered", value: stats?.total_filtered ?? "—", accent: "#ffb74d" },
    { label: "total scans", value: stats?.total_scans ?? "—", accent: "#64748b" },
  ];

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
        gap: 12,
        animation: "fadeIn 0.4s ease",
      }}
    >
      {cards.map((card) => (
        <div
          key={card.label}
          className="vw-card"
          style={{ padding: "16px 20px" }}
        >
          <div
            style={{
              fontSize: 11,
              color: "#64748b",
              textTransform: "uppercase",
              letterSpacing: "1px",
              fontFamily: MONO,
              marginBottom: 6,
            }}
          >
            {card.label}
          </div>
          <div
            style={{
              fontSize: 28,
              fontWeight: 700,
              color: card.accent,
              fontFamily: MONO,
              lineHeight: 1,
            }}
          >
            {card.value}
          </div>
        </div>
      ))}
    </div>
  );
}
