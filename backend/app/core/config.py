# ============================================================
# core/config.py — Application Settings
#
# TABLE OF CONTENTS
#   1. Settings Schema
#   2. Singleton Instance
#
# Settings are loaded from environment variables or a .env file.
# Override any value by setting the corresponding env var.
#
# Example .env:
#   DATABASE_URL=postgresql://user:password@localhost:5432/kaaj_lender
#   DEBUG=false
# ============================================================

# region ── 1. Settings Schema ────────────────────────────────
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Database
    DATABASE_URL: str = "postgresql://postgres:admin123@localhost:5432/kaaj_lender"

    # App metadata
    APP_TITLE: str = "Kaaj Lender Matching API"
    APP_VERSION: str = "1.0.0"

    # Development
    DEBUG: bool = True  # Set False in production to suppress SQL echo

    class Config:
        env_file = ".env"
# endregion


# region ── 2. Singleton Instance ─────────────────────────────
settings = Settings()
# endregion