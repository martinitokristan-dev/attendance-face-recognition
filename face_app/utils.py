"""
Face recognition utility functions.
Uses OpenCV LBPH face recognizer (opencv-contrib-python).
This approach requires NO dlib, NO CMake, and NO C++ compilation.
Falls back gracefully if opencv-contrib is not available.
"""
import os
import base64
import logging
import numpy as np
from io import BytesIO
from django.conf import settings
from PIL import Image

logger = logging.getLogger(__name__)

# ── Library detection ─────────────────────────────────────────────────────────

try:
    import cv2
    OPENCV_AVAILABLE = True
except ImportError:
    cv2 = None
    OPENCV_AVAILABLE = False
    logger.warning("OpenCV not available.")

# Check for LBPH face recognizer (requires opencv-contrib-python)
try:
    import cv2
    _test = cv2.face.LBPHFaceRecognizer_create()
    LBPH_AVAILABLE = True
    logger.info("OpenCV LBPH face recognizer available.")
except (AttributeError, cv2.error if cv2 else Exception):
    LBPH_AVAILABLE = False
    logger.warning("LBPH not available. Install opencv-contrib-python.")

# Also check for the dlib-based face_recognition library (optional bonus)
try:
    import face_recognition as fr
    FACE_RECOGNITION_AVAILABLE = True
    logger.info("face_recognition (dlib) library loaded – using high accuracy mode.")
except ImportError:
    FACE_RECOGNITION_AVAILABLE = False
    fr = None

try:
    import dlib
    DLIB_AVAILABLE = True
except ImportError:
    dlib = None
    DLIB_AVAILABLE = False

# Determine overall capability
FR_AVAILABLE = FACE_RECOGNITION_AVAILABLE or LBPH_AVAILABLE

# ── Haar Cascade setup ────────────────────────────────────────────────────────

FACE_CASCADE = None
FACE_CASCADE_ALT = None
if OPENCV_AVAILABLE:
    _data_dir = os.path.join(os.path.dirname(__file__), 'data')
    _local_default = os.path.join(_data_dir, 'haarcascade_frontalface_default.xml')
    _local_alt = os.path.join(_data_dir, 'haarcascade_frontalface_alt2.xml')

    if os.path.exists(_local_default):
        FACE_CASCADE = cv2.CascadeClassifier(_local_default)
    if os.path.exists(_local_alt):
        FACE_CASCADE_ALT = cv2.CascadeClassifier(_local_alt)

    # OpenCV default fallback path
    if (FACE_CASCADE is None or FACE_CASCADE.empty()) and hasattr(cv2, 'data') and cv2.data:
        _cascade_path = cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'
        if os.path.exists(_cascade_path):
            FACE_CASCADE = cv2.CascadeClassifier(_cascade_path)


def _decode_image_to_rgb(data: bytes) -> np.ndarray:
    """Convert raw image bytes to an RGB numpy array."""
    img = Image.open(BytesIO(data)).convert('RGB')
    return np.array(img)


def _to_gray(rgb_np: np.ndarray) -> np.ndarray:
    """Convert RGB numpy array to grayscale."""
    return cv2.cvtColor(rgb_np, cv2.COLOR_RGB2GRAY)


def _detect_faces_cv(gray_np: np.ndarray):
    """Detect faces using Haar cascade with CLAHE/equalization. Returns list of (x, y, w, h)."""
    if not OPENCV_AVAILABLE:
        h, w = gray_np.shape[:2]
        return [(int(w * 0.1), int(h * 0.1), int(w * 0.8), int(h * 0.8))]

    gray_eq = cv2.equalizeHist(gray_np)
    faces = ()
    if FACE_CASCADE and not FACE_CASCADE.empty():
        faces = FACE_CASCADE.detectMultiScale(
            gray_eq,
            scaleFactor=1.1,
            minNeighbors=4,
            minSize=(50, 50),
        )
    if (len(faces) == 0) and FACE_CASCADE_ALT and not FACE_CASCADE_ALT.empty():
        faces = FACE_CASCADE_ALT.detectMultiScale(
            gray_eq,
            scaleFactor=1.1,
            minNeighbors=4,
            minSize=(50, 50),
        )

    return list(faces) if len(faces) > 0 else []


# ── Public API: Encoding ──────────────────────────────────────────────────────

