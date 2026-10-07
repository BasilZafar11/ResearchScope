from pydantic import SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file='.env', extra='ignore')
    database_url: str = 'sqlite:///./novelty-map.db'
    serpapi_key: SecretStr = SecretStr('')
    groq_api_key: SecretStr = SecretStr('')
    groq_enabled: bool = False
    groq_model: str = 'openai/gpt-oss-20b'
    ip_hash_secret: SecretStr = SecretStr('')
    hosted_reports_per_ip_per_day: int = 2
    hosted_serpapi_daily_budget: int = 100
    hosted_serpapi_reserve: int = 40
    live_serpapi_enabled: bool = False
    cors_origins: list[str] = ['http://localhost:5173', 'http://127.0.0.1:5173']
    request_timeout_seconds: float = 15
    rate_limit_per_hour: int = 10


settings = Settings()
