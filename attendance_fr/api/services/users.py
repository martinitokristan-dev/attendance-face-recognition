"""
User & Student Service
Handles business logic for user creation, updates, and student ID generation.
Extracted from api_views.py (UserListCreateAPIView, UserDetailAPIView, NextStudentIdAPIView).
"""
import re
from django.db import transaction

from accounts.models import CustomUser, Teacher, Student


# ── Validation Helpers ──────────────────────────────────────────────────────

def validate_ph_phone(phone):
    """Validates 11-digit Philippine mobile format (09XXXXXXXXX)."""
    if not phone:
        return None
    phone_clean = re.sub(r'\D', '', str(phone).strip())
    if not re.match(r'^09\d{9}$', phone_clean):
        return 'Phone number must be an 11-digit Philippine mobile number starting with 09 (e.g. 09123456789).'
    return None


def validate_password_strength(password):
    """Validates 5 password criteria: min 8 chars, 1 number, 1 lower, 1 upper, 1 special."""
    if not password:
        return 'Password cannot be empty.'
    p = str(password)
    missing = []
    if len(p) < 8:
        missing.append('at least 8 characters')
    if not re.search(r'\d', p):
        missing.append('at least 1 number')
    if not re.search(r'[a-z]', p):
        missing.append('at least 1 lowercase letter')
    if not re.search(r'[A-Z]', p):
        missing.append('at least 1 uppercase letter')
    if not re.search(r'[!@#$%^&*(),.?":{}|<>_~`\-+=\\\[\]]', p):
        missing.append('at least 1 special character')
    if missing:
        return f"Password must contain: {', '.join(missing)}."
    return None


# ── Student ID Generator ─────────────────────────────────────────────────────

def get_next_student_id():
    """
    Finds the highest existing student_id matching '23100000' + digits.
    Returns the next sequential ID, e.g. '23100000450'.
    """
    prefix = "23100000"
    existing_ids = Student.objects.filter(student_id__startswith=prefix).values_list('student_id', flat=True)
    max_suffix = 449  # Baseline according to current database state
    for sid in existing_ids:
        suffix_str = str(sid)[len(prefix):]
        if suffix_str.isdigit():
            val = int(suffix_str)
            if val > max_suffix:
                max_suffix = val
    return f"{prefix}{max_suffix + 1}"


# ── User Service ─────────────────────────────────────────────────────────────