def encode_face_from_image(image_data: bytes):
    """
    Encode a face from raw image bytes.
    Returns a list of floats (the face encoding) or None if no face found.

    Uses face_recognition (dlib) if available, else LBPH histogram encoding.
    """
    if FACE_RECOGNITION_AVAILABLE:
        try:
            img_np = _decode_image_to_rgb(image_data)
            encodings = fr.face_encodings(img_np)
            return encodings[0].tolist() if encodings else None
        except Exception as e:
            logger.error(f"face_recognition encode error: {e}")
            return None

    if LBPH_AVAILABLE:
        return _lbph_encode(image_data)

    logger.error("No face recognition library available.")
    return None


def encode_face_from_path(image_path: str):
    """Encode face from a file path."""
    try:
        with open(image_path, 'rb') as f:
            return encode_face_from_image(f.read())
    except Exception as e:
        logger.error(f"encode_face_from_path error: {e}")
        return None


def detect_and_encode_all_faces(frame_bytes: bytes, downscale: float = 0.5, fast: bool = False):
    """
    Lightning-fast multi-face detection and encoding.
    Downscales the frame for rapid face localization (omni-directional, catches off-center faces),
    then extracts 128-D encodings for ALL detected faces.
    When fast=True (live attendance), skips slow enhancement fallbacks for lower latency.
    Returns list of dicts: [{'encoding': list_of_floats, 'box': {'top', 'right', 'bottom', 'left'}}, ...]
    """
    results = []
    try:
        img_np = _decode_image_to_rgb(frame_bytes)
        h, w = img_np.shape[:2]

        if FACE_RECOGNITION_AVAILABLE:
            # Fast downscaled localization first (fast path)
            scale_factor = 1.0
            small_locations = []
            if downscale < 1.0 and (w > 320 or h > 240):
                small_w = max(1, int(w * downscale))
                small_h = max(1, int(h * downscale))
                small_img = cv2.resize(img_np, (small_w, small_h)) if OPENCV_AVAILABLE else img_np
                scale_factor = 1.0 / downscale if OPENCV_AVAILABLE else 1.0
                small_locations = fr.face_locations(small_img, model='hog')

            # Fallback 1: If downscaled detection found no faces, run on original full image
            if not small_locations:
                small_locations = fr.face_locations(img_np, number_of_times_to_upsample=0, model='hog')
                scale_factor = 1.0

            # Fallback 2: Upsample by 1 to detect smaller or distant faces
            if not small_locations and not fast:
                small_locations = fr.face_locations(img_np, number_of_times_to_upsample=1, model='hog')
                scale_factor = 1.0

            # Fallback 3: For backlit scenes (e.g. bright window behind student), enhance contrast using CLAHE
            enhanced_frame = None
            if not fast and not small_locations and OPENCV_AVAILABLE:
                try:
                    lab = cv2.cvtColor(img_np, cv2.COLOR_RGB2LAB)
                    l, a, b = cv2.split(lab)
                    clahe = cv2.createCLAHE(clipLimit=3.5, tileGridSize=(8, 8))
                    cl = clahe.apply(l)
                    enhanced_frame = cv2.cvtColor(cv2.merge((cl, a, b)), cv2.COLOR_LAB2RGB)
                    small_locations = fr.face_locations(enhanced_frame, number_of_times_to_upsample=0, model='hog')
                    if not small_locations:
                        small_locations = fr.face_locations(enhanced_frame, number_of_times_to_upsample=1, model='hog')
                    scale_factor = 1.0
                except Exception:
                    pass

            # Fallback 4: Gamma correction (brightens underexposed faces in backlit conditions)
            if not fast and not small_locations and OPENCV_AVAILABLE:
                try:
                    table = np.array([((i / 255.0) ** 0.55) * 255 for i in range(256)]).astype("uint8")
                    gamma_img = cv2.LUT(img_np, table)
                    small_locations = fr.face_locations(gamma_img, number_of_times_to_upsample=0, model='hog')
                    if not small_locations:
                        small_locations = fr.face_locations(gamma_img, number_of_times_to_upsample=1, model='hog')
                    scale_factor = 1.0
                except Exception:
                    pass

            # Fallback 5: dlib frontal face detector with lowered confidence threshold (-0.4)
            if not fast and not small_locations and DLIB_AVAILABLE and dlib is not None:
                try:
                    dlib_det = dlib.get_frontal_face_detector()
                    dets, _, _ = dlib_det.run(img_np, 1, -0.4)
                    if dets:
                        small_locations = [(d.top(), d.right(), d.bottom(), d.left()) for d in dets]
                        scale_factor = 1.0
                except Exception:
                    pass

            # Fallback 6: OpenCV Haar Cascade detector
            if not fast and not small_locations and OPENCV_AVAILABLE:
                try:
                    gray = _to_gray(img_np)
                    haar_faces = _detect_faces_cv(gray)
                    if len(haar_faces) > 0:
                        small_locations = [(y, x + fw, y + fh, x) for (x, y, fw, fh) in haar_faces]
                        scale_factor = 1.0
                except Exception:
                    pass

            # Upscale locations back to original resolution
            upscaled_locations = []
            for (t, r, b, l) in small_locations:
                upscaled_locations.append((
                    max(0, int(t * scale_factor)),
                    min(w, int(r * scale_factor)),
                    min(h, int(b * scale_factor)),
                    max(0, int(l * scale_factor))
                ))

            if upscaled_locations:
                try:
                    encodings = fr.face_encodings(img_np, upscaled_locations)
                except Exception:
                    encodings = []

                if (not encodings or len(encodings) < len(upscaled_locations)) and enhanced_frame is not None:
                    try:
                        enhanced_encodings = fr.face_encodings(enhanced_frame, upscaled_locations)
                        if enhanced_encodings:
                            encodings = enhanced_encodings
                    except Exception:
                        pass

                for enc, (top, right, bottom, left) in zip(encodings, upscaled_locations):
                    results.append({
                        'encoding': enc.tolist(),
                        'box': {'top': top, 'right': right, 'bottom': bottom, 'left': left}
                    })
            if results:
                return results

        if LBPH_AVAILABLE:
            gray = _to_gray(img_np)
            faces = _detect_faces_cv(gray)
            for (x, y, fw, fh) in faces:
                face_gray = gray[y:y+fh, x:x+fw]
                if face_gray.size > 0:
                    face_resized = cv2.resize(face_gray, (128, 128))
                    lbp_hist = _compute_lbp_histogram(face_resized)
                    results.append({
                        'encoding': lbp_hist.tolist(),
                        'box': {'top': y, 'right': x+fw, 'bottom': y+fh, 'left': x}
                    })
            return results

    except Exception as e:
        logger.error(f"detect_and_encode_all_faces error: {e}")

    return results


