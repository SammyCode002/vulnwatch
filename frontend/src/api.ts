import axios from "axios";
import type { Finding, Scan, Stats, Target } from "./types";

const client = axios.create({
  baseURL: "http://localhost:8000",
  timeout: 15_000,
});

client.interceptors.request.use((config) => {
  console.log("[api] request", config.method?.toUpperCase(), config.url);
  return config;
});

client.interceptors.response.use(
  (res) => {
    console.log("[api] response", res.status, res.config.url);
    return res;
  },
  (err) => {
    console.error("[api] error", err.config?.url, err.message);
    return Promise.reject(err);
  }
);

export async function fetchStats(): Promise<Stats> {
  const { data } = await client.get<Stats>("/api/stats");
  return data;
}

export async function fetchScans(): Promise<Scan[]> {
  const { data } = await client.get<Scan[]>("/api/scans");
  return data;
}

export async function fetchScan(id: string): Promise<Scan> {
  const { data } = await client.get<Scan>(`/api/scans/${id}`);
  return data;
}

export async function fetchTargets(): Promise<Target[]> {
  const { data } = await client.get<Target[]>("/api/targets");
  return data;
}

export async function fetchTargetHistory(ip: string): Promise<Finding[]> {
  const { data } = await client.get<Finding[]>(`/api/targets/${ip}`);
  return data;
}

export async function triggerScan(): Promise<{ status: string; message: string }> {
  const { data } = await client.post("/api/scans/trigger");
  return data;
}
