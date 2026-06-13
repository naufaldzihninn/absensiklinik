import json
import os
from fastapi import Depends, FastAPI, File, Form, UploadFile
from fastapi.responses import JSONResponse

from services.auth import verify_api_key
from services.face_matcher import match_embedding
from services.face_model import FaceModel
from services.face_quality import ERROR_MESSAGES, validate_face_quality
from services.image_utils import ImageValidationError, read_image_from_upload


app = FastAPI(title="Klinik Face Service")
face_model = FaceModel()


def error_response(code, message=None, status_code=400, quality=None):
    payload = {
        "success": False,
        "code": code,
        "message": message or ERROR_MESSAGES.get(code, ERROR_MESSAGES["INTERNAL_ERROR"]),
    }
    if quality is not None:
        payload["quality"] = quality
    return JSONResponse(status_code=status_code, content=payload)


@app.on_event("startup")
def startup_event():
    try:
        face_model.load()
    except Exception as exc:
        print(f"[startup] model load failed: {exc}")
        face_model.ready = False


@app.get("/health")
def health():
    ready = face_model.is_ready()
    return {
        "success": ready,
        "status": "ok" if ready else "model_not_ready",
        "models": {
            "yunet": face_model.detector is not None,
            "sface": face_model.recognizer is not None,
        },
    }


async def read_and_validate(file):
    if not face_model.is_ready():
        return None, None, error_response("MODEL_NOT_READY", status_code=503)

    try:
        image = await read_image_from_upload(file)
    except ImageValidationError as exc:
        return None, None, error_response(exc.code, exc.message)

    faces = face_model.detect_faces(image)
    quality = validate_face_quality(faces)

    if not quality["passed"]:
        return image, None, error_response(quality["code"], quality["message"], quality=quality.get("quality"))

    return image, quality, None


@app.post("/api/face/quality-check")
async def quality_check(
    image: UploadFile = File(...),
    _: bool = Depends(verify_api_key),
):
    _, quality, error = await read_and_validate(image)
    if error:
        return error

    return {
        "success": True,
        "quality": quality["quality"],
    }


@app.post("/api/face/extract")
async def extract_face(
    image: UploadFile = File(...),
    _: bool = Depends(verify_api_key),
):
    cv_image, quality, error = await read_and_validate(image)
    if error:
        return error

    embedding = face_model.extract_embedding(cv_image, quality["face"])

    return {
        "success": True,
        "embedding": embedding,
        "quality": quality["quality"],
    }


@app.post("/api/face/verify")
async def verify_face(
    image: UploadFile = File(...),
    embeddings: str = Form(...),
    threshold: str = Form(default=None),
    _: bool = Depends(verify_api_key),
):
    cv_image, quality, error = await read_and_validate(image)
    if error:
        return error

    try:
        master_embeddings = json.loads(embeddings)
        threshold_value = float(threshold or os.getenv("FACE_THRESHOLD_DEFAULT", "0.50"))
    except (TypeError, ValueError, json.JSONDecodeError):
        return error_response("INVALID_IMAGE", "Data embedding atau threshold tidak valid.")

    if not isinstance(master_embeddings, list) or len(master_embeddings) == 0:
        return error_response("INVALID_IMAGE", "Data embedding master tidak tersedia.")

    try:
        query_embedding = face_model.extract_embedding(cv_image, quality["face"])
        match = match_embedding(query_embedding, master_embeddings, threshold_value)
    except ValueError:
        return error_response("INVALID_IMAGE", "Dimensi embedding tidak cocok.")

    return {
        "success": True,
        "matched": match["matched"],
        "best_distance": match["best_distance"],
        "threshold": match["threshold"],
        "quality": quality["quality"],
    }
