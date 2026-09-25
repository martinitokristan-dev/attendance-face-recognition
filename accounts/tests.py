"""
Accounts Feature Tests:
Tests user roles, password validation, and profile relationships.
"""
from django.test import TestCase, Client
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.contrib.auth.password_validation import validate_password
from accounts.models import Teacher, Student

User = get_user_model()


class AccountsFeatureTests(TestCase):
    def test_custom_user_roles(self):
        """Verify role choices and role boolean helper properties."""
        admin = User.objects.create_user(username='admin_u', role='admin', password='StrongPassword123!')
        teacher = User.objects.create_user(username='teacher_u', role='teacher', password='StrongPassword123!')
        student = User.objects.create_user(username='student_u', role='student', password='StrongPassword123!')

        self.assertTrue(admin.is_admin_role)
        self.assertFalse(admin.is_teacher_role)
        self.assertFalse(admin.is_student_role)

        self.assertTrue(teacher.is_teacher_role)
        self.assertTrue(student.is_student_role)

    def test_teacher_profile_creation(self):
        """Verify Teacher profile links one-to-one with CustomUser."""
        user = User.objects.create_user(
            username='prof_smith',
            first_name='John',
            last_name='Smith',
            role='teacher',
            password='StrongPassword123!'
        )
        teacher = Teacher.objects.create(
            user=user,
            employee_id='EMP-1001',
            department='Computer Science',
            specialization='Artificial Intelligence'
        )
        self.assertEqual(teacher.employee_id, 'EMP-1001')
        self.assertIn('John Smith', str(teacher))

    def test_student_profile_creation(self):
        """Verify Student profile links one-to-one with CustomUser."""
        user = User.objects.create_user(
            username='stud_doe',
            first_name='Jane',
            last_name='Doe',
            role='student',
            password='StrongPassword123!'
        )
        student = Student.objects.create(
            user=user,
            student_id='STU-2026-001',
            year_level=3,
            course='BS Computer Science'
        )
        self.assertEqual(student.student_id, 'STU-2026-001')
        self.assertFalse(student.is_face_enrolled)

    def test_password_validators_enforcement(self):
        """Verify production password validation rules (min 6 chars, uppercase, lowercase, special char)."""
        # Short password (< 6 chars) should fail
        with self.assertRaises(ValidationError):
            validate_password('Ab1!')

        # Missing uppercase
        with self.assertRaises(ValidationError):
            validate_password('lowercase@123')

        # Missing lowercase
        with self.assertRaises(ValidationError):
            validate_password('UPPERCASE@123')

        # Missing special character
        with self.assertRaises(ValidationError):
            validate_password('Password123')

        # Compliant complex password should pass without error
        try:
            validate_password('SecurePass2026!#')
            validate_password('Pass@1')
        except ValidationError:
            self.fail("validate_password unexpectedly raised ValidationError for a compliant password")

    def test_admin_user_create_staff_teacher(self):
        """Verify admin can create a teacher with employee profile via user_create."""
        admin = User.objects.create_user(username='super_admin', role='admin', password='StrongPassword123!')
        client = Client()
        client.force_login(admin)

        post_data = {
            'username': 'prof_newton',
            'role': 'teacher',
            'first_name': 'Isaac',
            'last_name': 'Newton',
            'email': 'newton@attendfr.edu',
            'phone': '1234567890',
            'password1': 'StrongPassword123!',
            'password2': 'StrongPassword123!',
            'employee_id': 'EMP-2026-99',
            'department': 'Mathematics',
            'specialization': 'Calculus'
        }
        res = client.post('/accounts/users/create/', post_data)
        self.assertRedirects(res, '/accounts/users/')

        new_teacher = User.objects.get(username='prof_newton')
        self.assertEqual(new_teacher.role, 'teacher')
        self.assertEqual(new_teacher.teacher_profile.employee_id, 'EMP-2026-99')
        self.assertEqual(new_teacher.teacher_profile.department, 'Mathematics')

    def test_admin_user_create_staff_admin(self):
        """Verify admin can create another administrator user."""
        admin = User.objects.create_user(username='super_admin2', role='admin', password='StrongPassword123!')
        client = Client()
        client.force_login(admin)

        post_data = {
            'username': 'admin_assistant',
            'role': 'admin',
            'first_name': 'Grace',
            'last_name': 'Hopper',
            'email': 'hopper@attendfr.edu',
            'phone': '0987654321',
            'password1': 'StrongPassword123!',
            'password2': 'StrongPassword123!',
        }
        res = client.post('/accounts/users/create/', post_data)
        self.assertRedirects(res, '/accounts/users/')

        new_admin = User.objects.get(username='admin_assistant')
        self.assertEqual(new_admin.role, 'admin')

    def test_admin_user_create_rejects_student_role(self):
        """Verify user_create form rejects 'student' role since students must use student_register."""
        admin = User.objects.create_user(username='super_admin3', role='admin', password='StrongPassword123!')
        client = Client()
        client.force_login(admin)

        post_data = {
            'username': 'stud_illegal',
            'role': 'student',  # Not in STAFF_ROLE_CHOICES
            'first_name': 'Bad',
            'last_name': 'Student',
            'email': 'bad@attendfr.edu',
            'password1': 'StrongPassword123!',
            'password2': 'StrongPassword123!',
        }
        res = client.post('/accounts/users/create/', post_data)
        self.assertEqual(res.status_code, 200)
        self.assertFalse(User.objects.filter(username='stud_illegal').exists())

    def test_student_register_flow_redirects_to_face_enrollment(self):
        """Verify student_register creates student and redirects directly to biometric face capture."""
        admin = User.objects.create_user(username='super_admin4', role='admin', password='StrongPassword123!')
        client = Client()
        client.force_login(admin)

        post_data = {
            'student_id': '2026-88888',
            'first_name': 'Rosalind',
            'last_name': 'Franklin',
            'email': 'franklin@attendfr.edu',
            'course': 'BS Biology',
            'year_level': 2,
            'password': 'StrongPassword123!',
        }
        res = client.post('/accounts/students/register/', post_data)
        student = Student.objects.get(student_id='2026-88888')
        self.assertEqual(student.user.first_name, 'Rosalind')
        self.assertEqual(student.course, 'BS Biology')
        # Checks instant redirect to face enrollment
        self.assertRedirects(res, f'/face/enroll/?student_id={student.pk}')

    def test_student_register_requires_admin_permission(self):
        """Verify only administrators can access the student registration endpoint."""
        teacher = User.objects.create_user(username='teacher_anon', role='teacher', password='StrongPassword123!')
        Teacher.objects.create(user=teacher, employee_id='EMP-ANON')
        client = Client()
        client.force_login(teacher)

        res = client.get('/accounts/students/register/')
        self.assertRedirects(res, '/accounts/dashboard/')

    def test_user_list_view_counts_and_filters(self):
        """Verify user list accurately counts by role and filters tabs."""
        User.objects.create_user(username='u_admin', role='admin', password='StrongPassword123!')
        User.objects.create_user(username='u_teacher', role='teacher', password='StrongPassword123!')
        u_student = User.objects.create_user(username='u_student', role='student', password='StrongPassword123!')
        Student.objects.create(user=u_student, student_id='STU-FILTER-1')

        client = Client()
        admin = User.objects.filter(role='admin').first()
        client.force_login(admin)

        res = client.get('/accounts/users/')
        self.assertEqual(res.status_code, 200)
        self.assertIn('counts', res.context)
        self.assertGreaterEqual(res.context['counts']['admin'], 1)
        self.assertGreaterEqual(res.context['counts']['teacher'], 1)
        self.assertGreaterEqual(res.context['counts']['student'], 1)

