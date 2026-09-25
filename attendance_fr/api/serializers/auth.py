"""
Authentication & Profile Serializers
Handles validation and serialization for auth and user profile endpoints.
"""
from rest_framework import serializers
from accounts.models import CustomUser
from accounts.serializers import TeacherSerializer, StudentSerializer


class CurrentUserProfileSerializer(serializers.ModelSerializer):
    """Serializes the currently authenticated user including role-specific profile."""
    teacher_profile = TeacherSerializer(read_only=True)
    student_profile = StudentSerializer(read_only=True)

    class Meta:
        model = CustomUser
        fields = [
            'id', 'username', 'first_name', 'last_name', 'email', 'role',
            'phone', 'is_active', 'profile_image', 'teacher_profile', 'student_profile'
        ]
        read_only_fields = ['id', 'username', 'role', 'is_active']


class UserProfileUpdateSerializer(serializers.Serializer):
    """Validates payload for updating the current user's profile."""
    first_name = serializers.CharField(required=False, allow_blank=True, max_length=150)
    last_name = serializers.CharField(required=False, allow_blank=True, max_length=150)
    email = serializers.EmailField(required=False, allow_blank=True)
    phone = serializers.CharField(required=False, allow_blank=True, max_length=20)
    password = serializers.CharField(required=False, write_only=True, min_length=8)
