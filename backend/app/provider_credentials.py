"""Request-scoped provider credentials; never persist these objects."""
from fastapi import HTTPException, Request
from pydantic import BaseModel, SecretStr


class ProviderCredentials(BaseModel):
    serpapi: SecretStr
    groq: SecretStr = SecretStr('')


def credentials_for(request: Request):
    serpapi = request.headers.get('X-SerpApi-Key', '')
    groq = request.headers.get('X-Groq-Key', '')
    if not serpapi and not groq:
        return None
    if not serpapi:
        raise HTTPException(422, 'A personal SerpApi key is required.')
    for value in (serpapi, groq):
        if value and (not 16 <= len(value) <= 256 or not value.isascii() or any(c.isspace() or ord(c) < 33 for c in value)):
            raise HTTPException(422, 'Provider keys must contain 16–256 printable characters without spaces.')
    return ProviderCredentials(serpapi=serpapi, groq=groq)
