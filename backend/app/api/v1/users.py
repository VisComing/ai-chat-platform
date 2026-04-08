from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.core.security import get_current_user_id
from app.models import User, UserSettings
from app.schemas import UserResponse, UserUpdate, UserSettingsResponse, UserSettingsUpdate, ApiResponse

router = APIRouter()


@router.get("/me")
async def get_current_user_profile(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Get current user profile"""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="用户不存在",
        )

    return ApiResponse(
        success=True,
        data=UserResponse.model_validate(user).model_dump(),
    )


@router.patch("/me")
async def update_current_user(
    request: UserUpdate,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Update current user profile"""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="用户不存在",
        )

    # Update fields
    update_data = request.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(user, field, value)

    await db.commit()
    await db.refresh(user)

    return ApiResponse(
        success=True,
        data=UserResponse.model_validate(user).model_dump(),
    )


@router.get("/me/settings")
async def get_current_user_settings(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Get current user settings"""
    result = await db.execute(
        select(UserSettings).where(UserSettings.user_id == user_id)
    )
    settings = result.scalar_one_or_none()

    if not settings:
        # Create default settings
        settings = UserSettings(user_id=user_id)
        db.add(settings)
        await db.commit()
        await db.refresh(settings)

    return ApiResponse(
        success=True,
        data=UserSettingsResponse.model_validate(settings).model_dump(),
    )


@router.patch("/me/settings")
async def update_current_user_settings(
    request: UserSettingsUpdate,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Update current user settings"""
    result = await db.execute(
        select(UserSettings).where(UserSettings.user_id == user_id)
    )
    settings = result.scalar_one_or_none()

    if not settings:
        settings = UserSettings(user_id=user_id)
        db.add(settings)

    # Field mapping from camelCase to snake_case
    field_mapping = {
        "defaultModel": "default_model",
        "maxTokens": "max_tokens",
        "enableThinking": "enable_thinking",
        "enableShortcuts": "enable_shortcuts",
        "enableSoundEffects": "enable_sound_effects",
    }

    # Update fields from validated request
    update_data = request.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        db_field = field_mapping.get(field, field)
        if hasattr(settings, db_field):
            setattr(settings, db_field, value)

    await db.commit()
    await db.refresh(settings)

    return ApiResponse(
        success=True,
        data=UserSettingsResponse.model_validate(settings).model_dump(),
    )