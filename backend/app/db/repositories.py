from datetime import timedelta
from sqlalchemy import select
from app.models.database import Analysis, now


def active(db, fingerprint):
    return db.scalar(select(Analysis).where(Analysis.fingerprint == fingerprint, Analysis.status.in_(['queued', 'running'])))


def cached(db, fingerprint):
    return db.scalar(select(Analysis).where(Analysis.fingerprint == fingerprint, Analysis.status == 'complete', Analysis.completed_at >= now() - timedelta(hours=1)).order_by(Analysis.completed_at.desc()))
