"""
Face Recognition & Biometrics API Tests
"""
from datetime import time
from unittest.mock import patch
from django.test import TestCase, Client
from django.utils import timezone
from accounts.models import CustomUser, Teacher, Student
from core.models import Program, Section, Subject, Schedule, StudentSection, AttendanceSession


class RestFaceRecognitionApiTests(TestCase):
    def setUp(self):
        self.teacher_u = CustomUser.objects.create_user(
            username='fr_teacher', role='teacher', password='StrongPassword123!'
        )
        self.teacher = Teacher.objects.create(user=self.teacher_u, employee_id='EMP-FR-1')

        self.student_u = CustomUser.objects.create_user(
            username='fr_student', role='student', first_name='Ada', last_name='Lovelace',
            password='StrongPassword123!'
        )
        self.student = Student.objects.create(
            user=self.student_u, student_id='STU-FR-001', course='BSCS', year_level=2
        )
        self.program = Program.objects.create(code='IT', name='Info Tech')
        self.subject = Subject.objects.create(code='IT101', name='Intro to Computing', units=3)
        self.section = Section.objects.create(
            name='IT-1A', program=self.program, subject=self.subject, teacher=self.teacher
        )
        self.schedule = Schedule.objects.create(
            section=self.section, day_of_week='Mon',
            start_time=time(9, 0), end_time=time(10, 0), room='Room 303'
        )

        StudentSection.objects.create(student=self.student, section=self.section)
        self.client = Client()

    def test_face_recognition_match_api(self):
        """POST /api/face/recognize/ matches vectors against section enrollment cache."""
        session = AttendanceSession.objects.create(
            schedule=self.schedule, date=timezone.localdate(), started_by=self.teacher, status='open'
        )
        self.client.force_login(self.teacher_u)

        with patch('attendance_fr.api.services.face_recognition.FaceRecognitionService.recognize_faces_for_session', return_value={
            'faces': [{'student_id': self.student.pk, 'name': 'Ada Lovelace', 'confidence': 0.95}],
            'recognized': True
        }):
            res = self.client.post(
                '/api/face/recognize/',
                {'session_id': session.pk, 'frame': 'dummy_b64'},
                content_type='application/json'
            )
            self.assertEqual(res.status_code, 200)
            self.assertTrue(res.json().get('recognized'))