class UserService:

    @staticmethod
    def create_user(data):
        """
        Creates a user (admin/teacher/student) with appropriate profile.
        Returns the created CustomUser.
        Raises ValueError on validation failures.
        """
        role = data.get('role', 'teacher')
        student_id = ''

        if role == 'student':
            raw_sid = data.get('student_id', '')
            if not raw_sid or str(raw_sid).strip() == '' or str(raw_sid).strip().lower() == 'auto':
                student_id = get_next_student_id()
            else:
                student_id = str(raw_sid).strip()

        username = data.get('username') or (student_id if role == 'student' else '')
        password = data.get('password') or ('student123' if role == 'student' else '')
        first_name = data.get('first_name', '')
        last_name = data.get('last_name', '')
        email = data.get('email', '') or (f"{student_id.lower()}@student.urios.edu.ph" if role == 'student' else '')
        phone = data.get('phone', '') or data.get('mobile_number', '')

        if not username or not password:
            raise ValueError('Username and password are required.')

        # Allow default password 'student123' for student onboarding
        if not (role == 'student' and password == 'student123'):
            pwd_err = validate_password_strength(password)
            if pwd_err:
                raise ValueError(pwd_err)

        phone_val = str(phone).strip()
        if phone_val:
            phone_err = validate_ph_phone(phone_val)
            if phone_err:
                raise ValueError(phone_err)
            phone = re.sub(r'\D', '', phone_val)
        else:
            phone = ''

        if CustomUser.objects.filter(username=username).exists():
            raise ValueError(f'Username "{username}" already exists.')

        is_active = data.get('is_active', True)
        if isinstance(is_active, str):
            is_active = is_active.lower() in ('true', '1', 'active')
        else:
            is_active = bool(is_active)

        with transaction.atomic():
            user = CustomUser.objects.create_user(
                username=username,
                password=password,
                first_name=first_name,
                last_name=last_name,
                email=email,
                role=role,
                phone=phone,
            )
            if not is_active:
                user.is_active = False
                user.save(update_fields=['is_active'])

            if role == 'teacher':
                Teacher.objects.create(
                    user=user,
                    employee_id=data.get('employee_id', f'EMP-{user.id:04d}'),
                    department=data.get('department', ''),
                    specialization=data.get('specialization', ''),
                )
            elif role == 'student':
                Student.objects.create(
                    user=user,
                    student_id=student_id or f'STU-{user.id:04d}',
                    year_level=int(data.get('year_level', 1)),
                    course=data.get('course', ''),
                    middle_name=data.get('middle_name', ''),
                    gender=data.get('gender', 'Male'),
                    birth_date=data.get('birth_date') or None,
                    birth_place=data.get('birth_place', ''),
                    civil_status=data.get('civil_status', 'Single'),
                    blood_type=data.get('blood_type', ''),
                    height=data.get('height', ''),
                    religion=data.get('religion', 'Roman Catholic'),
                    citizenship=data.get('citizenship', 'Filipino'),
                    languages_spoken=data.get('languages_spoken', 'English, Filipino, Cebuano'),
                    current_address=data.get('current_address', ''),
                    current_region=data.get('current_region', 'REGION XIII (Caraga)'),
                    current_province=data.get('current_province', 'Agusan del Norte'),
                    current_municipality=data.get('current_municipality', 'Butuan City'),
                    permanent_address=data.get('permanent_address', ''),
                    permanent_region=data.get('permanent_region', 'REGION XIII (Caraga)'),
                    permanent_province=data.get('permanent_province', 'Agusan del Norte'),
                    permanent_municipality=data.get('permanent_municipality', 'Butuan City'),
                    telephone=data.get('telephone', ''),
                    mobile_number=data.get('mobile_number', '') or phone,
                )

        return user

    @staticmethod
    def update_user(user, data):
        """
        Updates user base fields and their associated profile (teacher/student).
        Returns the updated user.
        Raises ValueError on validation failures.
        """
        if 'first_name' in data:
            user.first_name = data['first_name']
        if 'last_name' in data:
            user.last_name = data['last_name']
        if 'email' in data:
            user.email = data['email']

        if 'phone' in data:
            phone_val = str(data['phone']).strip()
            if phone_val:
                phone_err = validate_ph_phone(phone_val)
                if phone_err:
                    raise ValueError(phone_err)
                user.phone = re.sub(r'\D', '', phone_val)
            else:
                user.phone = ''

        if 'is_active' in data:
            raw_active = data['is_active']
            if isinstance(raw_active, str):
                user.is_active = raw_active.lower() in ('true', '1', 'active')
            else:
                user.is_active = bool(raw_active)

        if data.get('password'):
            pwd_err = validate_password_strength(data['password'])
            if pwd_err:
                raise ValueError(pwd_err)
            user.set_password(data['password'])

        user.save()

        if hasattr(user, 'teacher_profile') and user.teacher_profile:
            tp = user.teacher_profile
            if 'department' in data:
                tp.department = data['department']
            if 'specialization' in data:
                tp.specialization = data['specialization']
            if 'employee_id' in data:
                tp.employee_id = data['employee_id']
            tp.save()

        if hasattr(user, 'student_profile') and user.student_profile:
            sp = user.student_profile
            fsuu_fields = [
                'course', 'year_level', 'student_id', 'middle_name', 'gender',
                'birth_date', 'birth_place', 'civil_status', 'blood_type', 'height',
                'religion', 'citizenship', 'languages_spoken',
                'current_address', 'current_region', 'current_province', 'current_municipality',
                'permanent_address', 'permanent_region', 'permanent_province', 'permanent_municipality',
                'telephone', 'mobile_number',
            ]
            for field in fsuu_fields:
                if field in data:
                    val = data[field]
                    if field == 'year_level':
                        val = int(val)
                    elif field == 'birth_date' and not val:
                        val = None
                    setattr(sp, field, val)
            sp.save()

        return user

    @staticmethod
    def update_current_user_profile(user, data):
        """
        Updates limited self-editable fields on the current authenticated user.
        Raises ValueError on validation failures.
        """
        if 'first_name' in data:
            user.first_name = data['first_name']
        if 'last_name' in data:
            user.last_name = data['last_name']
        if 'email' in data:
            user.email = data['email']

        if 'phone' in data:
            phone_val = str(data['phone']).strip()
            if phone_val:
                phone_err = validate_ph_phone(phone_val)
                if phone_err:
                    raise ValueError(phone_err)
                user.phone = re.sub(r'\D', '', phone_val)
            else:
                user.phone = ''

        user.save()
        return user
