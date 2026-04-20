# VulnWatch Design Spec

**Date:** April 19, 2026
**Author:** Samuel Dameg
**Status:** Approved

## Overview

VulnWatch is a local network vulnerability scanner with a web dashboard. It scans your home network for devices, open ports, and running services, stores results in a local database, and displays them in a cybersecurity-themed dashboard.

## Goals

- Scan a home network for devices, open ports, and OS fingerprints
- Store scan history locally for comparison over time
- Display results in a clean, modern dashboard
- Build a portfolio-worthy cybersecurity project for GitHub

## Non-Goals

- No cloud deployment (local only for now)
- No scheduled/automated scans (manual trigger only)
- No alerts or notifications
- No vulnerability/CVE lookups (port scan + OS detection only)

## Architecture

```
Scanner (Python + nmap)
    |
    v
FastAPI (localhost:8000)
    |
    v
SQLite (vulnwatch.db)
    ^
    |
React Dashboard (localhost:5173)
```

All components run on the user's Windows PC (LazyB). No external services.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Scanner | Python 3, python-nmap |
| API | FastAPI, uvicorn |
| Database | SQLite via SQLAlchemy |
| Dashboard | React, Vite, TypeScript, Tailwind CSS |
| Charts | Recharts |
| HTTP Client | Axios |

## Database Schema

### targets

| Column | Type | Notes |
|--------|------|-------|
| id | TEXT (UUID) | Primary key |
| ip | TEXT | Device IP address |
| hostname | TEXT (nullable) | Resolved hostname |
| os | TEXT (nullable) | Detected OS |
| first_seen | TEXT (ISO timestamp) | When device first appeared |
| last_seen | TEXT (ISO timestamp) | Most recent scan |

### scans

| Column | Type | Notes |
|--------|------|-------|
| id | TEXT (UUID) | Primary key |
| started_at | TEXT (ISO timestamp) | Scan start time |
| completed_at | TEXT (ISO timestamp) | Scan end time |
| target_subnet | TEXT | e.g. 192.168.1.0/24 |
| hosts_found | INTEGER | Devices discovered |
| status | TEXT | completed / failed |

### findings

| Column | Type | Notes |
|--------|------|-------|
| id | TEXT (UUID) | Primary key |
| scan_id | TEXT (UUID) | FK to scans |
| ip | TEXT | Device IP |
| port | INTEGER | Port number |
| protocol | TEXT | tcp / udp |
| service | TEXT | e.g. http, ssh, rdp |
| state | TEXT | open / closed / filtered |

## Scanner Design

### CLI interface

```
py scanner.py                        # Scans default subnet (192.168.1.0/24)
py scanner.py --target 10.0.0.0/24   # Scans custom subnet
```

### Scan process

1. Accept target subnet (default: 192.168.1.0/24)
2. Run nmap with `-sV -O` flags (service detection + OS detection)
3. Parse results into structured data
4. POST results to FastAPI endpoint
5. Print summary to terminal

### Requirements

- nmap must be installed on the system
- Terminal must run as Administrator (OS detection requires elevated privileges)

## API Design

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | /api/scans | Create a new scan with findings |
| GET | /api/scans | List all scans (newest first) |
| GET | /api/scans/{id} | Get scan details with findings |
| GET | /api/targets | List all discovered devices |
| GET | /api/targets/{ip} | Get device history across scans |
| GET | /api/stats | Dashboard summary stats |

### POST /api/scans request body

```json
{
  "target_subnet": "192.168.1.0/24",
  "started_at": "2026-04-19T09:42:00",
  "completed_at": "2026-04-19T09:43:12",
  "hosts_found": 6,
  "status": "completed",
  "findings": [
    {
      "ip": "192.168.1.1",
      "port": 80,
      "protocol": "tcp",
      "service": "http",
      "state": "open"
    }
  ],
  "targets": [
    {
      "ip": "192.168.1.1",
      "hostname": "router.local",
      "os": "Linux 5.x"
    }
  ]
}
```

### GET /api/stats response

```json
{
  "total_devices": 6,
  "total_open_ports": 12,
  "total_filtered": 2,
  "total_scans": 7,
  "last_scan_at": "2026-04-19T09:42:00"
}
```

## Dashboard Design

### Theme

- Dark background (#0a0e17)
- Primary accent: neon green (#00ff88)
- Warning: amber (#ffb74d)
- Danger: red (#ff5252)
- Data font: JetBrains Mono
- UI font: Inter

### Pages

**Main view (single page with tabs):**

1. Header: VulnWatch logo, subnet display, "Run scan" indicator
2. Stat cards: devices found, open ports, filtered ports, total scans
3. Tab: Latest findings (table of all ports from most recent scan)
4. Tab: Devices (grouped by device with hostname, OS, port count)
5. Tab: Scan history (past scans with timestamp, hosts, status)

### Dashboard features

- State badges: green (open), amber (filtered), red (flagged)
- Bar chart showing open ports per device (recharts)
- "New device" indicator when a device appears for the first time
- Suspicious service flagging (RTSP, telnet, etc. on unknown devices)
- Hover effects on table rows
- Fade-in animation on tab switch
- "Run scan" button triggers scanner via API endpoint

### Run scan flow (from dashboard)

1. User clicks "Run scan" on dashboard
2. Dashboard POSTs to FastAPI /api/scans/trigger
3. FastAPI spawns scanner as subprocess
4. Scanner runs nmap, POSTs results back to FastAPI
5. Dashboard polls /api/scans until new scan appears
6. Dashboard refreshes with new data

## Project Structure

```
vulnwatch/
├── backend/
│   ├── main.py              # FastAPI app, routes
│   ├── scanner.py            # nmap wrapper
│   ├── database.py           # SQLAlchemy models + connection
│   ├── schemas.py            # Pydantic request/response models
│   ├── requirements.txt
│   └── .env                  # (gitignored)
├── frontend/
│   ├── src/
│   │   ├── App.tsx
│   │   ├── api.ts            # Axios client
│   │   ├── components/
│   │   │   ├── StatCards.tsx
│   │   │   ├── FindingsTable.tsx
│   │   │   ├── DevicesTable.tsx
│   │   │   ├── ScanHistory.tsx
│   │   │   ├── PortChart.tsx
│   │   │   └── StateBadge.tsx
│   │   └── types.ts
│   ├── package.json
│   └── tailwind.config.ts
├── .gitignore
└── README.md
```

## Error Handling

- Scanner: catch nmap exceptions, log errors, POST failed status to API
- API: return proper HTTP status codes (400 for bad input, 500 for server errors)
- Dashboard: show error state if API is unreachable
- All components: 4x4 debug logging (inputs, outputs, timing, status) via Python logging module (backend) and console logs (frontend)

## Security Notes

- Local only, no public exposure
- nmap requires Administrator on Windows
- Only scan networks you own
- .env file gitignored
- No secrets in frontend code (no cloud keys needed)

## Future Enhancements (Post-MVP)

- Deploy dashboard to Vercel + Supabase (with auth + RLS)
- Scheduled scans via APScheduler
- Email/Discord alerts on new devices or port changes
- CVE lookup integration
- Export scan reports as PDF
