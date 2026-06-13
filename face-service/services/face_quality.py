import os


MIN_FACE_CONFIDENCE = float(os.getenv("MIN_FACE_CONFIDENCE", "0.80"))
MIN_FACE_WIDTH = int(os.getenv("MIN_FACE_WIDTH", "100"))
MIN_FACE_HEIGHT = int(os.getenv("MIN_FACE_HEIGHT", "100"))


ERROR_MESSAGES = {
    "NO_FACE": "Wajah tidak terdeteksi. Silakan ulangi foto dengan pencahayaan cukup.",
    "MULTIPLE_FACES": "Terdeteksi lebih dari satu wajah. Pastikan hanya Anda yang terlihat di kamera.",
    "LOW_CONFIDENCE": "Wajah kurang jelas. Silakan ulangi foto dengan pencahayaan lebih baik.",
    "FACE_TOO_SMALL": "Wajah terlalu jauh dari kamera. Dekatkan wajah lalu coba lagi.",
    "INVALID_IMAGE": "Gambar tidak valid.",
    "MODEL_NOT_READY": "Sistem verifikasi wajah sedang menyala ulang. Silakan coba lagi beberapa saat.",
    "INTERNAL_ERROR": "Terjadi kesalahan saat memproses wajah.",
}


def quality_metadata(face_count, face=None):
    if face is None:
        return {
            "decision": "FAILED",
            "face_count": face_count,
            "detection_score": None,
            "face_box": None,
        }

    return {
        "decision": "GOOD",
        "face_count": face_count,
        "detection_score": float(face[14]),
        "face_box": {
            "x": int(face[0]),
            "y": int(face[1]),
            "width": int(face[2]),
            "height": int(face[3]),
        },
    }


def fail(code):
    return {
        "passed": False,
        "code": code,
        "message": ERROR_MESSAGES.get(code, ERROR_MESSAGES["INTERNAL_ERROR"]),
    }


def validate_face_quality(faces):
    face_count = len(faces)

    if face_count == 0:
        result = fail("NO_FACE")
        result["quality"] = quality_metadata(face_count)
        return result

    if face_count > 1:
        result = fail("MULTIPLE_FACES")
        result["quality"] = quality_metadata(face_count)
        return result

    face = faces[0]
    detection_score = float(face[14])
    width = float(face[2])
    height = float(face[3])

    if detection_score < MIN_FACE_CONFIDENCE:
        result = fail("LOW_CONFIDENCE")
        result["quality"] = quality_metadata(face_count, face)
        return result

    if width < MIN_FACE_WIDTH or height < MIN_FACE_HEIGHT:
        result = fail("FACE_TOO_SMALL")
        result["quality"] = quality_metadata(face_count, face)
        return result

    return {
        "passed": True,
        "decision": "GOOD",
        "face": face,
        "quality": quality_metadata(face_count, face),
    }
