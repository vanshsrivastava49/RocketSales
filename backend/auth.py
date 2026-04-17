"""
RocketSales — Auth Service
JWT authentication + OTP email verification + OTP password reset + profile completion

FIXES:
  ✅ Replaced URL-based tokens with 6-digit OTPs for email verification
  ✅ Replaced URL-based tokens with 6-digit OTPs for password resets
  ✅ OTP expiration enforced at 15 minutes (900 seconds)
  ✅ Load .env explicitly to ensure SMTP credentials load correctly
"""

from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, EmailStr, Field
from typing import Optional
from datetime import datetime, timedelta, timezone
from passlib.context import CryptContext
import jwt
import os
import secrets
import smtplib
import traceback
from email.mime.text import MIMEText
from db import db

# ✅ FIX: Load the .env file explicitly before reading the variables
from dotenv import load_dotenv
load_dotenv()

router   = APIRouter(prefix="/auth", tags=["auth"])
security = HTTPBearer()

SECRET_KEY                  = os.getenv("JWT_SECRET", "priceiq-secret-change-in-prod")
ALGORITHM                   = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS   = 24 * 7   # 7 days

SMTP_HOST     = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT     = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER     = os.getenv("SMTP_USER", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
SMTP_FROM     = os.getenv("SMTP_FROM", SMTP_USER)
APP_BASE_URL  = os.getenv("APP_BASE_URL", "http://localhost:5173")

pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")

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
    email:        EmailStr
    otp:          str = Field(..., min_length=6, max_length=6)
    new_password: str = Field(..., min_length=6)


class VerifyEmailRequest(BaseModel):
    email: EmailStr
    otp:   str = Field(..., min_length=6, max_length=6)


class TokenResponse(BaseModel):
    access_token: str
    token_type:   str = "bearer"
    user:         dict


# ── Helpers ───────────────────────────────────────────────────────────────────

def generate_otp(length: int = 6) -> str:
    """Generate a secure numeric OTP."""
    return "".join(secrets.choice("0123456789") for _ in range(length))


def hash_password(password: str) -> str:
    return pwd_ctx.hash(password[:72])


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_ctx.verify(plain[:72], hashed)


def create_token(user_id: str) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user_id,
        "exp": now + timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS),
        "iat": now,
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def compute_profile_completion(user: dict) -> int:
    filled = sum(
        1 for f in PROFILE_COMPLETION_FIELDS
        if user.get(f) and str(user[f]).strip()
    )
    return round((filled / len(PROFILE_COMPLETION_FIELDS)) * 100)


def user_to_dict(user: dict) -> dict:
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
        "profile_completion":   compute_profile_completion(user),
        "created_at": (
            user["created_at"].isoformat()
            if isinstance(user.get("created_at"), datetime)
            else str(user.get("created_at", ""))
        ),
    }


# ── Email sending ─────────────────────────────────────────────────────────────

def _send_email(to: str, subject: str, body: str):
    if not SMTP_USER or not SMTP_PASSWORD:
        print(f"\n[DEV EMAIL] To: {to}\nSubject: {subject}\n{body}\n")
        print(
            "[DEV EMAIL] ⚠️  Not sent — SMTP_USER or SMTP_PASSWORD not set in .env\n"
            "            Make sure .env has SMTP_PASSWORD (not SMTP_PASS) and\n"
            f"            SMTP_HOST={SMTP_HOST!r} (must be smtp.gmail.com, not your email address)"
        )
        return

    try:
        msg = MIMEText(body, "plain", "utf-8")
        msg["Subject"] = subject
        msg["From"]    = SMTP_FROM
        msg["To"]      = to

        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=15) as server:
            server.ehlo()
            server.starttls()
            server.ehlo()
            server.login(SMTP_USER, SMTP_PASSWORD)
            server.sendmail(SMTP_USER, [to], msg.as_string())

        print(f"[EMAIL] ✅ Sent to {to} — {subject!r}")

    except smtplib.SMTPAuthenticationError:
        print(
            f"[EMAIL] ❌ SMTPAuthenticationError sending to {to}\n"
            "  → If using Gmail, make sure you're using an App Password (not your login password).\n"
            "  → Generate one at: https://myaccount.google.com/apppasswords\n"
            f"  SMTP_HOST={SMTP_HOST!r}  SMTP_USER={SMTP_USER!r}"
        )
    except smtplib.SMTPConnectError:
        print(
            f"[EMAIL] ❌ SMTPConnectError — could not connect to {SMTP_HOST}:{SMTP_PORT}\n"
            "  → Check SMTP_HOST in .env (must be 'smtp.gmail.com', not your email address)"
        )
    except Exception:
        print(f"[EMAIL] ❌ Failed to send to {to}:\n{traceback.format_exc()}")


def send_verification_email(email: str, otp: str):
    _send_email(
        to=email,
        subject="Your RocketSales Verification Code",
        body=(
            f"Hi,\n\n"
            f"Your verification code is: {otp}\n\n"
            f"Please enter this code in the app to verify your email address.\n"
            f"This code expires in 15 minutes.\n\n"
            f"— The RocketSales Team"
        ),
    )


def send_password_reset_email(email: str, otp: str):
    _send_email(
        to=email,
        subject="Reset your RocketSales password",
        body=(
            f"Hi,\n\n"
            f"You requested a password reset. Your reset code is: {otp}\n\n"
            f"Please enter this code in the app to reset your password.\n"
            f"This code expires in 15 minutes. If you didn't request this, ignore this email.\n\n"
            f"— The RocketSales Team"
        ),
    )