def encode_face_from_frame(frame_bytes: bytes):
    """
    Backward-compatible single/multi-face frame encoder.
    Returns (first_encoding_or_None, list_of_face_location_dicts)
    """
    all_faces = detect_and_encode_all_faces(frame_bytes)
    if not all_faces:
        return None, []
    primary_encoding = all_faces[0]['encoding']
    face_locs = [f['box'] for f in all_faces]
    return primary_encoding, face_locs


def _lbph_encode(image_data: bytes):
    """
    Compute an LBPH-style face encoding (histogram over face ROI).
    Returns a flat float list or None.
    """
    try:
        img_np = _decode_image_to_rgb(image_data)
        gray = _to_gray(img_np)
        faces = _detect_faces_cv(gray)

        if len(faces) == 0:
            # Use entire frame center as fallback
            h, w = gray.shape
            face_gray = gray[int(h*0.1):int(h*0.9), int(w*0.1):int(w*0.9)]
        else:
            x, y, fw, fh = faces[0]
            face_gray = gray[y:y+fh, x:x+fw]

        # Resize to fixed size for consistent encoding
        face_resized = cv2.resize(face_gray, (128, 128))

        # Compute LBP histogram for a robust descriptor
        lbp_hist = _compute_lbp_histogram(face_resized)
        return lbp_hist.tolist()
    except Exception as e:
        logger.error(f"LBPH encode error: {e}")
        return None


