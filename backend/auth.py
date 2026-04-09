"""
PriceIQ — Auth Service
JWT authentication + email verification + password reset + profile completion
"""

from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, EmailStr, Field
from typing import Optional
from datetime import datetime, timedelta
from passlib.context import CryptContext
import jwt
import os
import secrets
import smtplib
from email.mime.text import MIMEText
from db import db

router = APIRouter(prefix="/auth", tags=["auth"])
security = HTTPBearer()

SECRET_KEY  = os.getenv("JWT_SECRET", "priceiq-secret-change-in-prod")
ALGORITHM   = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 24 * 7  # 7 days

# Email config — set these env vars in production
SMTP_HOST     = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT     = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER     = os.getenv("SMTP_USER", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
APP_BASE_URL  = os.getenv("APP_BASE_URL", "http://localhost:5173")

pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Profile fields that count toward "completion"
PROFILE_COMPLETION_FIELDS = [
    "first_name", "last_name", "store_name",
    "category", "phone", "website", "gstin", "bio",
]


# ── Schemas ───────────────────────────────────────────────────────────────────

class SignupRequest(BaseModel):
    first_name: str = Field(..., min_length=1, max_length=50)
    last_name:  str = Field("", max_length=50)
    email:      EmailStr
    password:   str = Field(..., min_length=6)
    store_name: str = Field(..., min_length=1, max_length=100)
    category:   Optional[str] = ""
    phone:      Optional[str] = ""


class LoginRequest(BaseModel):
    email:    EmailStr
    password: str


class UpdateProfileRequest(BaseModel):
    first_name:    Optional[str]  = None
    last_name:     Optional[str]  = None
    store_name:    Optional[str]  = None
    category:      Optional[str]  = None
    phone:         Optional[str]  = None
    website:       Optional[str]  = None
    gstin:         Optional[str]  = None
    bio:           Optional[str]  = None
    notifications: Optional[bool] = None


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token:        str
    new_password: str = Field(..., min_length=6)


class VerifyEmailRequest(BaseModel):
    token: str


class TokenResponse(BaseModel):
    access_token: str
    token_type:   str = "bearer"
    user:         dict


# ── Helpers ───────────────────────────────────────────────────────────────────

def hash_password(password: str) -> str:
    # bcrypt silently truncates at 72 bytes
    return pwd_ctx.hash(password[:72])


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_ctx.verify(plain[:72], hashed)


def create_token(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "exp": datetime.utcnow() + timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS),
        "iat": datetime.utcnow(),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def compute_profile_completion(user: dict) -> int:
    """
    US2 — profile completion tracking.
    Returns 0-100 based on how many profile fields are filled.
    """
    filled = sum(
        1 for f in PROFILE_COMPLETION_FIELDS
        if user.get(f) and str(user[f]).strip()
    )
    return round((filled / len(PROFILE_COMPLETION_FIELDS)) * 100)


def user_to_dict(user: dict) -> dict:
    """Strip sensitive fields and add completion score before returning to client."""
    return {
        "id":                   str(user["_id"]),
        "first_name":           user.get("first_name", ""),
        "last_name":            user.get("last_name", ""),
        "email":                user["email"],
        "email_verified":       user.get("email_verified", False),
        "store_name":           user.get("store_name", ""),
        "category":             user.get("category", ""),
        "phone":                user.get("phone", ""),
        "website":              user.get("website", ""),
        "gstin":                user.get("gstin", ""),
        "bio":                  user.get("bio", ""),
        "notifications":        user.get("notifications", True),
        "plan":                 user.get("plan", "free"),
        "api_calls_remaining":  user.get("api_calls_remaining", 100),
        "products_analyzed":    user.get("products_analyzed", 0),
        # US2: profile completion percentage
        "profile_completion":   compute_profile_completion(user),
        "created_at": (
            user["created_at"].isoformat()
            if isinstance(user.get("created_at"), datetime)
            else str(user.get("created_at", ""))
        ),
    }


# ── Email sending ─────────────────────────────────────────────────────────────

def _send_email(to: str, subject: str, body: str):
    """
    Send a plain-text email via SMTP.
    Silently logs if SMTP is not configured (dev mode).
    """
    if not SMTP_USER or not SMTP_PASSWORD:
        # Dev mode — print to console instead of sending
        print(f"\n[DEV EMAIL] To: {to}\nSubject: {subject}\n{body}\n")
        return
    try:
        msg = MIMEText(body)
        msg["Subject"] = subject
        msg["From"]    = SMTP_USER
        msg["To"]      = to
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=10) as server:
            server.starttls()
            server.login(SMTP_USER, SMTP_PASSWORD)
            server.sendmail(SMTP_USER, [to], msg.as_string())
    except Exception as e:
        # Non-fatal — log but don't crash the request
        print(f"[EMAIL ERROR] Failed to send to {to}: {e}")


