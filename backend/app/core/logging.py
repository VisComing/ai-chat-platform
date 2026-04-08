import logging
import logging.config
from pathlib import Path
from typing import Dict, Any

from app.core.config import settings


def get_logging_config() -> Dict[str, Any]:
    """Generate logging configuration dict based on settings."""
    # Ensure log directory exists
    log_dir = Path(settings.log_dir)
    log_dir.mkdir(parents=True, exist_ok=True)

    log_file_path = log_dir / settings.log_file

    return {
        "version": 1,
        "disable_existing_loggers": False,
        "formatters": {
            "standard": {
                "format": settings.log_format,
            },
        },
        "handlers": {
            "console": {
                "class": "logging.StreamHandler",
                "level": settings.log_level,
                "formatter": "standard",
                "stream": "ext://sys.stdout",
            },
            "file": {
                "class": "logging.handlers.RotatingFileHandler",
                "level": settings.log_level,
                "formatter": "standard",
                "filename": str(log_file_path),
                "maxBytes": settings.log_max_bytes,
                "backupCount": settings.log_backup_count,
                "encoding": "utf-8",
            },
        },
        "loggers": {
            "app": {
                "level": settings.log_level,
                "handlers": ["console", "file"],
                "propagate": False,
            },
            "uvicorn": {
                "level": "INFO",
                "handlers": ["console", "file"],
                "propagate": False,
            },
            "uvicorn.error": {
                "level": "INFO",
                "handlers": ["console", "file"],
                "propagate": False,
            },
        },
        "root": {
            "level": settings.log_level,
            "handlers": ["console", "file"],
        },
    }


def setup_logging() -> None:
    """Initialize logging configuration."""
    config = get_logging_config()
    logging.config.dictConfig(config)

    # Get app logger and log startup
    logger = logging.getLogger("app")
    logger.info(f"Logging initialized: level={settings.log_level}, file={settings.log_dir}/{settings.log_file}")


def get_logger(name: str = "app") -> logging.Logger:
    """Get a configured logger instance."""
    return logging.getLogger(name)