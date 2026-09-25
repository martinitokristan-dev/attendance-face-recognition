import json
import logging
from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth.decorators import login_required
from django.contrib import messages
from django.http import JsonResponse
from django.utils import timezone
from accounts.models import Student
from core.models import AttendanceSession
from face_app.services.face_service import FaceService
from .utils import encode_face_from_frame, base64_to_bytes, FR_AVAILABLE

logger = logging.getLogger(__name__)


@login_required
def enroll_face(request):
    """Face enrollment — Admin only."""
    user = request.user

    if user.role == 'admin':
        # Admin can enroll for any student
        student_id = request.GET.get('student_id')
        if student_id:
            student = get_object_or_404(Student, pk=student_id)
        else:
            from accounts.forms import StudentRegisterForm
            students = Student.objects.select_related('user').all()
            return render(request, 'face/enroll_select.html', {
                'students': students,
                'student_register_form': StudentRegisterForm(user=request.user),
            })
    else:
        messages.error(request, "Permission denied. Face enrollment is managed by the administrator.")
        return redirect('dashboard')

    return render(request, 'face/enroll.html', {
        'student': student,
        'fr_available': FR_AVAILABLE,
    })


@login_required
def enroll_face_capture(request):
    """AJAX endpoint: receive base64 frame, encode face, save to student."""
    if request.method != 'POST':
        return JsonResponse({'error': 'POST required'}, status=405)

    try:
        data = json.loads(request.body)
        student_id = data.get('student_id')
        frame_b64 = data.get('frame')

        if not frame_b64 or not student_id:
            return JsonResponse({'error': 'Missing data'}, status=400)

        student = get_object_or_404(Student, pk=student_id)

        # Check permissions — admin only
        user = request.user
        if user.role != 'admin':
            return JsonResponse({'error': 'Permission denied. Face enrollment is for admin only.'}, status=403)

        if not FR_AVAILABLE:
            return JsonResponse({
                'error': 'Face recognition is not available. Please install opencv-contrib-python.',
            }, status=503)

        frame_bytes = base64_to_bytes(frame_b64)
        encoding, face_locations = encode_face_from_frame(frame_bytes)

        if not encoding:
            return JsonResponse({'success': False, 'message': 'No face detected in frame. Please center your face.'})

        if len(face_locations) > 1:
            return JsonResponse({'success': False, 'message': 'Multiple faces detected. Please ensure only one face is visible.'})

        # Save encoding
        student.face_encoding = json.dumps(encoding)
        student.face_enrolled_at = timezone.now()

        # Save face image
        from io import BytesIO
        from PIL import Image
        from django.core.files.base import ContentFile

        img_bytes = base64_to_bytes(frame_b64)
        img = Image.open(BytesIO(img_bytes)).convert('RGB')
        # Crop to face region + padding
        if face_locations:
            loc = face_locations[0]
            pad = 30
            if isinstance(loc, dict):
                left = max(0, loc.get('left', 0) - pad)
                top = max(0, loc.get('top', 0) - pad)
                right = min(img.width, loc.get('right', img.width) + pad)
                bottom = min(img.height, loc.get('bottom', img.height) + pad)
            elif isinstance(loc, (list, tuple)) and len(loc) >= 4:
                # Format: (top, right, bottom, left)
                t, r, b, l = loc[:4]
                left = max(0, l - pad)
                top = max(0, t - pad)
                right = min(img.width, r + pad)
                bottom = min(img.height, b + pad)
            else:
                left, top, right, bottom = 0, 0, img.width, img.height
            if right > left and bottom > top:
                img = img.crop((left, top, right, bottom))

        img_io = BytesIO()
        img.save(img_io, format='JPEG', quality=90)
        filename = f"face_{student.student_id}_{timezone.now().strftime('%Y%m%d%H%M%S')}.jpg"
        student.face_image.save(filename, ContentFile(img_io.getvalue()), save=False)
        student.save()
        FaceService.invalidate_cache()

        return JsonResponse({
            'success': True,
            'message': f'Face enrolled successfully for {student.user.get_full_name()}!',
            'face_count': len(face_locations),
        })

    except Exception as e:
        logger.exception("Error during face enrollment")
        return JsonResponse({'error': str(e)}, status=500)


@login_required
def recognize_faces(request):
    """AJAX endpoint: receive frame, match all faces against enrolled students in a session."""
    if request.method != 'POST':
        return JsonResponse({'error': 'POST required'}, status=405)

    if request.user.role not in ['admin', 'teacher']:
        return JsonResponse({'error': 'Forbidden: Face recognition scanning is restricted to instructors and administrators.'}, status=403)

    try:
        data = json.loads(request.body)
        session_id = data.get('session_id')
        frame_b64 = data.get('frame')

        if not frame_b64 or not session_id:
            return JsonResponse({'error': 'Missing data'}, status=400)

        if not FR_AVAILABLE:
            return JsonResponse({
                'error': 'Face recognition is not available.',
            }, status=503)

        session = AttendanceSession.objects.select_related('schedule__section__teacher').prefetch_related('schedule__section__subjects').filter(pk=session_id).first()
        if not session:
            return JsonResponse({'error': f'Attendance session #{session_id} not found.', 'session_closed': True}, status=404)
        if session.status != 'open':
            return JsonResponse({'error': f'Attendance session #{session_id} is closed.', 'session_closed': True}, status=400)

        # Authorization: teacher must be assigned to this session or section
        if request.user.role == 'teacher':
            teacher = getattr(request.user, 'teacher_profile', None)
            if not teacher:
                return JsonResponse({'error': 'Forbidden: Teacher profile not found.'}, status=403)
            is_assigned = (
                (session.started_by == teacher) or
                (session.schedule.section.teacher == teacher) or
                session.schedule.section.subjects.filter(teacher=teacher).exists()
            )
            if not is_assigned:
                return JsonResponse({'error': 'Forbidden: You are not assigned to manage this attendance session.'}, status=403)

        frame_bytes = base64_to_bytes(frame_b64)

        # Delegate recognition to FaceService (vectorized, multi-face, cached)
        result = FaceService.recognize_all_faces_in_frame(session, frame_bytes)
        return JsonResponse(result)

    except Exception as e:
        logger.exception("Error during face recognition")
        return JsonResponse({'error': str(e)}, status=500)


@login_required
def delete_face(request):
    """Delete a student's enrolled face data."""
    if request.method != 'POST':
        messages.error(request, 'Invalid request.')
        return redirect('enroll_face')

    user = request.user
    student_id = request.POST.get('student_id')

    # Admin only
    if user.role == 'admin' and student_id:
        student = get_object_or_404(Student, pk=student_id)
    else:
        messages.error(request, 'Permission denied. Face enrollment is managed by the administrator.')
        return redirect('dashboard')

    # Delete the face image file from disk
    if student.face_image:
        import os
        try:
            if os.path.isfile(student.face_image.path):
                os.remove(student.face_image.path)
        except Exception:
            pass
        student.face_image = None

    # Clear encoding + timestamp
    student.face_encoding = None
    student.face_enrolled_at = None
    student.save()
    FaceService.invalidate_cache()

    messages.success(request, 'Face data has been deleted successfully.')
    return redirect('enroll_face')
