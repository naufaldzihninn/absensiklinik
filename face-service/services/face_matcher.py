import numpy as np


def l2_distance(a, b):
    a = np.array(a, dtype=np.float32)
    b = np.array(b, dtype=np.float32)

    if a.shape != b.shape:
        raise ValueError("Embedding shape mismatch")

    return float(np.linalg.norm(a - b))


def match_embedding(query_embedding, master_embeddings, threshold):
    best_distance = None

    for embedding in master_embeddings:
        distance = l2_distance(query_embedding, embedding)

        if best_distance is None or distance < best_distance:
            best_distance = distance

    matched = best_distance is not None and best_distance <= threshold

    return {
        "matched": matched,
        "best_distance": best_distance,
        "threshold": threshold,
    }
