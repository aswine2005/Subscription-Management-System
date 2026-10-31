import os
import secrets
from pathlib import Path
from typing import List
from pydantic import BaseModel

def local_secret():
    configured = os.getenv("SECRET_KEY")
    if configured:
        return configured
    path = Path(__file__).resolve().parents[1] / ".brightloop-secret"
    try:
        with path.open("x") as file:
            file.write(secrets.token_urlsafe(48))
        path.chmod(0o600)
    except FileExistsError:
        pass
    return path.read_text().strip()


class Settings(BaseModel):
    PROJECT_NAME: str = "BrightLoop Subscription Management"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"

    # Security & Auth
    SECRET_KEY: str = local_secret()
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours

    AUTO_BILLING: bool = os.getenv("AUTO_BILLING", "false").lower() == "true"

    # Database
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///" + str(Path(__file__).resolve().parents[1] / "brightloop.db"))

    # CORS
    CORS_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://localhost:3000",
        "http://localhost:3001",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001",
    ]

settings = Settings()
