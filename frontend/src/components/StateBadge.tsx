import type { Finding } from "../types";

const COLORS: Record<string, { bg: string; border: string; text: string }> = {
  open: {
    bg: "rgba(0,255,136,0.10)",
    border: "rgba(0,255,136,0.30)",
    text: "#00ff88",
  },
  filtered: {
    bg: "rgba(255,183,77,0.10)",
    border: "rgba(255,183,77,0.30)",
    text: "#ffb74d",
  },
  closed: {
    bg: "rgba(255,82,82,0.10)",
    border: "rgba(255,82,82,0.30)",
    text: "#ff5252",
  },
  flagged: {
    bg: "rgba(255,82,82,0.15)",
    border: "rgba(255,82,82,0.50)",
    text: "#ff5252",
  },
};

interface Props {
  state: Finding["state"] | "flagged" | string;
}

export default function StateBadge({ state }: Props) {
  const c = COLORS[state] ?? COLORS.closed;
  return (
    <span
      style={{
        background: c.bg,
        color: c.text,
        border: `1px solid ${c.border}`,
        padding: "2px 10px",
        borderRadius: 4,
        fontSize: 11,
        fontFamily: "'JetBrains Mono', monospace",
        letterSpacing: "0.5px",
        textTransform: "uppercase",
      }}
    >
      {state}
    </span>
  );
}
