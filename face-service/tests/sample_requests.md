# Sample Requests

```bash
curl https://<space>.hf.space/health
```

```bash
curl -X POST https://<space>.hf.space/api/face/extract \
  -H "x-api-key: $FACE_SERVICE_API_KEY" \
  -F "image=@sample.jpg"
```

```bash
curl -X POST https://<space>.hf.space/api/face/verify \
  -H "x-api-key: $FACE_SERVICE_API_KEY" \
  -F "image=@sample.jpg" \
  -F 'embeddings=[[0.1,0.2,0.3]]' \
  -F "threshold=0.50"
```