def _compute_lbp_histogram(gray_face: np.ndarray, num_points: int = 8, radius: int = 1):
    """Compute Local Binary Pattern histogram over a face image."""
    h, w = gray_face.shape
    lbp = np.zeros((h, w), dtype=np.uint8)

    for i in range(num_points):
        angle = 2 * np.pi * i / num_points
        x_offset = int(round(radius * np.cos(angle)))
        y_offset = int(round(-radius * np.sin(angle)))

        shifted = np.roll(np.roll(gray_face, y_offset, axis=0), x_offset, axis=1)
        lbp += ((shifted >= gray_face).astype(np.uint8) << i)

    # Divide into a grid of cells and compute per-cell histograms
    grid = 8
    ch, cw = h // grid, w // grid
    histograms = []
    for row in range(grid):
        for col in range(grid):
            cell = lbp[row*ch:(row+1)*ch, col*cw:(col+1)*cw]
            hist, _ = np.histogram(cell, bins=256, range=(0, 256))
            hist = hist.astype(np.float32)
            norm = np.sum(hist)
            if norm > 0:
                hist /= norm
            histograms.append(hist)

    return np.concatenate(histograms)


def _detect_locations(frame_bytes: bytes):
    """Return face locations from a frame as list of dicts."""
    try:
        img_np = _decode_image_to_rgb(frame_bytes)
        gray = _to_gray(img_np)
        faces = _detect_faces_cv(gray)
        return [{'top': y, 'right': x+w, 'bottom': y+h, 'left': x}
                for (x, y, w, h) in faces]
    except Exception:
        return []


# ── Anti-Spoofing & Biometric Liveness Detection ──────────────────────────────

def check_face_liveness(img_rgb: np.ndarray, box: dict) -> tuple:
    """
    Evaluates whether a detected face ROI is a live human or a presentation attack
    (such as a printed paper photograph or smartphone LCD/OLED screen).

    Returns:
        (is_live: bool, confidence_score: float, details: str)
    """
    if img_rgb is None or img_rgb.size == 0 or not OPENCV_AVAILABLE:
        return True, 1.0, "Liveness bypass: OpenCV unavailable"

    try:
        h, w = img_rgb.shape[:2]
        top = max(0, int(box.get('top', 0)))
        bottom = min(h, int(box.get('bottom', h)))
        left = max(0, int(box.get('left', 0)))
        right = min(w, int(box.get('right', w)))

        if (bottom - top) < 28 or (right - left) < 28:
            return False, 0.0, "Face region too small for reliable liveness check"

        face_roi = img_rgb[top:bottom, left:right]
        if face_roi.size == 0:
            return False, 0.0, "Invalid face region"

        # 1. Texture & Focus Analysis (Laplacian Variance)
        gray = cv2.cvtColor(face_roi, cv2.COLOR_RGB2GRAY)
        lap_var = float(cv2.Laplacian(gray, cv2.CV_64F).var())

        # Printed paper photo or heavy out-of-focus blur typically has lap_var < 28
        if lap_var < 18.0:
            return False, round(lap_var, 2), "Flat or blurred image (possible printed paper photo)"

        # Extreme high-frequency screen pixel grid / moiré pattern
        if lap_var > 3500.0:
            return False, round(lap_var, 2), "Unnatural pixel raster texture (possible digital display)"

        # 2. Specular Screen Glare & Flash Reflection (HSV space)
        hsv = cv2.cvtColor(face_roi, cv2.COLOR_RGB2HSV)
        v_channel = hsv[:, :, 2]
        s_channel = hsv[:, :, 1]

        # Glass glare exhibits near-zero saturation and maximum brightness
        glare_mask = (v_channel > 248) & (s_channel < 25)
        glare_ratio = float(np.count_nonzero(glare_mask)) / float(face_roi.shape[0] * face_roi.shape[1])
        if glare_ratio > 0.18:
            return False, round(glare_ratio, 3), "Excessive specular glare (screen/glass reflection)"

        # 3. Chrominance Distribution (YCrCb space)
        # Real human skin exhibits natural dispersion in Cr/Cb channels
        ycrcb = cv2.cvtColor(face_roi, cv2.COLOR_RGB2YCrCb)
        cr_std = float(ycrcb[:, :, 1].std())
        cb_std = float(ycrcb[:, :, 2].std())

        if cr_std < 2.5 and cb_std < 2.5:
            return False, round(min(cr_std, cb_std), 2), "Uniform monochromatic surface (paper/monochrome spoof)"

        # Passed all biometric anti-spoof checks
        confidence = min(1.0, max(0.6, (lap_var / 300.0) * 0.4 + 0.6))
        return True, round(confidence, 3), "Live human verified"
    except Exception as e:
        logger.warning(f"Liveness verification warning: {e}")
        return True, 0.85, "Liveness check default"