def send_verification_email(email: str, token: str):
    """US1 — email verification."""
    link = f"{APP_BASE_URL}/verify-email?token={token}"
    _send_email(
        to=email,
        subject="Verify your PriceIQ account",
        body=(
            f"Hi,\n\nPlease verify your email address by clicking the link below:\n\n"
            f"{link}\n\n"
            f"This link expires in 24 hours.\n\n"
            f"If you did not create a PriceIQ account, you can ignore this email.\n\n"
            f"— The PriceIQ Team"
        ),
    )


def send_password_reset_email(email: str, token: str):
    """US1 — password reset."""
    link = f"{APP_BASE_URL}/reset-password?token={token}"
    _send_email(
        to=email,
        subject="Reset your PriceIQ password",
        body=(
            f"Hi,\n\nYou requested a password reset. Click the link below:\n\n"
            f"{link}\n\n"
            f"This link expires in 1 hour. If you did not request this, ignore this email.\n\n"
            f"— The PriceIQ Team"
        ),
    )


# ── JWT dependency ────────────────────────────────────────────────────────────

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    from bson import ObjectId
    token = credentials.credentials
    try:
        payload  = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id  = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

    user = await db.users.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


# ── Routes ────────────────────────────────────────────────────────────────────

@router.post("/signup", response_model=TokenResponse, status_code=201)
async def signup(req: SignupRequest, background_tasks: BackgroundTasks):
    existing = await db.users.find_one({"email": req.email.lower()})
    if existing:
        raise HTTPException(status_code=409, detail="Email already registered")

    # US1: generate email verification token
    verification_token = secrets.token_urlsafe(32)

    user_doc = {
        "first_name":          req.first_name.strip(),
        "last_name":           req.last_name.strip(),
        "email":               req.email.lower(),
        "password_hash":       hash_password(req.password),
        "store_name":          req.store_name.strip(),
        "category":            req.category or "",
        "phone":               req.phone or "",
        "website":             "",
        "gstin":               "",
        "bio":                 "",
        "notifications":       True,
        "plan":                "free",
        "api_calls_remaining": 100,
        "products_analyzed":   0,
        # US1: email verification
        "email_verified":            False,
        "email_verification_token":  verification_token,
        "email_verification_sent_at": datetime.utcnow(),
        "created_at":  datetime.utcnow(),
        "updated_at":  datetime.utcnow(),
    }

    result       = await db.users.insert_one(user_doc)
    user_doc["_id"] = result.inserted_id

    # Send verification email in the background so signup response is fast
    background_tasks.add_task(
        send_verification_email, req.email.lower(), verification_token
    )

    token = create_token(str(result.inserted_id))
    return TokenResponse(access_token=token, user=user_to_dict(user_doc))


