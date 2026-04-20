"""
VulnWatch Scanner — wraps nmap, parses results, POSTs to FastAPI.

Usage:
    py scanner.py                         # scan default subnet 192.168.1.0/24
    py scanner.py --target 10.0.0.0/24    # scan custom subnet
    py scanner.py --api http://localhost:8000  # custom API base URL
"""

import argparse
import logging
import sys
import time
from datetime import datetime, timezone

import httpx

# nmap import handled below with a friendly error
try:
    import nmap
except ImportError:
    print("[ERROR] python-nmap is not installed. Run: pip install python-nmap")
    sys.exit(1)

logging.basicConfig(
    level=logging.DEBUG,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("vulnwatch.scanner")

DEFAULT_SUBNET = "192.168.1.0/24"
DEFAULT_API = "http://localhost:8000"
NMAP_ARGS = "-sV -O --open"


def _now_iso() -> str:
    return datetime.now(timezone.utc).astimezone().isoformat(timespec="seconds")


def run_scan(target: str) -> dict:
    """
    Run an nmap scan against the target subnet.

    Args:
        target: CIDR subnet string, e.g. "192.168.1.0/24"

    Returns:
        Dict with keys: started_at, completed_at, hosts_found, findings, targets
    """
    logger.info("Starting scan — target=%s args=%s", target, NMAP_ARGS)
    started_at = _now_iso()
    t0 = time.perf_counter()

    nm = nmap.PortScanner()

    try:
        nm.scan(hosts=target, arguments=NMAP_ARGS)
    except nmap.PortScannerError as exc:
        logger.error("nmap failed: %s", exc)
        raise RuntimeError(
            "nmap scan failed. Make sure nmap is installed and you are running "
            "this terminal as Administrator (required for OS detection)."
        ) from exc

    elapsed = time.perf_counter() - t0
    completed_at = _now_iso()
    logger.info("Scan finished — %.1fs elapsed", elapsed)

    findings: list[dict] = []
    targets: list[dict] = []

    for ip in nm.all_hosts():
        host_info = nm[ip]
        state = host_info.state()

        if state != "up":
            logger.debug("Skipping host %s — state=%s", ip, state)
            continue

        # OS detection
        os_guess = None
        osmatch = host_info.get("osmatch", [])
        if osmatch:
            os_guess = osmatch[0].get("name")
            logger.debug("OS guess for %s: %s", ip, os_guess)

        # Hostname
        hostnames = host_info.hostname()
        hostname = hostnames if hostnames else None

        targets.append({"ip": ip, "hostname": hostname, "os": os_guess})
        logger.debug("Target: ip=%s hostname=%s os=%s", ip, hostname, os_guess)

        # Ports
        for proto in host_info.all_protocols():
            for port, port_data in host_info[proto].items():
                port_state = port_data.get("state", "unknown")
                service = port_data.get("name") or None

                if port_state not in ("open", "filtered"):
                    continue

                findings.append({
                    "ip": ip,
                    "port": port,
                    "protocol": proto,
                    "service": service,
                    "state": port_state,
                })
                logger.debug(
                    "Finding: %s:%s/%s service=%s state=%s",
                    ip, port, proto, service, port_state,
                )

    logger.info(
        "Parsed %d hosts, %d findings in %.1fs",
        len(targets), len(findings), elapsed,
    )

    return {
        "target_subnet": target,
        "started_at": started_at,
        "completed_at": completed_at,
        "hosts_found": len(targets),
        "status": "completed",
        "findings": findings,
        "targets": targets,
    }


def post_results(payload: dict, api_base: str) -> None:
    """
    POST scan results to the FastAPI backend.

    Args:
        payload: Scan result dict from run_scan()
        api_base: Base URL of the FastAPI server
    """
    url = f"{api_base}/api/scans"
    logger.info("POSTing results to %s — %d findings", url, len(payload["findings"]))

    try:
        with httpx.Client(timeout=30) as client:
            resp = client.post(url, json=payload)
            resp.raise_for_status()
            data = resp.json()
            logger.info("API accepted scan — id=%s", data.get("id"))
            print(f"\n✓ Scan saved — id: {data.get('id')}")
    except httpx.HTTPStatusError as exc:
        logger.error("API returned error: %s — %s", exc.response.status_code, exc.response.text)
        raise
    except httpx.RequestError as exc:
        logger.error("Could not reach API at %s: %s", url, exc)
        raise


def print_summary(payload: dict) -> None:
    """Print a human-readable scan summary to stdout."""
    print(f"\n{'='*50}")
    print(f"VulnWatch Scan Summary")
    print(f"{'='*50}")
    print(f"Subnet   : {payload['target_subnet']}")
    print(f"Started  : {payload['started_at']}")
    print(f"Finished : {payload['completed_at']}")
    print(f"Hosts    : {payload['hosts_found']}")
    print(f"Findings : {len(payload['findings'])}")
    print()

    if payload["targets"]:
        print("Devices found:")
        for t in payload["targets"]:
            print(f"  {t['ip']:18} {t.get('hostname') or '—':20} {t.get('os') or 'Unknown OS'}")

    print()
    if payload["findings"]:
        print(f"{'IP':18} {'Port':6} {'Proto':6} {'Service':14} {'State'}")
        print("-" * 60)
        for f in payload["findings"]:
            print(
                f"  {f['ip']:16} {f['port']:<6} {f['protocol']:<6} "
                f"{(f.get('service') or '—'):14} {f['state']}"
            )
    print()


def main() -> None:
    parser = argparse.ArgumentParser(description="VulnWatch network scanner")
    parser.add_argument(
        "--target",
        default=DEFAULT_SUBNET,
        help=f"Target subnet in CIDR notation (default: {DEFAULT_SUBNET})",
    )
    parser.add_argument(
        "--api",
        default=DEFAULT_API,
        help=f"FastAPI base URL (default: {DEFAULT_API})",
    )
    args = parser.parse_args()

    logger.info("VulnWatch scanner starting — target=%s api=%s", args.target, args.api)

    try:
        payload = run_scan(args.target)
    except RuntimeError as exc:
        print(f"\n[ERROR] {exc}")
        sys.exit(1)

    print_summary(payload)

    try:
        post_results(payload, args.api)
    except Exception as exc:
        print(f"\n[ERROR] Failed to post results: {exc}")
        sys.exit(1)


if __name__ == "__main__":
    main()
