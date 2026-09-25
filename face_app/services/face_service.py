"""
Face Service: Handles face encoding, cached section indexing,
vectorized multi-face matching, and bounding box coordinate calculation.
"""
import json
import logging
import numpy as np
from django.core.cache import cache
from django.conf import settings
from core.models import StudentSection
from core.services.attendance_service import AttendanceService
from face_app.utils import (
    detect_and_encode_all_faces,
    batch_compare_faces,
    draw_face_boxes,
    check_face_liveness,
    pick_face_for_next_attendance,
    _decode_image_to_rgb,
)

logger = logging.getLogger(__name__)

SECTION_CACHE_KEY_PREFIX = 'sec_face_embeddings_'
GLOBAL_CACHE_KEY = 'global_student_face_embeddings'
CONSENSUS_CACHE_PREFIX = 'face_consensus_'
LIVENESS_OK_PREFIX = 'face_liveness_ok_'
CACHE_TIMEOUT = 300  # 5 minutes
LIVENESS_CACHE_TIMEOUT = 90


class FaceService:
    GLOBAL_CACHE_KEY = GLOBAL_CACHE_KEY

    @staticmethod
    def get_section_cache_key(section_id, subject_id=None):
        if subject_id:
            return f"{SECTION_CACHE_KEY_PREFIX}{section_id}_sub_{subject_id}"
        return f"{SECTION_CACHE_KEY_PREFIX}{section_id}"

    @staticmethod
    def invalidate_cache(section_id=None):
        """Clears cached embeddings for a specific section or all sections, plus global index."""
        try:
            cache.delete(FaceService.GLOBAL_CACHE_KEY)
        except Exception:
            pass
        if section_id:
            cache.delete(FaceService.get_section_cache_key(section_id))
            try:
                cache.clear()
            except Exception:
                pass
        else:
            try:
                cache.clear()
            except Exception:
                pass

    @staticmethod
    def get_global_student_encodings():
        """
        Retrieves all registered students across the school with their assigned sections.
        Cached in memory to rapidly detect students scanning in the WRONG section/schedule.
        """
        cached_data = cache.get(FaceService.GLOBAL_CACHE_KEY)
        if cached_data is not None:
            return cached_data

        from accounts.models import Student
        students_qs = Student.objects.select_related('user').prefetch_related(
            'enrollments__section'
        ).exclude(
            face_encoding__isnull=True
        ).exclude(
            face_encoding__exact=''
        )

        students_list = []
        encodings_list = []

        for student in students_qs:
            try:
                encoding = json.loads(student.face_encoding)
                encodings_list.append(encoding)
                sections = [e.section.name for e in student.enrollments.all()]
                sections_str = ", ".join(sections) if sections else "No Section Assigned"
                students_list.append({
                    'id': student.pk,
                    'student_number': student.student_id,
                    'name': student.user.get_full_name() or student.user.username,
                    'assigned_sections': sections_str,
                })
            except (json.JSONDecodeError, TypeError):
                continue

        matrix = np.array(encodings_list, dtype=np.float32) if encodings_list else np.empty((0, 128), dtype=np.float32)

        data = {
            'students': students_list,
            'encodings': encodings_list,
            'matrix': matrix,
        }
        cache.set(FaceService.GLOBAL_CACHE_KEY, data, timeout=CACHE_TIMEOUT)
        return data

    @staticmethod
    def get_section_student_encodings(section, subject=None):
        """
        Retrieves enrolled students with face encodings for a section and optional subject.
        Pre-indexes encodings into a vectorized NumPy matrix for sub-millisecond matching.
        Uses Django cache to avoid repeated DB lookups and JSON parsing per video frame.
        Supports FSUU irregular students: includes block section students (subject=null)
        plus irregular students enrolled specifically in this subject.
        """
        subj_id = subject.pk if (subject and hasattr(subject, 'pk')) else (subject if isinstance(subject, int) else None)
        cache_key = FaceService.get_section_cache_key(section.pk, subj_id)
        cached_data = cache.get(cache_key)
        if cached_data is not None:
            return cached_data

        from django.db.models import Q
        filter_q = Q(section=section)
        if subj_id:
            filter_q &= (Q(subject__isnull=True) | Q(subject_id=subj_id))

        enrollments = StudentSection.objects.filter(
            filter_q
        ).select_related('student__user').exclude(
            student__face_encoding__isnull=True
        ).exclude(
            student__face_encoding__exact=''
        )

        students_list = []
        encodings_list = []
        seen_student_ids = set()

        for enrollment in enrollments:
            student = enrollment.student
            if student.pk in seen_student_ids:
                continue
            seen_student_ids.add(student.pk)
            try:
                encoding = json.loads(student.face_encoding)
                encodings_list.append(encoding)
                students_list.append({
                    'id': student.pk,
                    'student_number': student.student_id,
                    'name': student.user.get_full_name() or student.user.username,
                    'student_obj': student,
                })
            except (json.JSONDecodeError, TypeError):
                continue

        matrix = np.array(encodings_list, dtype=np.float32) if encodings_list else np.empty((0, 128), dtype=np.float32)

        data = {
            'students': students_list,
            'encodings': encodings_list,
            'matrix': matrix,
        }
        cache.set(cache_key, data, timeout=CACHE_TIMEOUT)
        return data

    @staticmethod
    def _consensus_cache_key(session_id):
        return f"{CONSENSUS_CACHE_PREFIX}{session_id}"

    @staticmethod
    def _reset_consensus(session_id):
        cache.delete(FaceService._consensus_cache_key(session_id))

    @staticmethod
    def _consensus_frames_required(match_confidence):
        """Strong matches mark in one frame; weaker matches need consecutive frames."""
        instant = getattr(settings, 'FACE_INSTANT_MARK_CONFIDENCE', 0.70)
        if match_confidence >= instant:
            return 1
        return getattr(settings, 'FACE_CONSENSUS_FRAMES', 2)

    @staticmethod
    def _update_consensus(session_id, student_id):
        """Track consecutive matching frames; returns (streak, required_frame_count)."""
        cache_key = FaceService._consensus_cache_key(session_id)
        data = cache.get(cache_key) or {'student_id': None, 'count': 0}
        if data.get('student_id') == student_id:
            data['count'] += 1
        else:
            data = {'student_id': student_id, 'count': 1}
        cache.set(cache_key, data, timeout=60)
        return data['count']

    @staticmethod
    def recognize_all_faces_in_frame(session, frame_bytes, tolerance=None):
        """
        Accurate single-face recognition with strict matching, liveness check,
        and multi-frame consensus before marking attendance.
        1. Detect all faces, then pick the primary (largest / most centered) face only.
        2. Liveness check rejects photos and screen spoofs.
        3. Strict Euclidean match with confidence floor and second-best margin gate.
        4. Requires FACE_CONSENSUS_FRAMES consecutive matches before first mark.
        """
        if tolerance is None:
            tolerance = getattr(settings, 'FACE_RECOGNITION_TOLERANCE', 0.38)

        all_detected = detect_and_encode_all_faces(
            frame_bytes, downscale=0.42, fast=True
        )
        total_face_count = len(all_detected)
        if not all_detected:
            return {
                'success': True,
                'recognized': [],
                'face_count': 0,
            }

        # Decode frame once for liveness checks
        try:
            img_rgb = _decode_image_to_rgb(frame_bytes)
            frame_h, frame_w = img_rgb.shape[:2]
        except Exception:
            img_rgb = None
            frame_w, frame_h = 640, 480

        section = session.schedule.section
        subject = session.schedule.subject
        section_data = FaceService.get_section_student_encodings(section, subject=subject)
        students = section_data['students']
        section_matrix = section_data.get('matrix')
        if section_matrix is None and section_data.get('encodings'):
            section_matrix = np.array(section_data['encodings'], dtype=np.float32)

        marked_student_ids = set(
            session.records.exclude(status='absent').values_list('student_id', flat=True)
        )

        # Queue mode: prioritize faces that belong to students not yet marked present/late
        detected_faces = pick_face_for_next_attendance(
            all_detected,
            section_matrix,
            students,
            marked_student_ids,
            frame_w,
            frame_h,
            tolerance,
        )

        recognized_results = []

        for face_item in detected_faces:
            face_encoding = face_item.get('encoding')
            box = face_item.get('box', {})

            best_match = None
            best_confidence = 0.0
            unmarked_indices = [
                i for i, student in enumerate(students)
                if student.get('id') not in marked_student_ids
            ]

            if (
                section_matrix is not None
                and len(section_matrix) > 0
                and face_encoding
                and unmarked_indices
            ):
                sub_matrix = section_matrix[unmarked_indices]
                is_match, sub_idx, min_dist, confidence, margin = batch_compare_faces(
                    sub_matrix, face_encoding, tolerance
                )
                if is_match and sub_idx is not None and sub_idx < len(unmarked_indices):
                    best_match = students[unmarked_indices[sub_idx]]
                    best_confidence = confidence

            if not best_match and section_matrix is not None and len(section_matrix) > 0 and face_encoding:
                is_match, best_idx, min_dist, confidence, margin = batch_compare_faces(
                    section_matrix, face_encoding, tolerance
                )
                if is_match and best_idx is not None and best_idx < len(students):
                    candidate = students[best_idx]
                    if candidate.get('id') in marked_student_ids:
                        recognized_results.append({
                            'student_id': candidate['id'],
                            'student_number': candidate['student_number'],
                            'name': candidate['name'],
                            'confidence': round(confidence * 100, 1),
                            'status': session.records.filter(
                                student=candidate['student_obj']
                            ).exclude(status='absent').values_list('status', flat=True).first(),
                            'new_status': None,
                            'box': box,
                            'matched': False,
                            'verifying': False,
                            'already_marked': True,
                        })
                        FaceService._reset_consensus(session.pk)
                        continue

            if best_match:
                student_obj = best_match['student_obj']

                # Liveness only when attempting a new attendance mark
                if img_rgb is not None:
                    is_live, live_score, live_reason = check_face_liveness(img_rgb, box)
                    if not is_live:
                        FaceService._reset_consensus(session.pk)
                        recognized_results.append({
                            'student_id': best_match['id'],
                            'student_number': best_match['student_number'],
                            'name': best_match['name'],
                            'confidence': round(best_confidence * 100, 1),
                            'status': None,
                            'new_status': None,
                            'box': box,
                            'matched': False,
                            'wrong_section': False,
                            'liveness_failed': True,
                            'message': live_reason,
                        })
                        continue

                streak = FaceService._update_consensus(session.pk, best_match['id'])
                required = FaceService._consensus_frames_required(best_confidence)
                consensus_reached = streak >= required

                record, is_new_mark = AttendanceService.mark_attendance(
                    session=session,
                    student=student_obj,
                    confidence=best_confidence
                ) if consensus_reached else (None, False)

                if consensus_reached:
                    FaceService._reset_consensus(session.pk)

                recognized_results.append({
                    'student_id': best_match['id'],
                    'student_number': best_match['student_number'],
                    'name': best_match['name'],
                    'confidence': round(best_confidence * 100, 1),
                    'status': record.status if record else 'verifying',
                    'new_status': record.status if (is_new_mark and consensus_reached) else None,
                    'box': box,
                    'matched': consensus_reached,
                    'verifying': not consensus_reached,
                })
            else:
                FaceService._reset_consensus(session.pk)

                if img_rgb is not None:
                    is_live, live_score, live_reason = check_face_liveness(img_rgb, box)
                    if not is_live:
                        recognized_results.append({
                            'student_id': None,
                            'student_number': None,
                            'name': 'Unknown',
                            'confidence': 0.0,
                            'status': None,
                            'new_status': None,
                            'box': box,
                            'matched': False,
                            'wrong_section': False,
                            'liveness_failed': True,
                            'message': live_reason,
                        })
                        continue

                global_data = FaceService.get_global_student_encodings()
                global_matrix = global_data.get('matrix')
                global_students = global_data.get('students', [])
                wrong_section_match = None
                wrong_section_conf = 0.0

                if global_matrix is not None and len(global_matrix) > 0 and face_encoding:
                    is_match_g, g_idx, dist_g, conf_g, _margin_g = batch_compare_faces(
                        global_matrix, face_encoding, tolerance
                    )
                    if is_match_g and g_idx is not None and g_idx < len(global_students):
                        wrong_section_match = global_students[g_idx]
                        wrong_section_conf = conf_g

                if wrong_section_match:
                    recognized_results.append({
                        'student_id': wrong_section_match['id'],
                        'student_number': wrong_section_match['student_number'],
                        'name': wrong_section_match['name'],
                        'confidence': round(wrong_section_conf * 100, 1),
                        'status': 'wrong_section',
                        'new_status': None,
                        'box': box,
                        'matched': False,
                        'wrong_section': True,
                        'assigned_sections': wrong_section_match.get('assigned_sections', 'Different Section'),
                    })
                else:
                    recognized_results.append({
                        'student_id': None,
                        'student_number': None,
                        'name': 'Unknown',
                        'confidence': 0.0,
                        'status': None,
                        'new_status': None,
                        'box': box,
                        'matched': False,
                        'wrong_section': False,
                    })

        return {
            'success': True,
            'recognized': recognized_results,
            'face_count': total_face_count,
            'scanning_primary': len(detected_faces) == 1,
            'multiple_faces_detected': total_face_count > 1,
        }

    @staticmethod
    def draw_boxes(frame_bytes, recognized_results):
        """Draw bounding boxes and names on the frame image."""
        box_data = []
        for r in recognized_results:
            box = r.get('box', {})
            box_data.append({
                'top': box.get('top', 0),
                'right': box.get('right', 0),
                'bottom': box.get('bottom', 0),
                'left': box.get('left', 0),
                'name': r.get('name', 'Unknown'),
                'status': r.get('status', 'absent'),
            })
        return draw_face_boxes(frame_bytes, box_data)
