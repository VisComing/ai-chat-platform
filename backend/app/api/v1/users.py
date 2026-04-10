from fastapi import APIRouter, Depends, HTTPException, status
from app.core.security import get_current_user_id
from app.models import User, UserSettings
from app.schemas import UserResponse, UserUpdate, UserSettingsResponse, UserSettingsUpdate, ApiResponse

router = APIRouter()


@router.get("/me")
async def get_current_user_profile(
    user_id: str = Depends(get_current_user_id),
):
    """Get current user profile"""
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


@router.patch("/me")
async def update_current_user(
    request: UserUpdate,
    user_id: str = Depends(get_current_user_id),
):
    """Update current user profile"""
    user = await User.find_one(User.id == user_id)

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="用户不存在",
        )

    # Update fields
    update_data = request.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(user, field, value)

    user.updated_at = __import__('datetime').datetime.utcnow()
    await user.save()

    return ApiResponse(
        success=True,
        data=UserResponse.model_validate(user).model_dump(),
    )


@router.get("/me/settings")
async def get_current_user_settings(
    user_id: str = Depends(get_current_user_id),
):
    """Get current user settings"""
    settings = await UserSettings.find_one(UserSettings.user_id == user_id)

    if not settings:
        # Create default settings
        settings = UserSettings(user_id=user_id)
        await settings.insert()

    return ApiResponse(
        success=True,
        data=UserSettingsResponse.model_validate(settings).model_dump(),
    )


@router.patch("/me/settings")
async def update_current_user_settings(
    request: UserSettingsUpdate,
    user_id: str = Depends(get_current_user_id),
):
    """Update current user settings"""
    settings = await UserSettings.find_one(UserSettings.user_id == user_id)

    if not settings:
        settings = UserSettings(user_id=user_id)
        await settings.insert()

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

    settings.updated_at = __import__('datetime').datetime.utcnow()
    await settings.save()

    return ApiResponse(
        success=True,
        data=UserSettingsResponse.model_validate(settings).model_dump(),
    )