# ── Public API: Comparison ────────────────────────────────────────────────────


def compare_faces(known_encoding: list, unknown_encoding: list, tolerance: float = None):
    """
    Compare two face encodings.
    Returns (is_match: bool, confidence: float)
    confidence is between 0.0 and 1.0, higher = better match.
    """
    if tolerance is None:
        tolerance = getattr(settings, 'FACE_RECOGNITION_TOLERANCE', 0.5)

    if known_encoding is None or unknown_encoding is None:
        return False, 0.0

    known_np = np.array(known_encoding, dtype=np.float32)
    unknown_np = np.array(unknown_encoding, dtype=np.float32)

    if FACE_RECOGNITION_AVAILABLE and len(known_np) == 128:
        # dlib encoding: use Euclidean distance
        distance = float(np.linalg.norm(known_np - unknown_np))
        is_match = distance <= tolerance
        confidence = max(0.0, 1.0 - distance)
        return is_match, round(confidence, 3)

    # LBPH encoding: use Chi-squared distance on histograms
    chi_sq = _chi_squared_distance(known_np, unknown_np)
    # Chi-sq ranges from 0 (identical) upward; threshold empirically ~20–80
    lbph_threshold = getattr(settings, 'LBPH_THRESHOLD', 40.0)
    is_match = chi_sq <= lbph_threshold
    confidence = max(0.0, 1.0 - chi_sq / lbph_threshold)
    return is_match, round(confidence, 3)


def batch_compare_faces(known_matrix: np.ndarray, unknown_encoding: list, tolerance: float = None,
                        min_margin: float = None):
    """
    Sub-millisecond vectorized comparison of an unknown face against a section's pre-indexed matrix.
    known_matrix shape: (N, 128)
    unknown_encoding length: 128
    Returns (is_match, best_index, min_distance, confidence, margin)
    margin = distance to second-best match minus best distance (higher = more confident)
    """
    if tolerance is None:
        tolerance = getattr(settings, 'FACE_RECOGNITION_TOLERANCE', 0.38)
    if min_margin is None:
        min_margin = getattr(settings, 'FACE_MATCH_MARGIN', 0.08)

    if known_matrix is None or len(known_matrix) == 0 or unknown_encoding is None:
        return False, None, 999.0, 0.0, 0.0

    try:
        unknown_np = np.array(unknown_encoding, dtype=np.float32)

        # High-accuracy 128-D Euclidean Vectorized Matching
        if known_matrix.ndim == 2 and known_matrix.shape[1] == len(unknown_np):
            distances = np.linalg.norm(known_matrix - unknown_np, axis=1)
            sorted_indices = np.argsort(distances)
            best_idx = int(sorted_indices[0])
            min_dist = float(distances[best_idx])
            second_dist = float(distances[sorted_indices[1]]) if len(distances) > 1 else 999.0
            margin = second_dist - min_dist
            confidence = max(0.0, 1.0 - min_dist)

            is_match = min_dist <= tolerance and confidence >= getattr(settings, 'MIN_FACE_CONFIDENCE', 0.62)
            if is_match and len(distances) > 1 and margin < min_margin:
                is_match = False

            return is_match, best_idx, min_dist, round(confidence, 3), round(margin, 3)

        # Fallback for LBPH or differing dimensions
        best_idx = None
        best_confidence = 0.0
        best_match = False
        min_dist = 999.0
        for i, known_row in enumerate(known_matrix):
            matched, conf = compare_faces(known_row.tolist(), unknown_encoding, tolerance)
            if matched and conf > best_confidence:
                best_match = True
                best_idx = i
                best_confidence = conf
        return best_match, best_idx, min_dist, best_confidence, 0.0

    except Exception as e:
        logger.error(f"batch_compare_faces error: {e}")
        return False, None, 999.0, 0.0, 0.0


def pick_primary_face(detected_faces: list, frame_w: int = 640, frame_h: int = 480) -> list:
    """
    Select the single most prominent face (largest area + closest to center).
    Forces one-at-a-time scanning so the system focuses on one person per frame.
    """
    if not detected_faces:
        return []
    if len(detected_faces) == 1:
        return detected_faces

    center_x = frame_w / 2.0
    center_y = frame_h / 2.0

    def prominence_score(face):
        box = face.get('box', {})
        w = max(1, box.get('right', 0) - box.get('left', 0))
        h = max(1, box.get('bottom', 0) - box.get('top', 0))
        area = w * h
        cx = (box.get('left', 0) + box.get('right', 0)) / 2.0
        cy = (box.get('top', 0) + box.get('bottom', 0)) / 2.0
        dist_from_center = ((cx - center_x) ** 2 + (cy - center_y) ** 2) ** 0.5
        return area - dist_from_center * 2.0

    return [max(detected_faces, key=prominence_score)]


