"""
Face Recognition Service (API Layer)
Handles face enrollment and live frame recognition business logic.
Integrates with face_app core utilities and FaceService.
"""
import json
from io import BytesIO
from django.utils import timezone
from django.core.files.base import ContentFile

from core.models import AttendanceSession
from face_app.utils import base64_to_bytes, encode_face_from_frame, FR_AVAILABLE
from face_app.services.face_service import FaceService


class FaceRecognitionService:

    @staticmethod
    def get_session(session_id):
        """Resolves an attendance session by session primary key or schedule ID."""
        session = AttendanceSession.objects.filter(pk=session_id).first()
        if not session:
            session = AttendanceSession.objects.filter(
                schedule_id=session_id
            ).order_by('-date', '-created_at').first()
        return session

    @staticmethod
    def recognize_faces_for_session(session, frame_b64):
        """
        Decodes camera frame and runs biometric face recognition matching for the session.
        Returns match result dict.
        """
        frame_bytes = base64_to_bytes(frame_b64)
        return FaceService.recognize_all_faces_in_frame(session, frame_bytes)


class FaceEnrollService:

    @staticmethod
    def enroll_student_face(student, frame_b64):
        """
        Encodes face from frame, crops face photo, and persists to student record.
        Returns success message string.
        Raises ValueError on validation failures (no face, multiple faces).
        """
        from PIL import Image

        frame_bytes = base64_to_bytes(frame_b64)
        encoding, locations = encode_face_from_frame(frame_bytes)

        if not encoding:
            raise ValueError('No face detected in frame.')

        if len(locations) > 1:
            raise ValueError('Multiple faces detected. Please ensure only one face is visible.')

        # Persist encoding
        student.face_encoding = json.dumps(encoding)
        student.face_enrolled_at = timezone.now()

        # Crop & save face photo
        img = Image.open(BytesIO(frame_bytes)).convert('RGB')
        loc = locations[0]
        pad = 30
        left = max(0, loc['left'] - pad)
        top = max(0, loc['top'] - pad)
        right = min(img.width, loc['right'] + pad)
        bottom = min(img.height, loc['bottom'] + pad)
        img = img.crop((left, top, right, bottom))

        img_io = BytesIO()
        img.save(img_io, format='JPEG', quality=90)
        filename = f"face_{student.student_id}_{timezone.now().strftime('%Y%m%d%H%M%S')}.jpg"
        student.face_image.save(filename, ContentFile(img_io.getvalue()), save=False)
        student.save()

        FaceService.invalidate_cache()
        return f'Face enrolled successfully for {student.user.get_full_name()}!'
