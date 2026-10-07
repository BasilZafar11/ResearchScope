import os
import tempfile
from pathlib import Path
os.environ['LIVE_SERPAPI_ENABLED'] = 'false'
os.environ['DATABASE_URL'] = 'sqlite:///' + str(Path(tempfile.mkdtemp()) / 'tests.db')

import pytest
from fastapi.testclient import TestClient
from app.db.session import engine
from app.models.database import Base
from app.main import app, hits

PUNE = dict(business_category='Coworking space', city='Pune', country='India', keywords=['coworking Pune', 'shared office Pune', 'flexible office Pune'], known_competitors=['WeWork', 'Awfis'])


@pytest.fixture(autouse=True)
def database():
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    hits.clear()
    yield


@pytest.fixture
def client():
    with TestClient(app) as client:
        yield client
