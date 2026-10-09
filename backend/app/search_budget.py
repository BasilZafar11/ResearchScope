"""Claim a provider attempt before sending any paid search request."""
from datetime import datetime, timezone
from sqlalchemy import update
from sqlalchemy.dialects.postgresql import insert as postgres_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert

from app.config import settings
from app.db.session import Session
from app.models.novelty import NoveltyDailyBudget


class DailySearchLimit(Exception):
    pass


def claim_provider_attempt():
    day = datetime.now(timezone.utc).date().isoformat()
    limit = max(0, settings.hosted_serpapi_daily_budget - settings.hosted_serpapi_reserve)
    with Session.begin() as db:
        insert = sqlite_insert if db.bind.dialect.name == 'sqlite' else postgres_insert
        db.execute(insert(NoveltyDailyBudget).values(day_utc=day, calls_reserved=0, calls_used=0)
                   .on_conflict_do_nothing(index_elements=['day_utc']))
        claimed = db.execute(update(NoveltyDailyBudget)
                             .where(NoveltyDailyBudget.day_utc == day,
                                    NoveltyDailyBudget.calls_used < limit)
                             .values(calls_used=NoveltyDailyBudget.calls_used + 1))
        if claimed.rowcount != 1:
            raise DailySearchLimit('The daily search allowance is exhausted. Try again after the UTC daily reset.')
