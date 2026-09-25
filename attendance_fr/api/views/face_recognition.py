"""
Face Recognition Views
Handles face recognition during attendance and face enrollment.
"""
from django.shortcuts import get_object_or_404
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from django.utils import timezone

from accounts.models import Student
from face_app.utils import FR_AVAILABLE
from attendance_fr.permissions import IsAdminRole, IsSessionManager
from attendance_fr.api.services.face_recognition import (
    FaceEnrollService,
    FaceRecognitionService,
)


class FaceRecognizeAPIView(APIView):
    """POST /api/face/recognize/ - Process camera frame, recognize faces, mark attendance."""
    permission_classes = [IsSessionManager]

    def post(self, request):
        session_id = request.data.get('session_id')
        frame_b64 = request.data.get('frame')

        if not session_id or not frame_b64:
            return Response({'error': 'session_id and frame are required'}, status=status.HTTP_400_BAD_REQUEST)

        if not FR_AVAILABLE:
            return Response({'error': 'Face recognition engine unavailable'}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

        # Resolve session by ID or schedule ID
        session = FaceRecognitionService.get_session(session_id)
        if not session:
            return Response(
                {'success': False, 'error': f'Attendance session #{session_id} not found', 'session_closed': True},
                status=status.HTTP_200_OK,
            )

        if session.status != 'open':
            if session.date == timezone.localdate():
                session.status = 'open'
                session.closed_at = None
                session.save(update_fields=['status', 'closed_at'])
            else:
                return Response(
                    {'success': False, 'error': f'Attendance session #{session_id} is closed', 'session_closed': True},
                    status=status.HTTP_200_OK,
                )

        self.check_object_permissions(request, session)
        result = FaceRecognitionService.recognize_faces_for_session(session, frame_b64)
        return Response(result)


class FaceEnrollAPIView(APIView):
    """POST /api/face/enroll/ - Enroll student face vector from camera frame (Admin only)."""
    permission_classes = [IsAdminRole]

    def post(self, request):
        student_id = request.data.get('student_id')
        frame_b64 = request.data.get('frame')

        if not student_id or not frame_b64:
            return Response({'error': 'student_id and frame are required'}, status=status.HTTP_400_BAD_REQUEST)

        student = get_object_or_404(Student, pk=student_id)

        try:
            message = FaceEnrollService.enroll_student_face(student, frame_b64)
        except ValueError as e:
            return Response({'success': False, 'message': str(e)}, status=status.HTTP_400_BAD_REQUEST)

        return Response({'success': True, 'message': message})
