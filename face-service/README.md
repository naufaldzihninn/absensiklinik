---
title: Klinik Face Service
emoji: 🏥
colorFrom: blue
colorTo: green
sdk: docker
app_port: 7860
pinned: false
license: mit
---

# Klinik Face Service

FastAPI service untuk face verification Sistem Absensi Cerdas Klinik Prima Insani.

Service ini menggunakan:
- OpenCV YuNet untuk face detection
- OpenCV SFace untuk face embedding / recognition
- API key protection
- RAM-only image processing

## Environment

Set secrets berikut di Hugging Face Space:

```text
FACE_SERVICE_API_KEY=<random-long-secret>
FACE_THRESHOLD_DEFAULT=0.50
MAX_IMAGE_SIZE_MB=5
MIN_FACE_CONFIDENCE=0.80
MIN_FACE_WIDTH=100
MIN_FACE_HEIGHT=100
```

## Endpoints

```text
GET  /health
POST /api/face/extract
POST /api/face/verify
POST /api/face/quality-check
```

Semua endpoint selain `/health` wajib mengirim header:

```http
x-api-key: <FACE_SERVICE_API_KEY>
```
