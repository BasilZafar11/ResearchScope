import uuid
from datetime import datetime, timezone

from sqlalchemy import JSON, DateTime, Float, ForeignKey, Index, Integer, String, Text, text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


def now():
    return datetime.now(timezone.utc)


def uid():
    return str(uuid.uuid4())


class Base(DeclarativeBase):
    pass


json_type = JSON().with_variant(JSONB, 'postgresql')
id_type = String(36).with_variant(UUID(as_uuid=False), 'postgresql')


class Analysis(Base):
    __tablename__ = 'analyses'
    id: Mapped[str] = mapped_column(id_type, primary_key=True, default=uid)
    fingerprint: Mapped[str] = mapped_column(String(64), index=True)
    business_category: Mapped[str] = mapped_column(String(80))
    city: Mapped[str] = mapped_column(String(80))
    country: Mapped[str] = mapped_column(String(80))
    keywords: Mapped[list] = mapped_column(json_type)
    known_competitors: Mapped[list] = mapped_column(json_type)
    status: Mapped[str] = mapped_column(String(20), default='queued')
    stage: Mapped[str] = mapped_column(String(30), default='queued')
    progress: Mapped[int] = mapped_column(Integer, default=0)
    overall_score: Mapped[int | None] = mapped_column(Integer)
    confidence_score: Mapped[int | None] = mapped_column(Integer)
    interpretation: Mapped[str | None] = mapped_column(String(40))
    recommendation: Mapped[dict] = mapped_column(json_type, default=dict)
    component_scores: Mapped[dict] = mapped_column(json_type, default=dict)
    warnings: Mapped[list] = mapped_column(json_type, default=list)
    sections: Mapped[dict] = mapped_column(json_type, default=dict)
    report: Mapped[dict | None] = mapped_column(json_type)
    error_message: Mapped[str | None] = mapped_column(Text)
    methodology_version: Mapped[str] = mapped_column(String(10), default='1.0')
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


Index('uq_active_fingerprint', Analysis.fingerprint, unique=True,
      postgresql_where=text("status IN ('queued', 'running')"),
      sqlite_where=text("status IN ('queued', 'running')"))


class Competitor(Base):
    __tablename__ = 'competitors'
    id: Mapped[str] = mapped_column(id_type, primary_key=True, default=uid)
    analysis_id: Mapped[str] = mapped_column(ForeignKey('analyses.id', ondelete='CASCADE'), index=True)
    serpapi_data_id: Mapped[str | None] = mapped_column(String(200))
    name: Mapped[str] = mapped_column(Text)
    business_type: Mapped[str | None] = mapped_column(Text)
    address: Mapped[str | None] = mapped_column(Text)
    latitude: Mapped[float | None] = mapped_column(Float)
    longitude: Mapped[float | None] = mapped_column(Float)
    rating: Mapped[float | None] = mapped_column(Float)
    review_count: Mapped[int] = mapped_column(Integer, default=0)
    price: Mapped[str | None] = mapped_column(Text)
    website: Mapped[str | None] = mapped_column(Text)
    rank: Mapped[int] = mapped_column(Integer)
    raw_subset: Mapped[dict] = mapped_column(json_type, default=dict)


class Signal(Base):
    __tablename__ = 'signals'
    id: Mapped[str] = mapped_column(id_type, primary_key=True, default=uid)
    analysis_id: Mapped[str] = mapped_column(ForeignKey('analyses.id', ondelete='CASCADE'), index=True)
    engine: Mapped[str] = mapped_column(String(80))
    signal_type: Mapped[str] = mapped_column(String(80))
    score: Mapped[float | None] = mapped_column(Float)
    payload: Mapped[dict] = mapped_column(json_type)
    status: Mapped[str] = mapped_column(String(30))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class Evidence(Base):
    __tablename__ = 'evidence'
    id: Mapped[str] = mapped_column(id_type, primary_key=True, default=uid)
    analysis_id: Mapped[str] = mapped_column(ForeignKey('analyses.id', ondelete='CASCADE'), index=True)
    competitor_id: Mapped[str | None] = mapped_column(ForeignKey('competitors.id', ondelete='SET NULL'))
    engine: Mapped[str] = mapped_column(String(80))
    evidence_type: Mapped[str] = mapped_column(String(40))
    title: Mapped[str] = mapped_column(Text)
    snippet: Mapped[str | None] = mapped_column(Text)
    source_name: Mapped[str | None] = mapped_column(Text)
    source_url: Mapped[str | None] = mapped_column(Text)
    published_at: Mapped[str | None] = mapped_column(String(80))
    details: Mapped[dict] = mapped_column('metadata', json_type, default=dict)
