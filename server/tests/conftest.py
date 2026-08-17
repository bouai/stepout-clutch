import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.main import app

TEST_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db


@pytest.fixture(autouse=True)
def _reset_db():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


def _login(test_client: TestClient, email: str) -> str:
    """Complete the dev magic-link flow and return a session token."""
    token = test_client.post("/auth/request-link", json={"email": email}).json()[
        "devToken"
    ]
    return test_client.post("/auth/verify", json={"token": token}).json()["sessionToken"]


@pytest.fixture
def client():
    """An authenticated client — every data endpoint now requires a user, so the
    existing tests operate as one default account without each needing to log in.
    """
    with TestClient(app) as test_client:
        session_token = _login(test_client, "tester@example.com")
        test_client.headers.update({"Authorization": f"Bearer {session_token}"})
        yield test_client


@pytest.fixture
def other_client():
    """A second authenticated account, for cross-user isolation tests."""
    with TestClient(app) as test_client:
        session_token = _login(test_client, "other@example.com")
        test_client.headers.update({"Authorization": f"Bearer {session_token}"})
        yield test_client
