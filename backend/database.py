"""SQLAlchemy models and SQLite connection for VulnWatch."""

import logging
import uuid
from sqlalchemy import (
    Column, ForeignKey, Integer, String, create_engine, event
)
from sqlalchemy.engine import Engine
from sqlalchemy.orm import DeclarativeBase, relationship, sessionmaker

logger = logging.getLogger(__name__)

DATABASE_URL = "sqlite:///./vulnwatch.db"

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


@event.listens_for(Engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    """Enable foreign key enforcement for each SQLite connection."""
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()


class Target(Base):
    """A discovered network device, upserted on each scan."""

    __tablename__ = "targets"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    ip = Column(String, unique=True, nullable=False, index=True)
    hostname = Column(String, nullable=True)
    os = Column(String, nullable=True)
    first_seen = Column(String, nullable=False)
    last_seen = Column(String, nullable=False)


class Scan(Base):
    """One nmap scan run."""

    __tablename__ = "scans"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    started_at = Column(String, nullable=False)
    completed_at = Column(String, nullable=True)
    target_subnet = Column(String, nullable=False)
    hosts_found = Column(Integer, default=0)
    status = Column(String, default="running")

    findings = relationship("Finding", back_populates="scan", cascade="all, delete-orphan")


class Finding(Base):
    """A single open/filtered port found on a device during a scan."""

    __tablename__ = "findings"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    scan_id = Column(String, ForeignKey("scans.id"), nullable=False, index=True)
    ip = Column(String, nullable=False)
    port = Column(Integer, nullable=False)
    protocol = Column(String, default="tcp")
    service = Column(String, nullable=True)
    state = Column(String, default="open")

    scan = relationship("Scan", back_populates="findings")


def get_db():
    """Yield a database session and close it when done."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """Create all tables if they don't exist."""
    Base.metadata.create_all(bind=engine)
    logger.info("Database initialized — all tables ready")
