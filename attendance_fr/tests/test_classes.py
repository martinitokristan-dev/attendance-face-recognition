"""
Academic & Class Management API Tests
"""
from django.test import TestCase, Client
from accounts.models import CustomUser, Teacher, Student
from core.models import Program, Section, Subject, Schedule, StudentSection


class RestAcademicApiTests(TestCase):
    def setUp(self):
        self.admin = CustomUser.objects.create_user(
            username='api_admin', role='admin', password='StrongPassword123!'
        )
        self.student_u = CustomUser.objects.create_user(
            username='api_student', role='student', first_name='John', last_name='Nash',
            password='StrongPassword123!'
        )
        self.student = Student.objects.create(
            user=self.student_u, student_id='STU-API-101', course='BS Mathematics', year_level=3
        )
        self.program = Program.objects.create(code='CS', name='Computer Science')
        self.subject = Subject.objects.create(code='CS101', name='Intro to CS', units=3)
        self.section = Section.objects.create(name='CS-3A', program=self.program, subject=self.subject)
        self.client = Client()

    def test_programs_list_endpoint(self):
        """GET /api/programs/ returns program entities."""
        self.client.force_login(self.admin)
        res = self.client.get('/api/programs/')
        self.assertEqual(res.status_code, 200)
        self.assertGreaterEqual(len(res.json()), 1)

    def test_subjects_list_endpoint(self):
        """GET /api/subjects/ returns subject catalog."""
        self.client.force_login(self.admin)
        res = self.client.get('/api/subjects/')
        self.assertEqual(res.status_code, 200)

    def test_sections_list_endpoint(self):
        """GET /api/sections/ returns active sections."""
        self.client.force_login(self.admin)
        res = self.client.get('/api/sections/')
        self.assertEqual(res.status_code, 200)


    def test_admin_create_section_api(self):
        """POST /api/sections/ allows administrator to register sections."""
        self.client.force_login(self.admin)
        res = self.client.post(
            '/api/sections/',
            {
                'name': 'CS-4B',
                'program': self.program.pk,
                'course': 'BS Computer Science',
                'year_level': 4,
            },
            content_type='application/json'
        )
        self.assertEqual(res.status_code, 201)

    def test_admin_enroll_student_in_section(self):
        """POST /api/sections/<id>/enrollments/ enrolls student in section."""
        self.client.force_login(self.admin)
        res = self.client.post(
            f'/api/sections/{self.section.pk}/enrollments/',
            {'student_id': self.student.pk},
            content_type='application/json'
        )
        self.assertIn(res.status_code, [200, 201])
        self.assertTrue(StudentSection.objects.filter(student=self.student, section=self.section).exists())

    def test_student_sections_list_is_scoped_to_enrollments(self):
        """Students only see sections they are enrolled in."""
        other_section = Section.objects.create(name='CS-4Z', program=self.program, subject=self.subject)
        StudentSection.objects.create(student=self.student, section=self.section)

        self.client.force_login(self.student_u)
        res = self.client.get('/api/sections/')
        self.assertEqual(res.status_code, 200)
        section_ids = {item['id'] for item in res.json()}
        self.assertEqual(section_ids, {self.section.pk})
        self.assertNotIn(other_section.pk, section_ids)

    def test_student_schedules_list_is_scoped_to_enrollments(self):
        """Students only see schedules for enrolled sections/subjects."""
        other_section = Section.objects.create(name='CS-4Z', program=self.program, subject=self.subject)
        enrolled_schedule = Schedule.objects.create(
            section=self.section,
            subject=self.subject,
            day_of_week='Mon',
            start_time='08:00',
            end_time='09:30',
            room='101',
        )
        Schedule.objects.create(
            section=other_section,
            subject=self.subject,
            day_of_week='Tue',
            start_time='10:00',
            end_time='11:30',
            room='102',
        )
        StudentSection.objects.create(student=self.student, section=self.section)

        self.client.force_login(self.student_u)
        res = self.client.get('/api/schedules/')
        self.assertEqual(res.status_code, 200)
        schedule_ids = {item['id'] for item in res.json()}
        self.assertEqual(schedule_ids, {enrolled_schedule.pk})

    def test_student_cannot_view_unenrolled_section_detail(self):
        """Students cannot fetch section detail for classes they are not enrolled in."""
        other_section = Section.objects.create(name='CS-4Z', program=self.program, subject=self.subject)
        self.client.force_login(self.student_u)
        res = self.client.get(f'/api/sections/{other_section.pk}/')
        self.assertEqual(res.status_code, 404)
