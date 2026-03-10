# ============================================================
# CORE CONFIG — App settings loaded from environment variables
# ============================================================
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql://postgres:admin123@localhost:5432/kaaj_lender"
    APP_TITLE: str = "Kaaj Lender Matching API"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = True

    class Config:
        env_file = ".env"


settings = Settings()
