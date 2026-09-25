"""
AttendFR Centralized REST API Test Suite.
Validates all JWT authentication, academic resources, attendance sessions, and biometric endpoints.
"""
import io
import json
import base64
from datetime import time
from unittest.mock import patch
from PIL import Image

from django.test import TestCase, Client
from django.contrib.auth import get_user_model
from django.utils import timezone

from accounts.models import Teacher, Student
from core.models import Program, Subject, Section, Schedule, AttendanceSession, StudentSection

User = get_user_model()


class RestAuthenticationApiTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username='api_teacher',
            email='teacher@attendfr.edu',
            role='teacher',
            first_name='Marie',
            last_name='Curie',
            password='StrongPassword123!'
        )
        self.teacher = Teacher.objects.create(
            user=self.user,
            employee_id='EMP-API-01',
            department='Physics'
        )
        self.client = Client()

    def test_jwt_token_pair_generation(self):
        """POST /api/token/ generates JWT access & refresh tokens."""
        res = self.client.post(
            '/api/token/',
            {'username': 'api_teacher', 'password': 'StrongPassword123!'},
            content_type='application/json'
        )
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIn('access', data)
        self.assertIn('refresh', data)

    def test_jwt_token_refresh_cycle(self):
        """POST /api/token/refresh/ cycles and grants fresh access token."""
        token_res = self.client.post(
            '/api/token/',
            {'username': 'api_teacher', 'password': 'StrongPassword123!'},
            content_type='application/json'
        )
        refresh_token = token_res.json()['refresh']

        res = self.client.post(
            '/api/token/refresh/',
            {'refresh': refresh_token},
            content_type='application/json'
        )
        self.assertEqual(res.status_code, 200)
        self.assertIn('access', res.json())

    def test_authenticated_user_profile(self):
        """GET /api/auth/me/ returns authenticated user role and profile details."""
        token_res = self.client.post(
            '/api/token/',
            {'username': 'api_teacher', 'password': 'StrongPassword123!'},
            content_type='application/json'
        )
        access_token = token_res.json()['access']

        res = self.client.get(
            '/api/auth/me/',
            HTTP_AUTHORIZATION=f'Bearer {access_token}'
        )
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data.get('username'), 'api_teacher')
        self.assertEqual(data.get('role'), 'teacher')
        self.assertIn('teacher_profile', data)


class RestAcademicApiTests(TestCase):
    def setUp(self):
        self.admin = User.objects.create_user(
            username='api_admin', role='admin', password='StrongPassword123!'
        )
        self.student_u = User.objects.create_user(
            username='api_student', role='student', first_name='John', last_name='Nash',
            password='StrongPassword123!'
        )
        self.student = Student.objects.create(
            user=self.student_u, student_id='STU-API-101', course='BS Mathematics', year_level=3
        )
        self.program = Program.objects.create(code='CS', name='Computer Science')
        self.subject = Subject.objects.create(code='CS201', name='Data Structures', units=3)
        self.section = Section.objects.create(
            name='CS-2A', program=self.program, subject=self.subject
        )
        self.schedule = Schedule.objects.create(
            section=self.section, day_of_week='Mon',
            start_time=time(9, 0), end_time=time(11, 0), room='Lab 4'
        )
        self.client = Client()

    def test_subject_catalog_api(self):
        """GET /api/subjects/ returns active subject catalog."""
        self.client.force_login(self.admin)
        res = self.client.get('/api/subjects/')
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertGreaterEqual(len(data), 1)

    def test_section_catalog_api(self):
        """GET /api/sections/ returns section roster definitions."""
        self.client.force_login(self.admin)
        res = self.client.get('/api/sections/')
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertGreaterEqual(len(data), 1)

    def test_schedule_matrix_api(self):
        """GET /api/schedules/ returns scheduled timeslots."""
        self.client.force_login(self.admin)
        res = self.client.get('/api/schedules/')
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertGreaterEqual(len(data), 1)

    def test_indexed_student_search_api(self):
        """GET /api/students/search/ provides fast indexed typeahead candidate search."""
        self.client.force_login(self.admin)
        res = self.client.get(f'/api/students/search/?section_id={self.section.pk}&q=Nash')
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(len(data.get('results', [])), 1)
        self.assertEqual(data['results'][0]['student_id'], 'STU-API-101')

    def test_bola_secured_section_enrollment_api(self):
        """POST /sections/{id}/enroll/ secures enrollment against unprivileged escalation."""
        # Student cannot enroll
        self.client.force_login(self.student_u)
        res_denied = self.client.post(f'/sections/{self.section.pk}/enroll/', {'student_id': self.student.pk})
        self.assertEqual(res_denied.status_code, 403)

        # Admin can enroll
        self.client.force_login(self.admin)
        res_ok = self.client.post(
            f'/sections/{self.section.pk}/enroll/',
            {'student_id': self.student.pk},
            HTTP_X_REQUESTED_WITH='XMLHttpRequest'
        )
        self.assertEqual(res_ok.status_code, 200)
        self.assertTrue(res_ok.json().get('success'))


