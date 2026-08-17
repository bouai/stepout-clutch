"""Login endpoints: request a magic link, verify it, and inspect the session."""

from fastapi import APIRouter, Depends, Header
from sqlalchemy.orm import Session

from app import auth, models, schemas
from app.database import get_db

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/request-link", response_model=schemas.RequestLinkResult)
def request_link(payload: schemas.RequestLink, db: Session = Depends(get_db)):
    """Start login for an email.

    A token is always created. With an email provider configured it would be
    mailed; without one (local/dev), the token is returned so the caller can
    complete login immediately — there is no inbox to check.
    """
    token = auth.create_login_token(db, payload.email)

    if auth.EMAIL_ENABLED:
        # A real sender would deliver the link here; intentionally not built yet.
        return schemas.RequestLinkResult(sent=True, email_enabled=True)

    return schemas.RequestLinkResult(
        sent=False, email_enabled=False, dev_token=token.token
    )


@router.post("/verify", response_model=schemas.AuthSession)
def verify(payload: schemas.VerifyToken, db: Session = Depends(get_db)):
    user = auth.consume_login_token(db, payload.token)
    session = auth.create_session(db, user)
    return schemas.AuthSession(session_token=session.token, user=user)


@router.get("/me", response_model=schemas.User)
def me(user: models.User = Depends(auth.get_current_user)):
    return user


@router.post("/logout", status_code=204)
def logout(
    _user: models.User = Depends(auth.get_current_user),
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
):
    # get_current_user has already validated the bearer token; drop that session
    # row so the token can no longer be used.
    token = (authorization or "")[len("bearer ") :].strip()
    session = db.get(models.Session, token)
    if session is not None:
        db.delete(session)
        db.commit()
