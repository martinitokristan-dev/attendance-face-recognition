"""
Reports & Analytics API Tests
"""
from django.test import TestCase, Client
from accounts.models import CustomUser, Teacher, Student
from core.models import Program, Section, Subject, Schedule, StudentSection


class RestReportsApiTests(TestCase):
    def setUp(self):
        self.admin = CustomUser.objects.create_user(
            username='rep_admin', role='admin', password='StrongPassword123!'
        )
        self.student_u = CustomUser.objects.create_user(
            username='rep_student', role='student', first_name='Grace', last_name='Hopper',
            password='StrongPassword123!'
        )
        self.student = Student.objects.create(
            user=self.student_u, student_id='STU-REP-001', course='BSCS', year_level=1
        )
        self.client = Client()

    def test_dashboard_stats_admin(self):
        """GET /api/dashboard/stats/ returns summary metrics for administrator."""
        self.client.force_login(self.admin)
        res = self.client.get('/api/dashboard/stats/')
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data.get('role'), 'admin')
        self.assertIn('total_students', data)
        self.assertIn('total_teachers', data)

    def test_student_attendance_overview_api(self):
        """GET /api/attendance/student/overview/ returns attendance rates."""
        self.client.force_login(self.student_u)
        res = self.client.get('/api/attendance/student/overview/')
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIn('overall_stats', data)
        self.assertIn('student', data)
