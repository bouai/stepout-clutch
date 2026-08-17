"""Authentication: magic-link login and bearer-token sessions.

Deliberately email-provider-agnostic. Locally, no email is sent — the magic
link is returned in the request-link response so a developer (or the app in dev
mode) can complete login without an inbox. Setting an email sender via
`EMAIL_SENDER` (a future hook) is all that stands between this and production.
"""

import os
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import Depends, Header, HTTPException
from sqlalchemy.orm import Session as DbSession

from app import models
from app.database import get_db

LOGIN_TOKEN_TTL = timedelta(minutes=15)

# When no email provider is configured the API runs in "dev auth" mode and hands
# the magic link straight back to the caller. A real deployment sets this.
EMAIL_ENABLED = bool(os.getenv("EMAIL_SENDER"))


def _new_token() -> str:
    return secrets.token_urlsafe(32)


def create_login_token(db: DbSession, email: str) -> models.LoginToken:
    token = models.LoginToken(
        token=_new_token(),
        email=email.strip().lower(),
        expires_at=datetime.now(timezone.utc) + LOGIN_TOKEN_TTL,
    )
    db.add(token)
    db.commit()
    db.refresh(token)
    return token


def consume_login_token(db: DbSession, token: str) -> models.User:
    """Validate a magic-link token and return (creating) its user.

    A token is single-use and time-limited; the user record is created on first
    successful login, so "register" and "log in" are the same action.
    """
    record = db.get(models.LoginToken, token)
    now = datetime.now(timezone.utc)
    # SQLite hands datetimes back naive; compare in the same space.
    expires = record.expires_at if record else None
    if expires is not None and expires.tzinfo is None:
        expires = expires.replace(tzinfo=timezone.utc)

    if record is None or record.consumed or expires < now:
        raise HTTPException(status_code=400, detail="Invalid or expired login link")

    record.consumed = True

    user = db.query(models.User).filter(models.User.email == record.email).first()
    if user is None:
        user = models.User(email=record.email)
        db.add(user)
        db.flush()

    db.commit()
    db.refresh(user)
    return user


def create_session(db: DbSession, user: models.User) -> models.Session:
    session = models.Session(token=_new_token(), user_id=user.id)
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


def get_current_user(
    authorization: str | None = Header(default=None),
    db: DbSession = Depends(get_db),
) -> models.User:
    """Resolve the bearer token to a user, or 401.

    Every data endpoint depends on this, so an unauthenticated request can never
    see or touch another account's trips.
    """
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")

    token = authorization[len("bearer ") :].strip()
    session = db.get(models.Session, token)
    if session is None:
        raise HTTPException(status_code=401, detail="Session expired")

    user = db.get(models.User, session.user_id)
    if user is None:
        raise HTTPException(status_code=401, detail="Session expired")
    return user