# ── JWT dependency ────────────────────────────────────────────────────────────

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    from bson import ObjectId
    token = credentials.credentials
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
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

    verification_otp = generate_otp()
    now = datetime.now(timezone.utc)

    user_doc = {
        "first_name":                 req.first_name.strip(),
        "last_name":                  req.last_name.strip(),
        "email":                      req.email.lower(),
        "password_hash":              hash_password(req.password),
        "store_name":                 req.store_name.strip(),
        "category":                   req.category or "",
        "phone":                      req.phone or "",
        "website":                    "",
        "gstin":                      "",
        "bio":                        "",
        "notifications":              True,
        "plan":                       "free",
        "api_calls_remaining":        100,
        "products_analyzed":          0,
        "email_verified":             False,
        "email_verification_otp":     verification_otp,
        "email_verification_sent_at": now,
        "created_at":                 now,
        "updated_at":                 now,
    }

    result = await db.users.insert_one(user_doc)
    user_doc["_id"] = result.inserted_id

    background_tasks.add_task(send_verification_email, req.email.lower(), verification_otp)

    token = create_token(str(result.inserted_id))
    return TokenResponse(access_token=token, user=user_to_dict(user_doc))


@router.post("/login", response_model=TokenResponse)
async def login(req: LoginRequest):
    user = await db.users.find_one({"email": req.email.lower()})
    if not user or not verify_password(req.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    # Clear stale password reset OTP on login so it can't be used after the fact
    await db.users.update_one(
        {"_id": user["_id"]},
        {"$set": {
            "password_reset_otp": None,
            "updated_at": datetime.now(timezone.utc),
        }},
    )

    token = create_token(str(user["_id"]))
    return TokenResponse(access_token=token, user=user_to_dict(user))


@router.post("/verify-email")
async def verify_email(req: VerifyEmailRequest):
    user = await db.users.find_one({"email": req.email.lower()})
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    if user.get("email_verified"):
        return {"message": "Email is already verified"}

    stored_otp = user.get("email_verification_otp")
    if not stored_otp or stored_otp != req.otp:
        raise HTTPException(status_code=400, detail="Invalid verification code")

    sent_at = user.get("email_verification_sent_at")
    if sent_at:
        if sent_at.tzinfo is None:
            sent_at = sent_at.replace(tzinfo=timezone.utc)
        if (datetime.now(timezone.utc) - sent_at).total_seconds() > 900: # 15 minutes
            raise HTTPException(status_code=400, detail="Code has expired. Please request a new one.")

    await db.users.update_one(
        {"_id": user["_id"]},
        {"$set": {
            "email_verified":         True,
            "email_verification_otp": None,
            "updated_at":             datetime.now(timezone.utc),
        }},
    )
    return {"message": "Email verified successfully"}


@router.post("/resend-verification")
async def resend_verification(
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user),
):
    if current_user.get("email_verified"):
        return {"message": "Email is already verified"}

    new_otp = generate_otp()
    
    await db.users.update_one(
        {"_id": current_user["_id"]},
        {"$set": {
            "email_verification_otp":     new_otp,
            "email_verification_sent_at": datetime.now(timezone.utc),
        }},
    )
    
    background_tasks.add_task(send_verification_email, current_user["email"], new_otp)
    return {"message": "A new verification code has been sent"}


@router.post("/forgot-password")
async def forgot_password(req: ForgotPasswordRequest, background_tasks: BackgroundTasks):
    user = await db.users.find_one({"email": req.email.lower()})
    if not user:
        return {"message": "If that email is registered, a reset code has been sent"}

    reset_otp = generate_otp()
    await db.users.update_one(
        {"_id": user["_id"]},
        {"$set": {
            "password_reset_otp":     reset_otp,
            "password_reset_sent_at": datetime.now(timezone.utc),
        }},
    )
    background_tasks.add_task(send_password_reset_email, user["email"], reset_otp)
    return {"message": "If that email is registered, a reset code has been sent"}


@router.post("/reset-password")
async def reset_password(req: ResetPasswordRequest):
    user = await db.users.find_one({"email": req.email.lower()})
    if not user:
        raise HTTPException(status_code=400, detail="Invalid request")

    stored_otp = user.get("password_reset_otp")
    if not stored_otp or stored_otp != req.otp:
        raise HTTPException(status_code=400, detail="Invalid or expired reset code")

    sent_at = user.get("password_reset_sent_at")
    if sent_at:
        if sent_at.tzinfo is None:
            sent_at = sent_at.replace(tzinfo=timezone.utc)
        if (datetime.now(timezone.utc) - sent_at).total_seconds() > 900: # 15 minutes
            raise HTTPException(status_code=400, detail="Reset code has expired — please request a new one")

    await db.users.update_one(
        {"_id": user["_id"]},
        {"$set": {
            "password_hash":      hash_password(req.new_password),
            "password_reset_otp": None,
            "updated_at":         datetime.now(timezone.utc),
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
    updates = {k: v for k, v in req.model_dump().items() if v is not None}
    updates["updated_at"] = datetime.now(timezone.utc)

    await db.users.update_one({"_id": current_user["_id"]}, {"$set": updates})
    updated = await db.users.find_one({"_id": current_user["_id"]})
    return user_to_dict(updated)


@router.post("/logout")
async def logout(current_user: dict = Depends(get_current_user)):
    return {"message": "Logged out successfully"}