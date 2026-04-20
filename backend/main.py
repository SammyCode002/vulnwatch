"""
VulnWatch FastAPI backend.

Routes:
    POST  /api/scans           — save scanner results
    POST  /api/scans/trigger   — spawn scanner subprocess
    GET   /api/scans           — list all scans (newest first)
    GET   /api/scans/{id}      — scan detail with findings
    GET   /api/targets         — all discovered devices
    GET   /api/targets/{ip}    — device history
    GET   /api/stats           — dashboard summary
"""

import logging
import os
import subprocess
import sys
from contextlib import asynccontextmanager
from datetime import datetime, timezone

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address
from sqlalchemy.orm import Session

import database as db
import schemas

load_dotenv()

logging.basicConfig(
    level=logging.DEBUG,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("vulnwatch.api")

DEFAULT_SUBNET = os.getenv("DEFAULT_SUBNET", "192.168.1.0/24")

limiter = Limiter(key_func=get_remote_address)


@asynccontextmanager
async def lifespan(app: FastAPI):
    db.init_db()
    logger.info("VulnWatch API started")
    yield
    logger.info("VulnWatch API stopped")


app = FastAPI(title="VulnWatch API", version="1.0.0", lifespan=lifespan)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# POST /api/scans
# ---------------------------------------------------------------------------

@app.post("/api/scans", response_model=schemas.ScanOut, status_code=201)
@limiter.limit("60/minute")
def create_scan(
    request: Request,
    payload: schemas.ScanCreate,
    session: Session = Depends(db.get_db),
):
    """
    Accept scan results from the scanner and persist them.

    Args:
        payload: Full scan data including findings and targets

    Returns:
        The created Scan with all findings
    """
    logger.info(
        "POST /api/scans — subnet=%s hosts=%d findings=%d",
        payload.target_subnet,
        payload.hosts_found,
        len(payload.findings),
    )

    now = datetime.now(timezone.utc).astimezone().isoformat(timespec="seconds")

    # Upsert targets
    for t in payload.targets:
        existing = session.query(db.Target).filter_by(ip=t.ip).first()
        if existing:
            existing.last_seen = now
            if t.hostname:
                existing.hostname = t.hostname
            if t.os:
                existing.os = t.os
            logger.debug("Updated target %s", t.ip)
        else:
            session.add(db.Target(
                ip=t.ip,
                hostname=t.hostname,
                os=t.os,
                first_seen=now,
                last_seen=now,
            ))
            logger.debug("New target %s", t.ip)

    # Create scan
    scan = db.Scan(
        started_at=payload.started_at,
        completed_at=payload.completed_at,
        target_subnet=payload.target_subnet,
        hosts_found=payload.hosts_found,
        status=payload.status,
    )
    session.add(scan)
    session.flush()  # get scan.id before adding findings

    for f in payload.findings:
        session.add(db.Finding(
            scan_id=scan.id,
            ip=f.ip,
            port=f.port,
            protocol=f.protocol,
            service=f.service,
            state=f.state,
        ))

    session.commit()
    session.refresh(scan)
    logger.info("Scan saved — id=%s", scan.id)
    return scan


# ---------------------------------------------------------------------------
# POST /api/scans/trigger
# ---------------------------------------------------------------------------

@app.post("/api/scans/trigger", response_model=schemas.TriggerResponse)
@limiter.limit("5/minute")
async def trigger_scan(request: Request):
    """
    Spawn the scanner subprocess so the dashboard can trigger a scan.

    The scanner runs in the background and POSTs its results back to this API.
    """
    logger.info("POST /api/scans/trigger — spawning scanner subprocess")

    python = sys.executable
    scanner_path = os.path.join(os.path.dirname(__file__), "scanner.py")

    if not os.path.exists(scanner_path):
        raise HTTPException(status_code=500, detail="scanner.py not found")

    try:
        # subprocess.Popen works on all platforms; asyncio.create_subprocess_exec
        # requires ProactorEventLoop on Windows which uvicorn doesn't use by default.
        proc = subprocess.Popen(
            [python, scanner_path, "--target", DEFAULT_SUBNET],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        logger.info("Scanner subprocess started — pid=%s", proc.pid)
    except Exception as exc:
        logger.error("Failed to spawn scanner: %s", exc)
        raise HTTPException(status_code=500, detail=f"Could not start scanner: {exc}") from exc

    return schemas.TriggerResponse(
        status="started",
        message=f"Scanner started for {DEFAULT_SUBNET} — poll /api/scans for results",
    )


# ---------------------------------------------------------------------------
# GET /api/scans
# ---------------------------------------------------------------------------

@app.get("/api/scans", response_model=list[schemas.ScanListItem])
@limiter.limit("120/minute")
def list_scans(
    request: Request,
    session: Session = Depends(db.get_db),
):
    """Return all scans ordered newest first."""
    scans = (
        session.query(db.Scan)
        .order_by(db.Scan.started_at.desc())
        .all()
    )
    logger.debug("GET /api/scans — returning %d scans", len(scans))
    return scans


# ---------------------------------------------------------------------------
# GET /api/scans/{scan_id}
# ---------------------------------------------------------------------------

@app.get("/api/scans/{scan_id}", response_model=schemas.ScanOut)
@limiter.limit("120/minute")
def get_scan(
    scan_id: str,
    request: Request,
    session: Session = Depends(db.get_db),
):
    """Return a single scan with all its findings."""
    scan = session.query(db.Scan).filter_by(id=scan_id).first()
    if not scan:
        raise HTTPException(status_code=404, detail="Scan not found")
    logger.debug("GET /api/scans/%s — %d findings", scan_id, len(scan.findings))
    return scan


# ---------------------------------------------------------------------------
# GET /api/targets
# ---------------------------------------------------------------------------

@app.get("/api/targets", response_model=list[schemas.TargetOut])
@limiter.limit("120/minute")
def list_targets(
    request: Request,
    session: Session = Depends(db.get_db),
):
    """Return all known devices ordered by last_seen descending."""
    targets = (
        session.query(db.Target)
        .order_by(db.Target.last_seen.desc())
        .all()
    )
    logger.debug("GET /api/targets — returning %d targets", len(targets))
    return targets


# ---------------------------------------------------------------------------
# GET /api/targets/{ip}
# ---------------------------------------------------------------------------

@app.get("/api/targets/{ip:path}", response_model=list[schemas.FindingOut])
@limiter.limit("120/minute")
def get_target_history(
    ip: str,
    request: Request,
    session: Session = Depends(db.get_db),
):
    """Return all findings for a specific IP across all scans."""
    findings = (
        session.query(db.Finding)
        .filter_by(ip=ip)
        .order_by(db.Finding.scan_id.desc())
        .all()
    )
    logger.debug("GET /api/targets/%s — %d findings", ip, len(findings))
    return findings


# ---------------------------------------------------------------------------
# GET /api/stats
# ---------------------------------------------------------------------------

@app.get("/api/stats", response_model=schemas.StatsOut)
@limiter.limit("120/minute")
def get_stats(
    request: Request,
    session: Session = Depends(db.get_db),
):
    """Return dashboard summary statistics."""
    total_devices = session.query(db.Target).count()
    total_open_ports = session.query(db.Finding).filter_by(state="open").count()
    total_filtered = session.query(db.Finding).filter_by(state="filtered").count()
    total_scans = session.query(db.Scan).count()

    latest_scan = (
        session.query(db.Scan)
        .filter_by(status="completed")
        .order_by(db.Scan.started_at.desc())
        .first()
    )

    stats = schemas.StatsOut(
        total_devices=total_devices,
        total_open_ports=total_open_ports,
        total_filtered=total_filtered,
        total_scans=total_scans,
        last_scan_at=latest_scan.started_at if latest_scan else None,
    )

    logger.debug(
        "GET /api/stats — devices=%d open=%d filtered=%d scans=%d",
        total_devices, total_open_ports, total_filtered, total_scans,
    )
    return stats
