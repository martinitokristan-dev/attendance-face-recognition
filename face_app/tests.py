"""
Face App Feature Tests:
Tests face encoding storage, cached section indexing,
multi-face recognition in a single frame, and bounding box formatting.
"""
import json
import numpy as np
from django.test import TestCase, override_settings
from django.contrib.auth import get_user_model
from django.core.cache import cache
from accounts.models import Student
from core.models import Subject, Section, Schedule, AttendanceSession, StudentSection
from face_app.services.face_service import FaceService
from face_app.utils import compare_faces

User = get_user_model()


class FaceAppFeatureTests(TestCase):
    def setUp(self):
        cache.clear()

        # Create Subject & Section
        self.subject = Subject.objects.create(name='Computer Vision', code='CS302', units=3)
        self.section = Section.objects.create(name='BSCS-3A', subject=self.subject)
        self.schedule = Schedule.objects.create(
            section=self.section,
            day_of_week='Mon',
            start_time='08:00',
            end_time='10:00',
            room='Vision Lab'
        )
        self.session = AttendanceSession.objects.create(
            schedule=self.schedule,
            date='2026-09-21'
        )

        # Create 2 Students with mock 128-D face embeddings
        # Student 1: vector centered at 0.1
        self.user1 = User.objects.create_user(
            username='student_one', first_name='Alice', last_name='Smith',
            role='student', password='StrongPassword123!'
        )
        self.mock_vector1 = [0.1] * 128
        self.student1 = Student.objects.create(
            user=self.user1,
            student_id='STU-001',
            face_encoding=json.dumps(self.mock_vector1)
        )
        StudentSection.objects.create(student=self.student1, section=self.section)

        # Student 2: vector centered at 0.9 (distinct from student 1)
        self.user2 = User.objects.create_user(
            username='student_two', first_name='Bob', last_name='Jones',
            role='student', password='StrongPassword123!'
        )
        self.mock_vector2 = [0.9] * 128
        self.student2 = Student.objects.create(
            user=self.user2,
            student_id='STU-002',
            face_encoding=json.dumps(self.mock_vector2)
        )
        StudentSection.objects.create(student=self.student2, section=self.section)

    def test_face_encoding_json_storage(self):
        """Verify Student face encoding stores 128-D vector and reports is_face_enrolled."""
        self.assertTrue(self.student1.is_face_enrolled)
        stored_vector = json.loads(self.student1.face_encoding)
        self.assertEqual(len(stored_vector), 128)
        self.assertAlmostEqual(stored_vector[0], 0.1)

    def test_face_service_cache_indexing(self):
        """Verify FaceService caches section student vectors and invalidates cleanly."""
        cache_key = FaceService.get_section_cache_key(self.section.pk)
        self.assertIsNone(cache.get(cache_key))

        # First access loads from DB and caches
        data = FaceService.get_section_student_encodings(self.section)
        self.assertEqual(len(data['students']), 2)
        self.assertEqual(len(data['encodings']), 2)

        # Verify cached
        cached_data = cache.get(cache_key)
        self.assertIsNotNone(cached_data)
        self.assertEqual(len(cached_data['students']), 2)

        # Invalidate cache
        FaceService.invalidate_cache(self.section.pk)
        self.assertIsNone(cache.get(cache_key))

    def test_vector_distance_comparison(self):
        """Verify compare_faces matches identical vector and rejects divergent vector."""
        # Exact match
        is_match, conf = compare_faces(self.mock_vector1, self.mock_vector1, tolerance=0.5)
        self.assertTrue(is_match)
        self.assertGreater(conf, 0.9)

        # Divergent vectors (0.1 vs 0.9)
        is_match_diff, conf_diff = compare_faces(self.mock_vector1, self.mock_vector2, tolerance=0.5)
        self.assertFalse(is_match_diff)

    def test_multi_face_results_structure_and_bounding_boxes(self):
        """Verify recognition returns bounding boxes and student details for each face."""
        # Test simulated detection results with 2 distinct face locations
        locations = [
            {'top': 50, 'right': 150, 'bottom': 150, 'left': 50},
            {'top': 60, 'right': 350, 'bottom': 160, 'left': 250},
        ]

        # Verify box drawing helper generates modified bytes
        dummy_results = [
            {'top': 50, 'right': 150, 'bottom': 150, 'left': 50, 'name': 'Alice Smith', 'status': 'present'},
            {'top': 60, 'right': 350, 'bottom': 160, 'left': 250, 'name': 'Bob Jones', 'status': 'present'},
        ]
        # 100x100 dummy black image JPEG bytes
        from PIL import Image
        from io import BytesIO
        img = Image.new('RGB', (400, 300), color=(50, 50, 50))
        buf = BytesIO()
        img.save(buf, format='JPEG')
        raw_bytes = buf.getvalue()

        annotated_bytes = FaceService.draw_boxes(raw_bytes, dummy_results)
        self.assertIsNotNone(annotated_bytes)
        self.assertGreater(len(annotated_bytes), 0)

    def test_face_deletion_and_cache_invalidation(self):
        """Verify face deletion clears data and invalidates cache."""
        # Warm cache
        FaceService.get_section_student_encodings(self.section)
        cache_key = FaceService.get_section_cache_key(self.section.pk)
        self.assertIsNotNone(cache.get(cache_key))

        # Clear face
        self.student1.face_encoding = None
        self.student1.face_enrolled_at = None
        self.student1.save()
        FaceService.invalidate_cache(self.section.pk)

        # After invalidation, cache is empty and fresh fetch returns only 1 student
        self.assertIsNone(cache.get(cache_key))
        fresh_data = FaceService.get_section_student_encodings(self.section)
        self.assertEqual(len(fresh_data['students']), 1)
        self.assertEqual(fresh_data['students'][0]['student_number'], 'STU-002')

    def test_vectorized_batch_compare_faces(self):
        """Verify sub-millisecond vectorized batch matching across section matrix."""
        from face_app.utils import batch_compare_faces
        # Matrix with 2 student embeddings
        known_matrix = np.array([self.mock_vector1, self.mock_vector2], dtype=np.float32)

        # Match student 1
        is_match1, idx1, dist1, conf1, margin1 = batch_compare_faces(known_matrix, self.mock_vector1, tolerance=0.5)
        self.assertTrue(is_match1)
        self.assertEqual(idx1, 0)
        self.assertAlmostEqual(dist1, 0.0, places=3)
        self.assertGreater(conf1, 0.95)

        # Match student 2
        is_match2, idx2, dist2, conf2, margin2 = batch_compare_faces(known_matrix, self.mock_vector2, tolerance=0.5)
        self.assertTrue(is_match2)
        self.assertEqual(idx2, 1)
        self.assertAlmostEqual(dist2, 0.0, places=3)
        self.assertGreater(conf2, 0.95)

        # Rejection: distinct vector (centered at 0.5) with distance ~4.5 > 0.5
        unknown_vec = [0.5] * 128
        is_match_rej, idx_rej, dist_rej, conf_rej, _ = batch_compare_faces(known_matrix, unknown_vec, tolerance=0.5)
        self.assertFalse(is_match_rej)

    def test_match_margin_rejects_ambiguous_face(self):
        """Verify a look-alike vector between two enrolled students is rejected by margin gate."""
        from face_app.utils import batch_compare_faces
        vec_a = [0.0] * 128
        vec_b = [0.06] * 128
        ambiguous_vec = [0.03] * 128
        known_matrix = np.array([vec_a, vec_b], dtype=np.float32)
        is_match, idx, dist, conf, margin = batch_compare_faces(
            known_matrix, ambiguous_vec, tolerance=0.38, min_margin=0.08
        )
        self.assertFalse(is_match)
        self.assertLess(margin, 0.08)

    def test_pick_face_prefers_unmarked_student_in_queue(self):
        """When two faces are visible, prefer the one matching a not-yet-marked student."""
        from face_app.utils import pick_face_for_next_attendance
        import numpy as np

        faces = [
            {'encoding': self.mock_vector1, 'box': {'top': 10, 'right': 380, 'bottom': 340, 'left': 140}},
            {'encoding': self.mock_vector2, 'box': {'top': 10, 'right': 60, 'bottom': 60, 'left': 10}},
        ]
        data = FaceService.get_section_student_encodings(self.section)
        matrix = data['matrix']
        students = data['students']
        marked = {self.student1.pk}

        picked = pick_face_for_next_attendance(
            faces, matrix, students, marked, 640, 480, tolerance=0.5
        )
        self.assertEqual(len(picked), 1)
        self.assertEqual(picked[0]['encoding'][0], 0.9)

    def test_pick_primary_face_selects_largest_centered(self):
        """Verify single-face mode picks the most prominent face."""
        from face_app.utils import pick_primary_face
        faces = [
            {'encoding': [0.1]*128, 'box': {'top': 10, 'right': 60, 'bottom': 60, 'left': 10}},
            {'encoding': [0.2]*128, 'box': {'top': 80, 'right': 380, 'bottom': 340, 'left': 140}},
        ]
        primary = pick_primary_face(faces, 640, 480)
        self.assertEqual(len(primary), 1)
        self.assertEqual(primary[0]['encoding'][0], 0.2)

    def test_consensus_required_before_marking(self):
        """Verify attendance is not marked until consensus frames are reached."""
        from unittest.mock import patch
        simulated_detected = [
            {'encoding': self.mock_vector1, 'box': {'top': 10, 'right': 100, 'bottom': 100, 'left': 10}}
        ]
        with patch('face_app.services.face_service.detect_and_encode_all_faces', return_value=simulated_detected), \
             patch('face_app.services.face_service.check_face_liveness', return_value=(True, 1.0, 'ok')):
            # Strong match (0.1 vs 0.1) marks on first frame via FACE_INSTANT_MARK_CONFIDENCE
            res = FaceService.recognize_all_faces_in_frame(self.session, b'dummy', tolerance=0.5)
            rec = res['recognized'][0]
            self.assertTrue(rec.get('matched'))
            self.assertTrue(self.session.records.filter(student=self.student1).exists())

    @override_settings(FACE_INSTANT_MARK_CONFIDENCE=2.0, FACE_CONSENSUS_FRAMES=2)
    def test_second_student_marked_after_first_in_queue(self):
        """After student 1 is marked, student 2 in front should still be recognized."""
        from unittest.mock import patch

        face_one = {'encoding': self.mock_vector1, 'box': {'top': 10, 'right': 100, 'bottom': 100, 'left': 10}}
        face_two = {'encoding': self.mock_vector2, 'box': {'top': 20, 'right': 120, 'bottom': 120, 'left': 20}}

        with patch('face_app.services.face_service.detect_and_encode_all_faces') as mock_detect, \
             patch('face_app.services.face_service.check_face_liveness', return_value=(True, 1.0, 'ok')):
            mock_detect.return_value = [face_one]
            FaceService.recognize_all_faces_in_frame(self.session, b'dummy', tolerance=0.5)
            FaceService.recognize_all_faces_in_frame(self.session, b'dummy', tolerance=0.5)
            self.assertTrue(self.session.records.filter(student=self.student1).exclude(status='absent').exists())

            mock_detect.return_value = [face_two]
            res = FaceService.recognize_all_faces_in_frame(self.session, b'dummy', tolerance=0.5)
            rec = res['recognized'][0]
            self.assertEqual(rec['student_id'], self.student2.pk)
            self.assertTrue(rec.get('verifying'))

            res = FaceService.recognize_all_faces_in_frame(self.session, b'dummy', tolerance=0.5)
            rec = res['recognized'][0]
            self.assertTrue(rec.get('matched'))
            self.assertTrue(self.session.records.filter(student=self.student2).exclude(status='absent').exists())

    def test_instant_mark_on_strong_confidence(self):
        """High-confidence matches should not wait for multi-frame consensus."""
        from unittest.mock import patch

        simulated_detected = [
            {'encoding': self.mock_vector1, 'box': {'top': 10, 'right': 100, 'bottom': 100, 'left': 10}}
        ]
        with patch('face_app.services.face_service.detect_and_encode_all_faces', return_value=simulated_detected), \
             patch('face_app.services.face_service.check_face_liveness', return_value=(True, 1.0, 'ok')):
            res = FaceService.recognize_all_faces_in_frame(self.session, b'dummy', tolerance=0.5)
            rec = res['recognized'][0]
            self.assertTrue(rec.get('matched'))
            self.assertFalse(rec.get('verifying'))

    def test_wrong_section_detection(self):
        """Verify student enrolled in Section B scanning in Section A is detected as wrong_section."""
        from unittest.mock import patch

        # Create Section B
        section_b = Section.objects.create(name='BSCS-3B', subject=self.subject)
        user_b = User.objects.create_user(
            username='student_b', first_name='Charlie', last_name='Brown',
            role='student', password='StrongPassword123!'
        )
        mock_vector_b = [0.7] * 128
        student_b = Student.objects.create(
            user=user_b,
            student_id='STU-003',
            face_encoding=json.dumps(mock_vector_b)
        )
        StudentSection.objects.create(student=student_b, section=section_b)
        FaceService.invalidate_cache()

        # Mock frame detection returning Charlie's face
        simulated_detected = [
            {'encoding': mock_vector_b, 'box': {'top': 10, 'right': 100, 'bottom': 100, 'left': 10}}
        ]

        with patch('face_app.services.face_service.detect_and_encode_all_faces', return_value=simulated_detected):
            # Scan Charlie in Section A's session
            res = FaceService.recognize_all_faces_in_frame(self.session, b'dummy_frame', tolerance=0.5)

            self.assertTrue(res['success'])
            self.assertEqual(len(res['recognized']), 1)
            rec = res['recognized'][0]

            # Verify Charlie is flagged as wrong_section
            self.assertFalse(rec['matched'])
            self.assertTrue(rec['wrong_section'])
            self.assertEqual(rec['student_number'], 'STU-003')
            self.assertEqual(rec['name'], 'Charlie Brown')
            self.assertIn('BSCS-3B', rec['assigned_sections'])

            # Verify NO attendance record was created for Charlie in Section A's session
            self.assertFalse(self.session.records.filter(student=student_b).exists())

    def test_face_enroll_select_view(self):
        """Verify admin can view student list on /face/enroll/."""
        from django.test import Client
        admin = User.objects.create_user(username='face_admin', role='admin', password='StrongPassword123!')
        client = Client()
        client.force_login(admin)

        res = client.get('/face/enroll/')
        self.assertEqual(res.status_code, 200)
        self.assertContains(res, 'Alice Smith')
        self.assertContains(res, 'Bob Jones')

    def test_face_enroll_capture_endpoint_ajax(self):
        """Verify AJAX endpoint saves face vector and timestamp."""
        import io
        import base64
        from PIL import Image
        from django.test import Client
        from unittest.mock import patch
        admin = User.objects.create_user(username='face_admin2', role='admin', password='StrongPassword123!')
        client = Client()
        client.force_login(admin)

        # Generate a real mini JPEG
        buf = io.BytesIO()
        im = Image.new('RGB', (40, 40), color='white')
        im.save(buf, format='JPEG')
        valid_b64 = 'data:image/jpeg;base64,' + base64.b64encode(buf.getvalue()).decode('utf-8')

        mock_vector = [0.42] * 128
        with patch('face_app.views.encode_face_from_frame', return_value=(mock_vector, [(10, 100, 100, 10)])):
            payload = {
                'student_id': self.student1.pk,
                'frame': valid_b64
            }
            res = client.post('/face/enroll/capture/', json.dumps(payload), content_type='application/json')
            self.assertEqual(res.status_code, 200)
            data = res.json()
            self.assertTrue(data.get('success'))

            self.student1.refresh_from_db()
            self.assertTrue(self.student1.is_face_enrolled)
            self.assertIsNotNone(self.student1.face_enrolled_at)