@router.post("/login", response_model=TokenResponse)
async def login(req: LoginRequest):
    user = await db.users.find_one({"email": req.email.lower()})
    # US1: invalid login shows error
    if not user or not verify_password(req.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token = create_token(str(user["_id"]))
    return TokenResponse(access_token=token, user=user_to_dict(user))


@router.post("/verify-email")
async def verify_email(req: VerifyEmailRequest):
    """US1 — confirm email address from the link sent on signup."""
    user = await db.users.find_one({"email_verification_token": req.token})
    if not user:
        raise HTTPException(status_code=400, detail="Invalid or expired verification token")

    # Token expires after 24 hours
    sent_at = user.get("email_verification_sent_at")
    if sent_at and (datetime.utcnow() - sent_at).total_seconds() > 86400:
        raise HTTPException(status_code=400, detail="Verification link has expired — please request a new one")

    await db.users.update_one(
        {"_id": user["_id"]},
        {"$set": {
            "email_verified":           True,
            "email_verification_token": None,
            "updated_at":               datetime.utcnow(),
        }},
    )
    return {"message": "Email verified successfully"}


@router.post("/resend-verification")
async def resend_verification(
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user),
):
    """US1 — resend verification email if the user lost the original."""
    if current_user.get("email_verified"):
        return {"message": "Email is already verified"}

    new_token = secrets.token_urlsafe(32)
    await db.users.update_one(
        {"_id": current_user["_id"]},
        {"$set": {
            "email_verification_token":   new_token,
            "email_verification_sent_at": datetime.utcnow(),
        }},
    )
    background_tasks.add_task(
        send_verification_email, current_user["email"], new_token
    )
    return {"message": "Verification email resent"}


@router.post("/forgot-password")
async def forgot_password(req: ForgotPasswordRequest, background_tasks: BackgroundTasks):
    """US1 — request a password reset link."""
    user = await db.users.find_one({"email": req.email.lower()})
    # Always return 200 to avoid leaking which emails exist
    if not user:
        return {"message": "If that email is registered, a reset link has been sent"}

    reset_token = secrets.token_urlsafe(32)
    await db.users.update_one(
        {"_id": user["_id"]},
        {"$set": {
            "password_reset_token":    reset_token,
            "password_reset_sent_at":  datetime.utcnow(),
        }},
    )
    background_tasks.add_task(
        send_password_reset_email, user["email"], reset_token
    )
    return {"message": "If that email is registered, a reset link has been sent"}


@router.post("/reset-password")
async def reset_password(req: ResetPasswordRequest):
    """US1 — set a new password using the token from the reset email."""
    user = await db.users.find_one({"password_reset_token": req.token})
    if not user:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")

    # Token expires after 1 hour
    sent_at = user.get("password_reset_sent_at")
    if sent_at and (datetime.utcnow() - sent_at).total_seconds() > 3600:
        raise HTTPException(status_code=400, detail="Reset link has expired — please request a new one")

    await db.users.update_one(
        {"_id": user["_id"]},
        {"$set": {
            "password_hash":        hash_password(req.new_password),
            "password_reset_token": None,
            "updated_at":           datetime.utcnow(),
        }},
    )
    return {"message": "Password reset successfully — please log in"}


@router.get("/me")
async def get_me(current_user: dict = Depends(get_current_user)):
    return user_to_dict(current_user)


@router.patch("/profile")
async def update_profile(
    req: UpdateProfileRequest,
    current_user: dict = Depends(get_current_user),
):
    """US2 — edit business info; returns updated profile with completion score."""
    updates = {k: v for k, v in req.model_dump().items() if v is not None}
    updates["updated_at"] = datetime.utcnow()

    await db.users.update_one({"_id": current_user["_id"]}, {"$set": updates})
    updated = await db.users.find_one({"_id": current_user["_id"]})
    return user_to_dict(updated)


@router.post("/logout")
async def logout(current_user: dict = Depends(get_current_user)):
    # JWT is stateless — client drops the token
    return {"message": "Logged out successfully"}