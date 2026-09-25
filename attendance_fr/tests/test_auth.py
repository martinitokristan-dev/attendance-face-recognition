"""
Authentication & User API Tests
"""
from django.test import TestCase, Client
from accounts.models import CustomUser, Teacher, Student


class RestAuthApiTests(TestCase):
    def setUp(self):
        self.teacher_u = CustomUser.objects.create_user(
            username='api_teacher',
            email='teacher@urios.edu.ph',
            password='StrongPassword123!',
            role='teacher',
            first_name='Alan',
            last_name='Turing'
        )
        self.teacher = Teacher.objects.create(
            user=self.teacher_u,
            employee_id='EMP-TEST-001',
            department='Computer Studies'
        )
        self.client = Client()

    def test_jwt_token_obtain_pair(self):
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

    def test_patch_current_user_profile(self):
        """PATCH /api/auth/me/ updates authenticated user profile fields."""
        self.client.force_login(self.teacher_u)
        res = self.client.patch(
            '/api/auth/me/',
            {'first_name': 'Alan Mathison', 'phone': '09123456789'},
            content_type='application/json'
        )
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data.get('first_name'), 'Alan Mathison')
        self.assertEqual(data.get('phone'), '09123456789')
