import os
import cv2
import numpy as np
from fastapi import UploadFile


MAX_IMAGE_SIZE_MB = float(os.getenv("MAX_IMAGE_SIZE_MB", "5"))
MAX_IMAGE_BYTES = int(MAX_IMAGE_SIZE_MB * 1024 * 1024)


class ImageValidationError(Exception):
    def __init__(self, code: str, message: str):
        self.code = code
        self.message = message
        super().__init__(message)


async def read_image_from_upload(file: UploadFile):
    content = await file.read()

    if not content:
        raise ImageValidationError("INVALID_IMAGE", "File gambar kosong.")

    if len(content) > MAX_IMAGE_BYTES:
        raise ImageValidationError("INVALID_IMAGE", f"Ukuran gambar maksimal {MAX_IMAGE_SIZE_MB:g} MB.")

    image_array = np.frombuffer(content, dtype=np.uint8)
    image = cv2.imdecode(image_array, cv2.IMREAD_COLOR)

    if image is None:
        raise ImageValidationError("INVALID_IMAGE", "Format gambar tidak valid.")

    return resize_max(image)


def resize_max(image, max_side=640):
    h, w = image.shape[:2]

    if max(h, w) <= max_side:
        return image

    scale = max_side / max(h, w)
    new_w = int(w * scale)
    new_h = int(h * scale)

    return cv2.resize(image, (new_w, new_h))
