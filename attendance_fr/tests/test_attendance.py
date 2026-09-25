"""
Attendance Session & Records API Tests
"""
from datetime import time
from django.test import TestCase, Client
from django.utils import timezone
from accounts.models import CustomUser, Teacher, Student
from core.models import Program, Section, Subject, Schedule, StudentSection, AttendanceSession, AttendanceRecord


class RestAttendanceApiTests(TestCase):
    def setUp(self):
        self.admin = CustomUser.objects.create_user(
            username='api_bio_admin', role='admin', password='StrongPassword123!'
        )
        self.teacher_u = CustomUser.objects.create_user(
            username='api_bio_teacher', role='teacher', password='StrongPassword123!'
        )
        self.teacher = Teacher.objects.create(user=self.teacher_u, employee_id='EMP-BIO-1')

        self.student_u = CustomUser.objects.create_user(
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
        """POST /api/attendance/sessions/{id}/close/ finalizes session."""
        session = AttendanceSession.objects.create(
            schedule=self.schedule, date=timezone.localdate(), started_by=self.teacher, status='open'
        )
        self.client.force_login(self.admin)
        res = self.client.post(f'/api/attendance/sessions/{session.pk}/close/')
        self.assertEqual(res.status_code, 200)
        session.refresh_from_db()
        self.assertEqual(session.status, 'closed')

    def test_attendance_session_reopen_api(self):
        """POST /api/attendance/sessions/{id}/reopen/ reopens a closed session."""
        session = AttendanceSession.objects.create(
            schedule=self.schedule, date=timezone.localdate(), started_by=self.teacher, status='closed'
        )
        self.client.force_login(self.admin)
        res = self.client.post(f'/api/attendance/sessions/{session.pk}/reopen/')
        self.assertEqual(res.status_code, 200)
        session.refresh_from_db()
        self.assertEqual(session.status, 'open')

    def test_manual_attendance_mark_api(self):
        """POST /api/attendance/records/mark/ manually updates student attendance status."""
        session = AttendanceSession.objects.create(
            schedule=self.schedule, date=timezone.localdate(), started_by=self.teacher, status='open'
        )
        self.client.force_login(self.teacher_u)
        res = self.client.post(
            '/api/attendance/records/mark/',
            {
                'session_id': session.pk,
                'student_id': self.student.pk,
                'status': 'present',
            },
            content_type='application/json'
        )
        self.assertEqual(res.status_code, 200)
        record = AttendanceRecord.objects.get(session=session, student=self.student)
        self.assertEqual(record.status, 'present')
