"""
Core Feature Tests:
Tests academic structures, 1-to-many teacher sections,
schedule conflict validation, attendance session lifecycle,
dynamic late detection, and API health check.
"""
from datetime import time, timedelta
from django.test import TestCase, Client
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.utils import timezone
from accounts.models import Teacher, Student
from core.models import Subject, Section, Schedule, AttendanceSession, AttendanceRecord, StudentSection
from core.services.schedule_service import ScheduleService
from core.services.attendance_service import AttendanceService

User = get_user_model()


class CoreFeatureTests(TestCase):
    def setUp(self):
        # Create users
        self.admin_user = User.objects.create_user(
            username='admin_boss', first_name='Admin', last_name='Boss',
            role='admin', password='StrongPassword123!'
        )
        self.teacher_user = User.objects.create_user(
            username='prof_albert', first_name='Albert', last_name='Einstein',
            role='teacher', password='StrongPassword123!'
        )
        self.teacher = Teacher.objects.create(
            user=self.teacher_user, employee_id='TCH-001', department='Physics'
        )

        self.student_user = User.objects.create_user(
            username='stud_marie', first_name='Marie', last_name='Curie',
            role='student', password='StrongPassword123!'
        )
        self.student = Student.objects.create(
            user=self.student_user, student_id='STU-2026-002', year_level=2
        )

        # Create Subject
        self.subject = Subject.objects.create(
            name='Data Structures & Algorithms',
            code='CS201',
            units=3
        )

        # Create Section
        self.section_a = Section.objects.create(
            name='BSCS-2A',
            subject=self.subject,
            teacher=self.teacher
        )

    def test_teacher_can_have_many_sections(self):
        """Verify 1 teacher to many sections relationship."""
        section_b = Section.objects.create(
            name='BSCS-2B',
            subject=self.subject,
            teacher=self.teacher
        )
        teacher_sections = self.teacher.sections.all()
        self.assertEqual(teacher_sections.count(), 2)
        self.assertIn(self.section_a, teacher_sections)
        self.assertIn(section_b, teacher_sections)

    def test_schedule_invalid_time_raises_error(self):
        """Verify end_time must be after start_time."""
        sched = Schedule(
            section=self.section_a,
            day_of_week='Mon',
            start_time=time(10, 0),
            end_time=time(9, 0),  # End time before start time
            room='Lab 1'
        )
        with self.assertRaises(ValidationError):
            sched.full_clean()

    def test_schedule_room_conflict_rejected(self):
        """Verify two sections cannot book the same room at overlapping times."""
        # Section A: Mon 08:00 - 10:00 @ Room 301
        Schedule.objects.create(
            section=self.section_a,
            day_of_week='Mon',
            start_time=time(8, 0),
            end_time=time(10, 0),
            room='Room 301'
        )

        # Section B: Mon 09:00 - 11:00 @ Room 301 (Overlaps 09:00-10:00)
        section_b = Section.objects.create(name='BSCS-2B', subject=self.subject)
        conflicting_sched = Schedule(
            section=section_b,
            day_of_week='Mon',
            start_time=time(9, 0),
            end_time=time(11, 0),
            room='Room 301'
        )

        with self.assertRaises(ValidationError) as ctx:
            conflicting_sched.full_clean()
        self.assertIn("Room conflict", str(ctx.exception))

    def test_schedule_teacher_conflict_rejected(self):
        """Verify teacher cannot be scheduled in two sections at overlapping times."""
        # Section A: Tue 13:00 - 15:00 with Teacher Einstein
        Schedule.objects.create(
            section=self.section_a,
            day_of_week='Tue',
            start_time=time(13, 0),
            end_time=time(15, 0),
            room='Room 101'
        )

        # Section B: Tue 14:00 - 16:00 with SAME Teacher Einstein in different room
        section_b = Section.objects.create(
            name='BSCS-2B', subject=self.subject, teacher=self.teacher
        )
        conflicting_sched = Schedule(
            section=section_b,
            day_of_week='Tue',
            start_time=time(14, 0),
            end_time=time(16, 0),
            room='Room 202'
        )

        with self.assertRaises(ValidationError) as ctx:
            conflicting_sched.full_clean()
        self.assertIn("Teacher conflict", str(ctx.exception))

    def test_schedule_non_overlapping_allowed(self):
        """Verify non-overlapping schedules save successfully."""
        sched1 = Schedule.objects.create(
            section=self.section_a,
            day_of_week='Wed',
            start_time=time(8, 0),
            end_time=time(10, 0),
            room='Room 101'
        )
        sched2 = Schedule.objects.create(
            section=self.section_a,
            day_of_week='Wed',
            start_time=time(10, 0),
            end_time=time(12, 0),
            room='Room 101'
        )
        self.assertIsNotNone(sched1.pk)
        self.assertIsNotNone(sched2.pk)

    def test_dynamic_late_status_calculation(self):
        """Verify dynamic late status: present within threshold, late after threshold."""
        schedule = Schedule.objects.create(
            section=self.section_a,
            day_of_week='Thu',
            start_time=time(8, 0),
            end_time=time(10, 0),
            room='Room 404'
        )
        session_date = timezone.localdate()
        session = AttendanceSession.objects.create(
            schedule=schedule,
            date=session_date,
            started_by=self.teacher
        )

        start_dt = timezone.make_aware(
            timezone.datetime.combine(session_date, time(8, 0))
        )

        # Scan at 08:10 (10 mins in, threshold is 15 mins) -> PRESENT
        on_time = start_dt + timedelta(minutes=10)
        status_on_time = AttendanceService.calculate_attendance_status(session, scan_time=on_time)
        self.assertEqual(status_on_time, 'present')

        # Scan at 08:25 (25 mins in, threshold is 15 mins) -> LATE
        late_time = start_dt + timedelta(minutes=25)
        status_late = AttendanceService.calculate_attendance_status(session, scan_time=late_time)
        self.assertEqual(status_late, 'late')

    def test_attendance_service_mark_attendance(self):
        """Verify AttendanceService creates or updates record and avoids duplicate mark."""
        schedule = Schedule.objects.create(
            section=self.section_a,
            day_of_week='Fri',
            start_time=time(9, 0),
            end_time=time(11, 0),
            room='Room 501'
        )
        session = AttendanceSession.objects.create(
            schedule=schedule,
            date=timezone.localdate(),
            started_by=self.teacher
        )
        StudentSection.objects.create(student=self.student, section=self.section_a)

        # Mark attendance first time
        record, is_new = AttendanceService.mark_attendance(session, self.student, confidence=0.95)
        self.assertTrue(is_new)
        self.assertIn(record.status, ['present', 'late'])

        # Mark second time (e.g. repeated face scan)
        record2, is_new2 = AttendanceService.mark_attendance(session, self.student, confidence=0.98)
        self.assertFalse(is_new2)
        self.assertEqual(record.pk, record2.pk)

    def test_health_check_api_endpoint(self):
        """Verify /api/health/ returns 200 and healthy status."""
        client = Client()
        response = client.get('/api/health/')
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data.get('status'), 'healthy')
        self.assertEqual(data.get('database'), 'connected')

    def test_jwt_token_and_auth_me_api(self):
        """Verify POST /api/token/ and GET /api/auth/me/ with Bearer token."""
        client = Client()
        # Request JWT tokens
        res = client.post(
            '/api/token/',
            {'username': 'prof_albert', 'password': 'StrongPassword123!'},
            content_type='application/json'
        )
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIn('access', data)
        self.assertIn('refresh', data)

        access_token = data['access']

        # Request protected user profile endpoint with Bearer token
        res_me = client.get(
            '/api/auth/me/',
            HTTP_AUTHORIZATION=f'Bearer {access_token}'
        )
        self.assertEqual(res_me.status_code, 200)
        user_data = res_me.json()
        self.assertEqual(user_data.get('username'), 'prof_albert')
        self.assertEqual(user_data.get('role'), 'teacher')
        self.assertIn('teacher_profile', user_data)

    def test_dynamic_schedule_display_formatting(self):
        """Verify dynamic schedule display handles M-TH grouping and individual days."""
        # Empty schedules
        self.assertEqual(self.section_a.schedule_display, "No schedule set")

        # Single day
        Schedule.objects.create(
            section=self.section_a, day_of_week='Mon',
            start_time=time(8, 0), end_time=time(9, 30), room='Room 101'
        )
        self.assertEqual(self.section_a.schedule_display, "M 8:00–9:30 AM @ Room 101")

        # Additional day (Thu) at same time and room
        Schedule.objects.create(
            section=self.section_a, day_of_week='Thu',
            start_time=time(8, 0), end_time=time(9, 30), room='Room 101'
        )
        self.assertEqual(self.section_a.schedule_display, "M 8:00–9:30 AM @ Room 101, TH 8:00–9:30 AM @ Room 101")

    def test_dynamic_student_registration_and_section_enrollment(self):
        """Verify registering a new student assigns them to section and redirects to face enrollment."""
        client = Client()
        client.force_login(self.admin_user)

        res = client.post('/accounts/students/register/', {
            'student_id': '2024-99999',
            'first_name': 'Nikola',
            'last_name': 'Tesla',
            'email': 'tesla@attendfr.edu',
            'course': 'BSIT',
            'year_level': 1,
            'section': self.section_a.pk,
            'password': 'SecretPassword@123',
        })

        new_student = Student.objects.get(student_id='2024-99999')
        self.assertEqual(new_student.user.first_name, 'Nikola')
        self.assertEqual(new_student.user.last_name, 'Tesla')
        self.assertEqual(new_student.user.role, 'student')

        # Check section enrollment
        self.assertTrue(
            StudentSection.objects.filter(student=new_student, section=self.section_a).exists()
        )

        # Check redirect directly to face enrollment
        expected_redirect = f"/face/enroll/?student_id={new_student.pk}"
        self.assertRedirects(res, expected_redirect)

    def test_indexed_student_search_api(self):
        """Verify indexed student search filters unenrolled students and respects query terms."""
        client = Client()
        client.force_login(self.admin_user)

        # Create a second student not enrolled in section_a
        student2_user = User.objects.create_user(
            username='stud_isaac', first_name='Isaac', last_name='Newton',
            role='student', password='StrongPassword123!'
        )
        student2 = Student.objects.create(
            user=student2_user, student_id='STU-2026-999', year_level=3, course='BSCS'
        )

        # Search for 'Newton'
        res = client.get(f'/api/students/search/?section_id={self.section_a.pk}&q=Newton')
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(len(data['results']), 1)
        self.assertEqual(data['results'][0]['student_id'], 'STU-2026-999')
        self.assertEqual(data['results'][0]['name'], 'Isaac Newton')

        # Enroll student2 into section_a
        StudentSection.objects.create(student=student2, section=self.section_a)

        # Search again: now student2 should be excluded because they are already enrolled
        res2 = client.get(f'/api/students/search/?section_id={self.section_a.pk}&q=Newton')
        self.assertEqual(res2.status_code, 200)
        data2 = res2.json()
        self.assertEqual(len(data2['results']), 0)

    def test_section_enroll_student_api(self):
        """Verify section enroll API enrolls student and enforces admin role."""
        # Unenrolled student
        student3_user = User.objects.create_user(
            username='stud_alan', first_name='Alan', last_name='Turing',
            role='student', password='StrongPassword123!'
        )
        student3 = Student.objects.create(
            user=student3_user, student_id='STU-2026-777', year_level=4, course='BSCS'
        )

        client = Client()
        # Student cannot enroll
        client.force_login(self.student_user)
        res_fail = client.post(f'/sections/{self.section_a.pk}/enroll/', {'student_id': student3.pk})
        self.assertEqual(res_fail.status_code, 403)

        # Admin can enroll
        client.force_login(self.admin_user)
        res_ok = client.post(f'/sections/{self.section_a.pk}/enroll/', {'student_id': student3.pk}, HTTP_X_REQUESTED_WITH='XMLHttpRequest')
        self.assertEqual(res_ok.status_code, 200)
        self.assertTrue(res_ok.json()['success'])
        self.assertTrue(StudentSection.objects.filter(student=student3, section=self.section_a).exists())

    def test_user_list_role_filter(self):
        """Verify user list filters by role and search query."""
        client = Client()
        client.force_login(self.admin_user)

        res_students = client.get('/accounts/users/?role=student')
        self.assertEqual(res_students.status_code, 200)
        self.assertContains(res_students, 'stud_marie')
        self.assertNotContains(res_students, 'prof_albert')

        res_teachers = client.get('/accounts/users/?role=teacher')
        self.assertEqual(res_teachers.status_code, 200)
        self.assertContains(res_teachers, 'prof_albert')
        self.assertNotContains(res_teachers, 'stud_marie')

        res_search = client.get('/accounts/users/?q=Einstein')
        self.assertEqual(res_search.status_code, 200)
        self.assertContains(res_search, 'Albert Einstein')

    def test_section_catalog_master_list_view(self):
        """Verify section catalog lists master section definitions with college filters."""
        from core.models import Program, ProgramSection
        prog = Program.objects.create(code='CITEC', name='College of Information Technology', college='CITEC')
        ProgramSection.objects.create(program=prog, name='IT 43', year_level=3)

        client = Client()
        client.force_login(self.admin_user)
        res = client.get('/academic/section-catalog/')
        self.assertEqual(res.status_code, 200)
        self.assertContains(res, 'IT 43')
        self.assertContains(res, 'CITEC')
        self.assertContains(res, 'action-popover-dropdown')

    def test_section_detail_view_renders_schedules_and_roster(self):
        """Verify section detail page renders schedules, teacher info, and roster."""
        # Create schedule for section_a
        Schedule.objects.create(
            section=self.section_a,
            day_of_week='Mon',
            start_time=time(8, 0),
            end_time=time(10, 0),
            room='Room 101'
        )
        StudentSection.objects.create(student=self.student, section=self.section_a)

        client = Client()
        client.force_login(self.admin_user)
        res = client.get(f'/sections/{self.section_a.pk}/')
        self.assertEqual(res.status_code, 200)
        self.assertContains(res, 'BSCS-2A')
        self.assertContains(res, 'Room 101')
        self.assertContains(res, 'Albert Einstein')
        self.assertContains(res, 'Marie Curie')

    def test_student_unenroll_removes_enrollment_and_invalidates_cache(self):
        """Verify unenroll endpoint removes student from section."""
        StudentSection.objects.create(student=self.student, section=self.section_a)
        self.assertTrue(StudentSection.objects.filter(student=self.student, section=self.section_a).exists())

        client = Client()
        client.force_login(self.admin_user)
        res = client.post(f'/sections/{self.section_a.pk}/unenroll/{self.student.pk}/')
        self.assertRedirects(res, f'/sections/{self.section_a.pk}/')
        self.assertFalse(StudentSection.objects.filter(student=self.student, section=self.section_a).exists())

    def test_academic_list_views_render_action_popovers(self):
        """Verify list views for programs, subjects, schedules, and sections render 200 with popovers."""
        client = Client()
        client.force_login(self.admin_user)

        # Subject list
        res_subj = client.get('/subjects/')
        self.assertEqual(res_subj.status_code, 200)
        self.assertContains(res_subj, 'action-popover-dropdown')

        # Section list
        res_sec = client.get('/sections/')
        self.assertEqual(res_sec.status_code, 200)
        self.assertContains(res_sec, 'action-popover-dropdown')

        # Schedule list
        Schedule.objects.create(
            section=self.section_a, day_of_week='Tue',
            start_time=time(10, 0), end_time=time(12, 0), room='Room 202'
        )
        res_sched = client.get('/schedules/')
        self.assertEqual(res_sched.status_code, 200)
        self.assertContains(res_sched, 'action-popover-dropdown')

    def test_section_attendance_report_view_today_and_week(self):
        """Verify section attendance report view renders with Today and This Week periods."""
        client = Client()
        client.force_login(self.admin_user)

        res_today = client.get(f'/reports/attendance/?section_id={self.section_a.pk}&period=today')
        self.assertEqual(res_today.status_code, 200)
        self.assertContains(res_today, 'Today')
        self.assertContains(res_today, 'This Week')

        res_week = client.get(f'/reports/attendance/?section_id={self.section_a.pk}&period=week')
        self.assertEqual(res_week.status_code, 200)

    def test_student_attendance_history_calendar_view(self):
        """Verify student attendance history renders Section (Subject name) cards and real-aligned calendar grid."""
        import datetime
        StudentSection.objects.create(student=self.student, section=self.section_a)

        sched = Schedule.objects.create(
            section=self.section_a, day_of_week='Tue',
            start_time=time(8, 0), end_time=time(9, 30), room='Room 101'
        )
        session_date = datetime.date(2026, 9, 22)
        session = AttendanceSession.objects.create(
            schedule=sched, date=session_date, started_by=self.teacher, status='closed'
        )
        AttendanceRecord.objects.create(
            session=session, student=self.student, status='present',
            recognized_at=timezone.now()
        )

        client = Client()
        client.force_login(self.student_user)

        # 1. Main student records page: Enrolled cards only
        res = client.get('/history/')
        self.assertEqual(res.status_code, 200)
        self.assertContains(res, 'BSCS-2A (Data Structures &amp; Algorithms)')
        self.assertContains(res, 'View Attendance')
        self.assertNotContains(res, 'Attendance Graph')

        # 2. Dedicated Section Attendance Page: Full calendar graph & session logs
        res_sec = client.get(f'/history/{self.section_a.pk}/?year=2026&month=9')
        self.assertEqual(res_sec.status_code, 200)
        self.assertContains(res_sec, 'Attendance Graph')
        self.assertContains(res_sec, 'September 2026')
        self.assertContains(res_sec, 'Present')
        # Remarks column should be removed
        self.assertNotContains(res_sec, '<th>Remarks</th>')
        self.assertNotContains(res_sec, '<th>REMARKS</th>')

        # 3. Dynamic rollover to 2027 on dedicated page
        res_2027 = client.get(f'/history/{self.section_a.pk}/?year=2027&month=1')
        self.assertEqual(res_2027.status_code, 200)
        self.assertContains(res_2027, 'January 2027')

    def test_fsuu_single_section_multiple_subjects_and_instructors(self):
        """Verify FSUU model: 1 Section (e.g. IT-43) contains multiple dedicated subjects with separate instructors."""
        teacher2_user = User.objects.create_user(
            username='prof_subrastas', first_name='John Ray', last_name='Subrastas',
            role='teacher', password='StrongPassword123!'
        )
        teacher2 = Teacher.objects.create(user=teacher2_user, employee_id='TCH-002', department='CITEC')

        # Single section IT-43
        sec_it43 = Section.objects.create(name='IT-43')

        # Multiple subjects dedicated to IT-43
        subj_it473 = Subject.objects.create(
            name='System Integration Architecture', code='IT 473', units=3,
            section=sec_it43, teacher=self.teacher
        )
        subj_ge119 = Subject.objects.create(
            name='Living in IT Era', code='GE 119', units=3,
            section=sec_it43, teacher=teacher2
        )
        subj_capstone = Subject.objects.create(
            name='Capstone Project', code='IT 474', units=3,
            section=sec_it43, teacher=None  # Unassigned instructor
        )

        self.assertEqual(sec_it43.subjects.count(), 3)
        self.assertIn(subj_it473, sec_it43.subjects.all())
        self.assertIn(subj_ge119, sec_it43.subjects.all())
        self.assertIn(subj_capstone, sec_it43.subjects.all())
        self.assertEqual(subj_it473.teacher, self.teacher)
        self.assertEqual(subj_ge119.teacher, teacher2)
        self.assertIsNone(subj_capstone.teacher)

    def test_irregular_student_subject_specific_attendance(self):
        """
        Verify FSUU irregular student workflow:
        A 4th year student enrolled in IT-11 for IT 101 ONLY appears in IT 101 attendance,
        and is NOT included or falsely marked absent in MATH 101.
        """
        # Section IT-11
        sec_it11 = Section.objects.create(name='IT-11')
        subj_it101 = Subject.objects.create(name='Intro to Computing', code='IT 101', section=sec_it11, teacher=self.teacher)
        subj_math101 = Subject.objects.create(name='Calculus', code='MATH 101', section=sec_it11, teacher=self.teacher)

        sched_it101 = Schedule.objects.create(
            section=sec_it11, subject=subj_it101, day_of_week='Mon',
            start_time=time(8, 0), end_time=time(9, 30), room='Lab 1'
        )
        sched_math101 = Schedule.objects.create(
            section=sec_it11, subject=subj_math101, day_of_week='Tue',
            start_time=time(10, 0), end_time=time(11, 30), room='Room 301'
        )

        # 1st year regular student (regular block enrollment in IT-11: subject is NULL)
        stud1_user = User.objects.create_user(username='stud_first_year', role='student', password='StrongPassword123!')
        stud_regular = Student.objects.create(user=stud1_user, student_id='STU-2026-101', year_level=1)
        StudentSection.objects.create(student=stud_regular, section=sec_it11, subject=None)

        # 4th year irregular student (irregular subject-specific enrollment in IT-11: subject=subj_it101)
        stud4_user = User.objects.create_user(username='stud_fourth_year_irreg', role='student', password='StrongPassword123!')
        stud_irreg = Student.objects.create(user=stud4_user, student_id='STU-2022-401', year_level=4)
        StudentSection.objects.create(student=stud_irreg, section=sec_it11, subject=subj_it101)

        client = Client()
        client.force_login(self.admin_user)

        # Start Attendance Session for IT 101 (API endpoint)
        res_it101 = client.post(
            '/api/attendance/sessions/start/',
            data={'schedule_id': sched_it101.pk},
            content_type='application/json'
        )
        self.assertEqual(res_it101.status_code, 201)
        session_it101_id = res_it101.data['id']
        session_it101 = AttendanceSession.objects.get(pk=session_it101_id)

        # Both regular student and irregular student MUST be on the roster for IT 101
        it101_roster = AttendanceRecord.objects.filter(session=session_it101)
        self.assertEqual(it101_roster.count(), 2)
        it101_students = [r.student for r in it101_roster]
        self.assertIn(stud_regular, it101_students)
        self.assertIn(stud_irreg, it101_students)

        # Start Attendance Session for MATH 101 (API endpoint)
        res_math101 = client.post(
            '/api/attendance/sessions/start/',
            data={'schedule_id': sched_math101.pk},
            content_type='application/json'
        )
        self.assertEqual(res_math101.status_code, 201)
        session_math101_id = res_math101.data['id']
        session_math101 = AttendanceSession.objects.get(pk=session_math101_id)

        # Regular student MUST be on roster, but irregular student MUST NOT be included in MATH 101
        math101_roster = AttendanceRecord.objects.filter(session=session_math101)
        self.assertEqual(math101_roster.count(), 1)
        self.assertEqual(math101_roster.first().student, stud_regular)
        math101_students = [r.student for r in math101_roster]
        self.assertNotIn(stud_irreg, math101_students)

    def test_section_enrollment_api_endpoints(self):
        """Verify GET/POST/DELETE on /api/sections/<pk>/enrollments/."""
        client = Client()
        client.force_login(self.admin_user)

        sec = Section.objects.create(name='IT-43')
        subj = Subject.objects.create(name='Living in IT Era', code='GE 119', section=sec)

        # 1. Enroll regular student (subject=None)
        res_reg = client.post(
            f'/api/sections/{sec.pk}/enrollments/',
            data={'student_id': self.student.pk},
            content_type='application/json'
        )
        self.assertEqual(res_reg.status_code, 201)
        self.assertIsNone(res_reg.data['subject'])
        enrollment_id = res_reg.data['id']

        # 2. List enrollments
        res_list = client.get(f'/api/sections/{sec.pk}/enrollments/')
        self.assertEqual(res_list.status_code, 200)
        self.assertEqual(len(res_list.data), 1)

        # 3. Enroll irregular student into GE 119
        stud2_user = User.objects.create_user(username='stud_irreg2', role='student', password='StrongPassword123!')
        stud2 = Student.objects.create(user=stud2_user, student_id='STU-IRREG-2')
        res_irreg = client.post(
            f'/api/sections/{sec.pk}/enrollments/',
            data={'student_id': stud2.pk, 'subject_id': subj.pk},
            content_type='application/json'
        )
        self.assertEqual(res_irreg.status_code, 201)
        self.assertEqual(res_irreg.data['subject'], subj.pk)
        self.assertEqual(res_irreg.data['subject_code'], 'GE 119')

        # 4. Remove enrollment
        res_del = client.delete(f'/api/sections/{sec.pk}/enrollments/{enrollment_id}/')
        self.assertEqual(res_del.status_code, 200)
        self.assertFalse(StudentSection.objects.filter(pk=enrollment_id).exists())




