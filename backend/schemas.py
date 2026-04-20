"""Pydantic request/response models for VulnWatch API."""

from typing import List, Optional
from pydantic import BaseModel


class FindingIn(BaseModel):
    ip: str
    port: int
    protocol: str = "tcp"
    service: Optional[str] = None
    state: str = "open"


class TargetIn(BaseModel):
    ip: str
    hostname: Optional[str] = None
    os: Optional[str] = None


class ScanCreate(BaseModel):
    target_subnet: str
    started_at: str
    completed_at: Optional[str] = None
    hosts_found: int = 0
    status: str = "completed"
    findings: List[FindingIn] = []
    targets: List[TargetIn] = []


class FindingOut(BaseModel):
    id: str
    scan_id: str
    ip: str
    port: int
    protocol: str
    service: Optional[str]
    state: str

    model_config = {"from_attributes": True}


class ScanOut(BaseModel):
    id: str
    started_at: str
    completed_at: Optional[str]
    target_subnet: str
    hosts_found: int
    status: str
    findings: List[FindingOut] = []

    model_config = {"from_attributes": True}


class ScanListItem(BaseModel):
    id: str
    started_at: str
    completed_at: Optional[str]
    target_subnet: str
    hosts_found: int
    status: str

    model_config = {"from_attributes": True}


class TargetOut(BaseModel):
    id: str
    ip: str
    hostname: Optional[str]
    os: Optional[str]
    first_seen: str
    last_seen: str

    model_config = {"from_attributes": True}


class StatsOut(BaseModel):
    total_devices: int
    total_open_ports: int
    total_filtered: int
    total_scans: int
    last_scan_at: Optional[str]


class TriggerResponse(BaseModel):
    status: str
    message: str
