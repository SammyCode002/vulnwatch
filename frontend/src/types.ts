export interface Finding {
  id: string;
  scan_id: string;
  ip: string;
  port: number;
  protocol: string;
  service: string | null;
  state: "open" | "filtered" | "closed";
}

export interface Scan {
  id: string;
  started_at: string;
  completed_at: string | null;
  target_subnet: string;
  hosts_found: number;
  status: "completed" | "running" | "failed";
  findings?: Finding[];
}

export interface Target {
  id: string;
  ip: string;
  hostname: string | null;
  os: string | null;
  first_seen: string;
  last_seen: string;
}

export interface Stats {
  total_devices: number;
  total_open_ports: number;
  total_filtered: number;
  total_scans: number;
  last_scan_at: string | null;
}
