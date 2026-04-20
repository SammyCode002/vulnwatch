import { useState, useEffect, useCallback, useRef } from 'react'
import {
  fetchStats,
  fetchScans,
  fetchTargets,
  fetchScan,
  triggerScan,
} from './api'
import type { Finding, Scan, Stats, Target } from './types'
import StatCards from './components/StatCards'
import FindingsTable from './components/FindingsTable'
import DevicesTable from './components/DevicesTable'
import ScanHistory from './components/ScanHistory'
import PortChart from './components/PortChart'
import './App.css'

const MONO = "'JetBrains Mono', monospace"

type Tab = 'findings' | 'devices' | 'history'

const TABS: { id: Tab; label: string }[] = [
  { id: 'findings', label: 'Latest Findings' },
  { id: 'devices',  label: 'Devices' },
  { id: 'history',  label: 'Scan History' },
]

export default function App() {
  const [stats, setStats]               = useState<Stats | null>(null)
  const [scans, setScans]               = useState<Scan[]>([])
  const [latestFindings, setLatestFindings] = useState<Finding[]>([])
  const [targets, setTargets]           = useState<Target[]>([])
  const [tab, setTab]                   = useState<Tab>('findings')
  const [scanning, setScanning]         = useState(false)
  const [error, setError]               = useState<string | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const loadAll = useCallback(async () => {
    console.log('[App] loadAll start')
    try {
      const [statsData, scansData, targetsData] = await Promise.all([
        fetchStats(),
        fetchScans(),
        fetchTargets(),
      ])
      setStats(statsData)
      setScans(scansData)
      setTargets(targetsData)

      if (scansData.length > 0) {
        const latest = await fetchScan(scansData[0].id)
        setLatestFindings(latest.findings ?? [])
        console.log('[App] latest scan findings=%d', latest.findings?.length ?? 0)
      } else {
        setLatestFindings([])
      }

      setError(null)
      console.log('[App] loadAll done — scans=%d targets=%d', scansData.length, targetsData.length)
    } catch (err) {
      console.error('[App] loadAll error', err)
      setError('Could not reach the VulnWatch API. Make sure the backend is running on port 8000.')
    }
  }, [])

  useEffect(() => { loadAll() }, [loadAll])

  useEffect(() => {
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [])

  const handleRunScan = async () => {
    if (scanning) return
    console.log('[App] run scan triggered')
    setScanning(true)
    setError(null)

    try {
      const res = await triggerScan()
      console.log('[App] trigger response', res)
    } catch (err) {
      console.error('[App] trigger error', err)
      setError('Failed to start scanner. Check that nmap is installed and the terminal is running as Administrator.')
      setScanning(false)
      return
    }

    // Poll every 3s until a new scan appears
    const previousCount = scans.length
    pollRef.current = setInterval(async () => {
      try {
        const updated = await fetchScans()
        console.log('[App] poll — scans=%d previous=%d', updated.length, previousCount)
        if (updated.length > previousCount) {
          clearInterval(pollRef.current!)
          pollRef.current = null
          setScanning(false)
          await loadAll()
        }
      } catch {
        // keep polling
      }
    }, 3000)
  }

  // target lookup for FindingsTable
  const targetMap: Record<string, { hostname: string | null; os: string | null }> = {}
  for (const t of targets) {
    targetMap[t.ip] = { hostname: t.hostname, os: t.os }
  }

  // IPs whose first_seen falls within the latest scan window
  const newIps = new Set<string>()
  if (scans.length > 0) {
    const latestStarted = scans[0].started_at
    for (const t of targets) {
      if (t.first_seen >= latestStarted) newIps.add(t.ip)
    }
  }

  const lastScanLabel = stats?.last_scan_at
    ? new Date(stats.last_scan_at).toLocaleString('en-US', {
        month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true,
      })
    : 'Never'

  const subnet = scans[0]?.target_subnet ?? '—'

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px 48px' }}>

      {/* ── Header ─────────────────────────────────────────────────── */}
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '20px 0 24px',
          borderBottom: '1px solid #1e293b',
          marginBottom: 24,
        }}
      >
        <div>
          <div style={{ fontFamily: MONO, fontSize: 22, fontWeight: 700, color: '#e2e8f0' }}>
            <span style={{ color: '#00ff88' }}>{'>'}</span> VulnWatch
          </div>
          <div style={{ fontFamily: MONO, fontSize: 11, color: '#475569', marginTop: 3, letterSpacing: '0.5px' }}>
            subnet: {subnet}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontFamily: MONO, fontSize: 11, color: '#475569', letterSpacing: '0.5px' }}>last scan</div>
            <div style={{ fontFamily: MONO, fontSize: 12, color: '#64748b', marginTop: 2 }}>{lastScanLabel}</div>
          </div>
          <button
            onClick={handleRunScan}
            disabled={scanning}
            style={{
              background: scanning ? 'transparent' : 'rgba(0,255,136,0.08)',
              border: '1px solid rgba(0,255,136,0.30)',
              color: scanning ? '#475569' : '#00ff88',
              fontFamily: MONO,
              fontSize: 12,
              padding: '8px 18px',
              borderRadius: 6,
              cursor: scanning ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s',
              letterSpacing: '0.5px',
            }}
          >
            {scanning ? '[ scanning... ]' : '[ run scan ]'}
          </button>
        </div>
      </header>

      {/* ── Error banner ────────────────────────────────────────────── */}
      {error && (
        <div
          style={{
            background: 'rgba(255,82,82,0.08)',
            border: '1px solid rgba(255,82,82,0.25)',
            borderRadius: 6,
            padding: '10px 16px',
            marginBottom: 20,
            fontFamily: MONO,
            fontSize: 12,
            color: '#ff5252',
          }}
        >
          {error}
        </div>
      )}

      {/* ── Stat cards ──────────────────────────────────────────────── */}
      <StatCards stats={stats} />

      {/* ── Port chart ──────────────────────────────────────────────── */}
      {latestFindings.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <PortChart findings={latestFindings} targets={targets} />
        </div>
      )}

      {/* ── Tabs ────────────────────────────────────────────────────── */}
      <div style={{ marginTop: 24 }}>
        <div
          style={{
            display: 'flex',
            gap: 4,
            borderBottom: '1px solid #1e293b',
            marginBottom: 16,
          }}
        >
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                background: 'none',
                border: 'none',
                borderBottom: tab === t.id ? '2px solid #00ff88' : '2px solid transparent',
                color: tab === t.id ? '#e2e8f0' : '#475569',
                fontFamily: MONO,
                fontSize: 12,
                padding: '8px 16px',
                cursor: 'pointer',
                letterSpacing: '0.5px',
                transition: 'color 0.15s',
                marginBottom: -1,
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'findings' && (
          <FindingsTable findings={latestFindings} targets={targetMap} />
        )}
        {tab === 'devices' && (
          <DevicesTable targets={targets} findings={latestFindings} newIps={newIps} />
        )}
        {tab === 'history' && (
          <ScanHistory scans={scans} />
        )}
      </div>
    </div>
  )
}
