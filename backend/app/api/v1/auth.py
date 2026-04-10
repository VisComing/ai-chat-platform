import re
from fastapi import APIRouter, Depends, HTTPException, status
from app.core.security import (
    get_password_hash,
    verify_password,
    create_access_token,
    create_refresh_token,
    decode_token,
    get_current_user_id,
)
from app.models import User, UserSettings
from app.schemas import (
    LoginRequest,
    LoginData,
    ApiResponse,
    RegisterRequest,
    RefreshTokenRequest,
    UserResponse,
)

router = APIRouter()


@router.post("/register")
async def register(
    request: RegisterRequest,
):
    """Register a new user"""
    # Check if email already exists
    existing_user = await User.find_one(User.email == request.email)
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="邮箱已被注册",
        )

    # Check if username already exists
    existing_user = await User.find_one(User.username == request.username)
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="用户名已被使用",
        )

    # Create user
    user = User(
        email=request.email,
        username=request.username,
        password_hash=get_password_hash(request.password),
    )
    await user.insert()

    # Create user settings
    settings = UserSettings(user_id=user.id)
    await settings.insert()

    # Create tokens
    access_token = create_access_token(data={"sub": user.id})
    refresh_token = create_refresh_token(data={"sub": user.id})

    return ApiResponse(
        success=True,
        data=LoginData(
            user=UserResponse.model_validate(user),
            accessToken=access_token,
            refreshToken=refresh_token,
        ).model_dump(),
    )


@router.post("/login")
async def login(
    request: LoginRequest,
):
    """Login user - supports username or email"""
    # Validate if account is email format using proper regex
    email_pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    is_email = bool(re.match(email_pattern, request.account))

    if is_email:
        # Find user by email
        user = await User.find_one(User.email == request.account)
    else:
        # Find user by username
        user = await User.find_one(User.username == request.account)

    if not user or not verify_password(request.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="用户名或密码错误",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="账户已被禁用",
        )

    # Create tokens
    access_token = create_access_token(data={"sub": user.id})
    refresh_token = create_refresh_token(data={"sub": user.id})

    return ApiResponse(
        success=True,
        data=LoginData(
            user=UserResponse.model_validate(user),
            accessToken=access_token,
            refreshToken=refresh_token,
        ).model_dump(),
    )


@router.post("/refresh")
async def refresh_token(
    request: RefreshTokenRequest,
):
    """Refresh access token"""
    payload = decode_token(request.refreshToken)

    if payload.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="无效的令牌类型",
        )

    user_id = payload.get("sub")
    user = await User.find_one(User.id == user_id)

    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="用户不存在或已被禁用",
        )

    # Create new tokens
    access_token = create_access_token(data={"sub": user.id})
    refresh_token = create_refresh_token(data={"sub": user.id})

    return ApiResponse(
        success=True,
        data=LoginData(
            user=UserResponse.model_validate(user),
            accessToken=access_token,
            refreshToken=refresh_token,
        ).model_dump(),
    )


@router.get("/me")
async def get_current_user(
    user_id: str = Depends(get_current_user_id),
):
    """Get current user"""
    user = await User.find_one(User.id == user_id)

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="用户不存在",
        )

    return ApiResponse(
        success=True,
        data=UserResponse.model_validate(user).model_dump(),
    )


@router.post("/logout")
async def logout():
    """Logout user (client should discard tokens)"""
    return ApiResponse(success=True, message="已退出登录")