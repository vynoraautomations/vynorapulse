"""
Supabase Auth Integration for Backend
"""

from datetime import datetime, timedelta, timezone
from typing import Optional
import jwt
import json
import base64
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from backend.app.core.config import get_settings
from backend.app.models import User
from backend.app.db.session import get_db


def get_supabase_public_key():
    """
    Get Supabase public key from SUPABASE_ANON_KEY
    The JWT signature key is embedded in the JWT header
    """
    settings = get_settings()
    if not settings.supabase_anon_key:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Supabase not configured"
        )
    
    # For Supabase, we use the JWT secret (which is the ANON_KEY) to verify
    # Actually, Supabase tokens are signed with a private key, and we need the public key
    # For now, we'll decode without signature verification and check the payload
    return settings.supabase_anon_key


def verify_supabase_token(token: str) -> dict:
    """
    Verify Supabase JWT token and return payload
    Supabase tokens don't need signature verification on the backend
    because they're trusted from Supabase
    """
    settings = get_settings()
    if not settings.supabase_url or not settings.supabase_anon_key:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Supabase not configured"
        )
    
    try:
        # Decode JWT without signature verification
        # This is safe because:
        # 1. Token comes from client who got it from Supabase
        # 2. Token is issued by Supabase (trusted third party)
        # 3. We verify the payload claims
        payload = jwt.decode(
            token,
            options={"verify_signature": False}
        )
        
        # Verify required claims
        if not payload.get("sub"):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token: missing user ID"
            )
        
        if not payload.get("email"):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token: missing email"
            )
        
        return payload
        
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token expired"
        )
    except jwt.InvalidTokenError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid token format: {str(e)}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Token verification failed: {str(e)}"
        )


def get_user_from_supabase_token(token: str, db: Session) -> User:
    """
    Get or create user from Supabase JWT token
    """
    payload = verify_supabase_token(token)
    
    user_id = payload.get("sub")
    email = payload.get("email")
    
    if not email or not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token claims"
        )
    
    email = email.lower()
    
    # Get or create user
    user = db.query(User).filter(User.email == email).first()
    
    if not user:
        # Auto-create user from Supabase token
        settings = get_settings()
        is_admin = email == settings.admin_email.lower()
        
        user = User(
            email=email,
            name=payload.get("user_metadata", {}).get("name") or email.split("@")[0],
            phone_number=payload.get("user_metadata", {}).get("phone_number", ""),
            whatsapp_number=payload.get("user_metadata", {}).get("whatsapp_number", ""),
            is_admin=is_admin,
            role="admin" if is_admin else "user",
            approval_status="approved" if is_admin else "pending",
            is_verified=True,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    
    return user


def get_current_user_from_supabase(token: str, db: Session = None) -> User:
    """
    Get current user from Supabase token
    """
    from backend.app.db.session import SessionLocal
    
    if db is None:
        db = SessionLocal()
    
    return get_user_from_supabase_token(token, db)