def pick_face_for_next_attendance(
    detected_faces: list,
    section_matrix: np.ndarray,
    students: list,
    marked_student_ids: set,
    frame_w: int = 640,
    frame_h: int = 480,
    tolerance: float = None,
):
    """
    Prefer the face that matches an not-yet-marked enrolled student (queue scanning).
    Falls back to the largest / most centered face when no unmarked match is found.
    """
    if not detected_faces:
        return []
    if len(detected_faces) == 1:
        return detected_faces

    marked_student_ids = set(marked_student_ids or [])
    unmarked_indices = [
        i for i, student in enumerate(students)
        if student.get('id') not in marked_student_ids
    ]
    if (
        not unmarked_indices
        or section_matrix is None
        or len(section_matrix) == 0
    ):
        return pick_primary_face(detected_faces, frame_w, frame_h)

    sub_matrix = section_matrix[unmarked_indices]
    best_face = None
    best_confidence = -1.0

    for face in detected_faces:
        encoding = face.get('encoding')
        if not encoding:
            continue
        is_match, sub_idx, _dist, confidence, _margin = batch_compare_faces(
            sub_matrix, encoding, tolerance
        )
        if is_match and sub_idx is not None and confidence > best_confidence:
            best_confidence = confidence
            best_face = face

    if best_face is not None:
        return [best_face]
    return pick_primary_face(detected_faces, frame_w, frame_h)


def _chi_squared_distance(h1: np.ndarray, h2: np.ndarray) -> float:
    """Chi-squared histogram distance. Lower = more similar."""
    if len(h1) != len(h2):
        return 9999.0
    eps = 1e-10
    return float(np.sum(((h1 - h2) ** 2) / (h1 + h2 + eps)))


# ── Public API: Detection ─────────────────────────────────────────────────────

def detect_faces_in_frame(frame_bytes: bytes):
    """
    Detect face locations in a frame.
    Returns list of dicts: {top, right, bottom, left}
    """
    if FACE_RECOGNITION_AVAILABLE:
        try:
            img_np = _decode_image_to_rgb(frame_bytes)
            locations = fr.face_locations(img_np, model='hog')
            return [{'top': t, 'right': r, 'bottom': b, 'left': l}
                    for (t, r, b, l) in locations]
        except Exception as e:
            logger.error(f"detect_faces dlib error: {e}")

    return _detect_locations(frame_bytes)


# ── Utility ───────────────────────────────────────────────────────────────────

def base64_to_bytes(base64_str: str) -> bytes:
    """Convert a base64 data URL or plain base64 string to bytes."""
    if ',' in base64_str:
        base64_str = base64_str.split(',', 1)[1]
    return base64.b64decode(base64_str)


def draw_face_boxes(frame_bytes: bytes, results: list) -> bytes:
    """
    Draw colored bounding boxes + name labels on faces.
    results: list of {top, right, bottom, left, name, status}
    Returns modified JPEG bytes.
    """
    if not OPENCV_AVAILABLE:
        return frame_bytes
    try:
        img_np = _decode_image_to_rgb(frame_bytes)
        for res in results:
            top, right, bottom, left = res['top'], res['right'], res['bottom'], res['left']
            name = res.get('name', 'Unknown')
            status = res.get('status', 'unknown')
            color = (0, 200, 0) if status == 'present' else (200, 0, 0)
            cv2.rectangle(img_np, (left, top), (right, bottom), color, 2)
            cv2.rectangle(img_np, (left, bottom - 28), (right, bottom), color, cv2.FILLED)
            cv2.putText(img_np, name, (left + 4, bottom - 8),
                        cv2.FONT_HERSHEY_DUPLEX, 0.5, (255, 255, 255), 1)
        output = BytesIO()
        Image.fromarray(img_np).save(output, format='JPEG', quality=85)
        return output.getvalue()
    except Exception as e:
        logger.error(f"draw_face_boxes error: {e}")
        return frame_bytes
