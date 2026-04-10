import os
import uuid
import io
import imghdr
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form, Query
from app.core.security import get_current_user_id, get_current_user_id_optional, decode_token
from app.core.config import settings
from app.models import File as FileModel
from app.schemas import FileUploadResponse, FileResponse

router = APIRouter()

# Ensure upload directory exists
os.makedirs(settings.upload_dir, exist_ok=True)

# Allowed image MIME types and corresponding extensions
ALLOWED_IMAGE_TYPES = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/gif": ".gif",
    "image/webp": ".webp",
}
MAX_IMAGE_SIZE = 10 * 1024 * 1024  # 10MB


async def get_user_id_from_query_or_header(
    token: Optional[str] = Query(None, description="Access token for image access"),
    user_id: Optional[str] = Depends(get_current_user_id_optional),
) -> str:
    """Get user ID from query token or Authorization header"""
    # Priority: Authorization header > query token
    if user_id:
        return user_id

    if token:
        try:
            payload = decode_token(token)
            uid = payload.get("sub")
            if uid:
                return uid
        except Exception:
            pass

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="需要认证",
    )


@router.post("/upload", response_model=FileUploadResponse)
async def upload_file(
    file: UploadFile = File(...),
    session_id: Optional[str] = Form(None),
    user_id: str = Depends(get_current_user_id),
):
    """Upload a file"""
    # Validate file size
    if file.size and file.size > settings.max_file_size:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"文件大小超过限制 ({settings.max_file_size // (1024*1024)}MB)",
        )

    # Generate unique filename
    file_ext = os.path.splitext(file.filename)[1] if file.filename else ""
    unique_filename = f"{uuid.uuid4()}{file_ext}"
    file_path = os.path.join(settings.upload_dir, user_id, unique_filename)

    # Ensure user directory exists
    os.makedirs(os.path.dirname(file_path), exist_ok=True)

    # Save file
    try:
        content = await file.read()
        with open(file_path, "wb") as f:
            f.write(content)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"文件保存失败: {str(e)}",
        )

    # Create file record
    file_record = FileModel(
        user_id=user_id,
        session_id=session_id,
        name=file.filename or "unknown",
        path=file_path,
        size=len(content),
        mime_type=file.content_type,
    )
    await file_record.insert()

    return FileUploadResponse(
        id=file_record.id,
        name=file_record.name,
        url=f"/api/v1/files/{file_record.id}",
        size=file_record.size,
        mime_type=file_record.mime_type,
    )


@router.post("/upload/image", response_model=FileUploadResponse)
async def upload_image(
    file: UploadFile = File(...),
    session_id: Optional[str] = Form(None),
    user_id: str = Depends(get_current_user_id),
):
    """
    Upload an image file with strict validation.

    Validates:
    - MIME type must be jpeg, png, gif, or webp
    - File size must be under 10MB
    - Actual content must match claimed type (prevents fake extensions)
    """
    # 1. Validate MIME type
    if file.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"不支持的图片格式: {file.content_type or '未知'}。支持: JPEG, PNG, GIF, WebP",
        )

    # 2. Read content and validate size
    content = await file.read()
    if len(content) > MAX_IMAGE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"图片大小超过限制 ({MAX_IMAGE_SIZE // (1024*1024)}MB)",
        )

    # 3. Validate actual image content (prevent fake extensions)
    image_type = imghdr.what(None, h=content)
    if image_type not in ['jpeg', 'png', 'gif', 'webp']:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="文件内容不是有效图片，可能存在伪装扩展名",
        )

    # 4. Generate unique filename with correct extension
    file_ext = ALLOWED_IMAGE_TYPES.get(file.content_type, f".{image_type}")
    unique_filename = f"{uuid.uuid4()}{file_ext}"
    file_path = os.path.join(settings.upload_dir, user_id, "images", unique_filename)

    # Ensure user image directory exists
    os.makedirs(os.path.dirname(file_path), exist_ok=True)

    # 5. Save file
    try:
        with open(file_path, "wb") as f:
            f.write(content)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"图片保存失败: {str(e)}",
        )

    # 6. Create file record
    file_record = FileModel(
        user_id=user_id,
        session_id=session_id,
        name=file.filename or "image",
        path=file_path,
        size=len(content),
        mime_type=file.content_type,
    )
    await file_record.insert()

    # 7. Create a short-lived token for image access (7 days)
    from app.core.security import create_access_token
    from datetime import timedelta
    access_token = create_access_token(
        data={"sub": user_id},
        expires_delta=timedelta(days=7)
    )

    # Return with download URL including token for <img> tag access
    return FileUploadResponse(
        id=file_record.id,
        name=file_record.name,
        url=f"/api/v1/files/{file_record.id}/download?token={access_token}",
        size=file_record.size,
        mime_type=file_record.mime_type,
    )


@router.get("/{file_id}", response_model=FileResponse)
async def get_file(
    file_id: str,
    user_id: str = Depends(get_current_user_id),
):
    """Get file information"""
    file_record = await FileModel.find_one(
        FileModel.id == file_id,
        FileModel.user_id == user_id,
    )

    if not file_record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="文件不存在",
        )

    return FileResponse.model_validate(file_record)


@router.get("/{file_id}/download")
async def download_file(
    file_id: str,
    user_id: str = Depends(get_user_id_from_query_or_header),
):
    """Download file. Supports both authenticated (header) and token-based (query) access."""
    file_record = await FileModel.find_one(
        FileModel.id == file_id,
        FileModel.user_id == user_id,
    )

    if not file_record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="文件不存在",
        )

    if not os.path.exists(file_record.path):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="文件不存在",
        )

    from fastapi.responses import FileResponse as FastAPIFileResponse
    return FastAPIFileResponse(
        path=file_record.path,
        filename=file_record.name,
        media_type=file_record.mime_type,
    )


@router.delete("/{file_id}")
async def delete_file(
    file_id: str,
    user_id: str = Depends(get_current_user_id),
):
    """Delete file"""
    file_record = await FileModel.find_one(
        FileModel.id == file_id,
        FileModel.user_id == user_id,
    )

    if not file_record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="文件不存在",
        )

    # Delete physical file
    if os.path.exists(file_record.path):
        os.remove(file_record.path)

    # Delete database record
    await file_record.delete()

    return {"success": True, "message": "文件已删除"}