import os
from fastapi import Header, HTTPException


FACE_SERVICE_API_KEY = os.getenv("FACE_SERVICE_API_KEY")


def verify_api_key(x_api_key: str = Header(default=None)):
    if not FACE_SERVICE_API_KEY:
        raise HTTPException(status_code=500, detail="FACE_SERVICE_API_KEY is not configured")

    if x_api_key != FACE_SERVICE_API_KEY:
        raise HTTPException(status_code=401, detail="Unauthorized")

    return True