class RestAttendanceBiometricsApiTests(TestCase):
    def setUp(self):
        self.admin = User.objects.create_user(
            username='api_bio_admin', role='admin', password='StrongPassword123!'
        )
        self.teacher_u = User.objects.create_user(
            username='api_bio_teacher', role='teacher', password='StrongPassword123!'
        )
        self.teacher = Teacher.objects.create(user=self.teacher_u, employee_id='EMP-BIO-1')

        self.student_u = User.objects.create_user(
            username='api_bio_student', role='student', first_name='Ada', last_name='Lovelace',
            password='StrongPassword123!'
        )
        self.student = Student.objects.create(
            user=self.student_u, student_id='STU-BIO-001', course='BSCS', year_level=2
        )
        self.program = Program.objects.create(code='IT', name='Info Tech')
        self.subject = Subject.objects.create(code='IT101', name='Intro to Computing', units=3)
        self.section = Section.objects.create(
            name='IT-1A', program=self.program, subject=self.subject, teacher=self.teacher
        )
        today = timezone.localdate()
        weekday_map = {0: 'Mon', 1: 'Tue', 2: 'Wed', 3: 'Thu', 4: 'Fri', 5: 'Sat', 6: 'Sun'}
        today_code = weekday_map[today.weekday()]
        now = timezone.localtime(timezone.now())
        start_t = (now - timezone.timedelta(minutes=15)).time()
        end_t = (now + timezone.timedelta(minutes=45)).time()

        self.schedule = Schedule.objects.create(
            section=self.section, day_of_week=today_code,
            start_time=start_t, end_time=end_t, room='Room 303'
        )
        StudentSection.objects.create(student=self.student, section=self.section)
        self.client = Client()

    def test_system_health_probe_api(self):
        """GET /api/health/ verifies database and service health status."""
        res = self.client.get('/api/health/')
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data.get('status'), 'healthy')
        self.assertEqual(data.get('database'), 'connected')

    def test_attendance_sessions_list_api(self):
        """GET /api/attendance/sessions/ queries historical and active sessions."""
        self.client.force_login(self.admin)
        res = self.client.get('/api/attendance/sessions/')
        self.assertEqual(res.status_code, 200)

    def test_attendance_session_start_api(self):
        """POST /api/attendance/sessions/start/ launches live session for assigned schedule within class hours."""
        self.client.force_login(self.teacher_u)
        res = self.client.post(
            '/api/attendance/sessions/start/',
            {'schedule_id': self.schedule.pk},
            content_type='application/json'
        )
        self.assertIn(res.status_code, [200, 201])
        data = res.json()
        self.assertEqual(data.get('status'), 'open')

    def test_attendance_session_start_outside_schedule_window(self):
        """Teacher cannot start attendance session outside scheduled day/time."""
        other_day = 'Tue' if self.schedule.day_of_week != 'Tue' else 'Wed'
        off_schedule = Schedule.objects.create(
            section=self.section, day_of_week=other_day,
            start_time=time(1, 0), end_time=time(2, 0), room='Room 303'
        )
        self.client.force_login(self.teacher_u)
        res = self.client.post(
            '/api/attendance/sessions/start/',
            {'schedule_id': off_schedule.pk},
            content_type='application/json'
        )
        self.assertEqual(res.status_code, 403)
        self.assertIn('cannot be started', res.json().get('error', ''))

    def test_attendance_session_close_api(self):
        """POST /api/attendance/sessions/{id}/close/ finalizes session roster."""
        session = AttendanceSession.objects.create(
            schedule=self.schedule, date=timezone.localdate(), started_by=self.teacher, status='open'
        )
        self.client.force_login(self.admin)
        res = self.client.post(f'/api/attendance/sessions/{session.pk}/close/')
        self.assertEqual(res.status_code, 200)
        session.refresh_from_db()
        self.assertEqual(session.status, 'closed')

    def test_face_recognition_match_api(self):
        """POST /api/face/recognize/ matches vectors against section enrollment cache."""
        session = AttendanceSession.objects.create(
            schedule=self.schedule, date=timezone.localdate(), started_by=self.teacher, status='open'
        )
        self.client.force_login(self.teacher_u)

        mock_vector = [0.15] * 128
        with patch('face_app.services.face_service.FaceService.recognize_all_faces_in_frame', return_value={
            'faces': [{'student_id': self.student.pk, 'name': 'Ada Lovelace', 'confidence': 0.95}],
            'recognized': True
        }):
            res = self.client.post(
                '/api/face/recognize/',
                {'session_id': session.pk, 'frame': 'dummy_b64'},
                content_type='application/json'
            )
            self.assertEqual(res.status_code, 200)

    def test_face_enrollment_capture_api(self):
        """POST /face/enroll/capture/ persists 128-D biometric embeddings."""
        self.client.force_login(self.admin)

        buf = io.BytesIO()
        im = Image.new('RGB', (40, 40), color='white')
        im.save(buf, format='JPEG')
        valid_b64 = 'data:image/jpeg;base64,' + base64.b64encode(buf.getvalue()).decode('utf-8')

        mock_vector = [0.33] * 128
        with patch('face_app.views.encode_face_from_frame', return_value=(mock_vector, [{'top': 5, 'right': 35, 'bottom': 35, 'left': 5}])):
            payload = {'student_id': self.student.pk, 'frame': valid_b64}
            res = self.client.post('/face/enroll/capture/', json.dumps(payload), content_type='application/json')
            self.assertEqual(res.status_code, 200)
            self.assertTrue(res.json().get('success'))
