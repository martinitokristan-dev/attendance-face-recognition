"""
Student & User Serializers
Handles serialization and input payload validation for students, teachers, and users.
"""
from rest_framework import serializers
from accounts.models import CustomUser, Teacher, Student
from accounts.serializers import CustomUserSerializer, TeacherSerializer, StudentSerializer


class UserCreateInputSerializer(serializers.Serializer):
    """Validates payload for admin user creation."""
    role = serializers.ChoiceField(choices=['admin', 'teacher', 'student'], default='teacher')
    username = serializers.CharField(required=False, allow_blank=True, max_length=150)
    password = serializers.CharField(required=False, allow_blank=True, min_length=8)
    first_name = serializers.CharField(required=False, allow_blank=True, max_length=150)
    last_name = serializers.CharField(required=False, allow_blank=True, max_length=150)
    email = serializers.EmailField(required=False, allow_blank=True)
    phone = serializers.CharField(required=False, allow_blank=True, max_length=30)
    mobile_number = serializers.CharField(required=False, allow_blank=True, max_length=30)
    is_active = serializers.BooleanField(required=False, default=True)

    # Teacher specific
    employee_id = serializers.CharField(required=False, allow_blank=True, max_length=50)
    department = serializers.CharField(required=False, allow_blank=True, max_length=100)
    specialization = serializers.CharField(required=False, allow_blank=True, max_length=150)

    # Student specific
    student_id = serializers.CharField(required=False, allow_blank=True, max_length=50)
    course = serializers.CharField(required=False, allow_blank=True, max_length=100)
    year_level = serializers.IntegerField(required=False, default=1)


class UserUpdateInputSerializer(serializers.Serializer):
    """Validates payload for admin user updates."""
    first_name = serializers.CharField(required=False, allow_blank=True, max_length=150)
    last_name = serializers.CharField(required=False, allow_blank=True, max_length=150)
    email = serializers.EmailField(required=False, allow_blank=True)
    phone = serializers.CharField(required=False, allow_blank=True, max_length=30)
    role = serializers.ChoiceField(choices=['admin', 'teacher', 'student'], required=False)
    password = serializers.CharField(required=False, allow_blank=True, min_length=8)
    is_active = serializers.BooleanField(required=False)

    # Profile updates
    employee_id = serializers.CharField(required=False, allow_blank=True, max_length=50)
    department = serializers.CharField(required=False, allow_blank=True, max_length=100)
    specialization = serializers.CharField(required=False, allow_blank=True, max_length=150)
    student_id = serializers.CharField(required=False, allow_blank=True, max_length=50)
    course = serializers.CharField(required=False, allow_blank=True, max_length=100)
    year_level = serializers.IntegerField(required=False)
