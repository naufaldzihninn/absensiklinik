import os
import cv2


class FaceModel:
    def __init__(self):
        self.detector = None
        self.recognizer = None
        self.ready = False

    def load(self):
        detector_path = os.getenv("YUNET_MODEL_PATH", "models/face_detection_yunet.onnx")
        recognizer_path = os.getenv("SFACE_MODEL_PATH", "models/face_recognition_sface.onnx")
        min_confidence = float(os.getenv("MIN_FACE_CONFIDENCE", "0.80"))

        if hasattr(cv2, "FaceDetectorYN") and hasattr(cv2.FaceDetectorYN, "create"):
            self.detector = cv2.FaceDetectorYN.create(
                detector_path,
                "",
                (320, 320),
                score_threshold=min_confidence,
                nms_threshold=0.3,
                top_k=5000,
            )
        else:
            self.detector = cv2.FaceDetectorYN_create(
                detector_path,
                "",
                (320, 320),
                score_threshold=min_confidence,
                nms_threshold=0.3,
                top_k=5000,
            )

        if hasattr(cv2, "FaceRecognizerSF") and hasattr(cv2.FaceRecognizerSF, "create"):
            self.recognizer = cv2.FaceRecognizerSF.create(recognizer_path, "")
        else:
            self.recognizer = cv2.FaceRecognizerSF_create(recognizer_path, "")
        self.ready = True

    def is_ready(self):
        return self.ready and self.detector is not None and self.recognizer is not None

    def detect_faces(self, image):
        h, w = image.shape[:2]
        self.detector.setInputSize((w, h))
        _, faces = self.detector.detect(image)

        if faces is None:
            return []

        return faces

    def extract_embedding(self, image, face):
        aligned = self.recognizer.alignCrop(image, face)
        embedding = self.recognizer.feature(aligned)
        return embedding.flatten().astype(float).tolist()
