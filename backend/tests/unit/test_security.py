import pytest
from datetime import datetime, timedelta
from app.core.security import (
    get_password_hash,
    verify_password,
    create_access_token,
    create_refresh_token,
    decode_token,
)


class TestPasswordHashing:
    """Test password hashing functions"""

    def test_password_hash_creates_hash(self):
        """Should create a hash from password"""
        password = "test_password_123"
        hashed = get_password_hash(password)
        
        assert hashed is not None
        assert hashed != password
        assert len(hashed) > 0

    def test_verify_password_with_correct_password(self):
        """Should verify correct password"""
        password = "test_password_123"
        hashed = get_password_hash(password)
        
        assert verify_password(password, hashed) is True

    def test_verify_password_with_wrong_password(self):
        """Should reject wrong password"""
        password = "test_password_123"
        hashed = get_password_hash(password)
        
        assert verify_password("wrong_password", hashed) is False

    def test_different_passwords_produce_different_hashes(self):
        """Should produce different hashes for different passwords"""
        hash1 = get_password_hash("password1")
        hash2 = get_password_hash("password2")
        
        assert hash1 != hash2


class TestJWT:
    """Test JWT token functions"""

    def test_create_access_token(self):
        """Should create access token"""
        user_id = "test_user_123"
        token = create_access_token(data={"sub": user_id})
        
        assert token is not None
        assert isinstance(token, str)
        assert len(token) > 0

    def test_create_refresh_token(self):
        """Should create refresh token"""
        user_id = "test_user_123"
        token = create_refresh_token(data={"sub": user_id})
        
        assert token is not None
        assert isinstance(token, str)

    def test_decode_access_token(self):
        """Should decode access token"""
        user_id = "test_user_123"
        token = create_access_token(data={"sub": user_id})
        
        payload = decode_token(token)
        
        assert payload["sub"] == user_id
        assert payload["type"] == "access"
        assert "exp" in payload

    def test_decode_refresh_token(self):
        """Should decode refresh token"""
        user_id = "test_user_123"
        token = create_refresh_token(data={"sub": user_id})
        
        payload = decode_token(token)
        
        assert payload["sub"] == user_id
        assert payload["type"] == "refresh"

    def test_token_with_custom_expiry(self):
        """Should create token with custom expiry"""
        user_id = "test_user_123"
        expires = timedelta(hours=1)
        token = create_access_token(data={"sub": user_id}, expires_delta=expires)
        
        payload = decode_token(token)
        
        assert payload["sub"] == user_id

    def test_invalid_token_raises_exception(self):
        """Should raise exception for invalid token"""
        with pytest.raises(Exception):
            decode_token("invalid_token")
