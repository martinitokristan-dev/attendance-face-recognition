from rest_framework import serializers
from accounts.models import CustomUser, Teacher, Student


class CustomUserSerializer(serializers.ModelSerializer):
    class Meta:
        model = CustomUser
        fields = ['id', 'username', 'first_name', 'last_name', 'email', 'role', 'phone', 'is_active', 'profile_image']
        read_only_fields = ['id']


class TeacherSerializer(serializers.ModelSerializer):
    user = CustomUserSerializer(read_only=True)

    class Meta:
        model = Teacher
        fields = ['id', 'user', 'employee_id', 'department', 'specialization']


class StudentSerializer(serializers.ModelSerializer):
    user = CustomUserSerializer(read_only=True)
    is_face_enrolled = serializers.BooleanField(read_only=True)

    class Meta:
        model = Student
        fields = [
            'id', 'user', 'student_id', 'year_level', 'course',
            'middle_name', 'gender', 'birth_date', 'birth_place',
            'civil_status', 'blood_type', 'height', 'religion',
            'citizenship', 'languages_spoken',
            'current_address', 'current_region', 'current_province', 'current_municipality',
            'permanent_address', 'permanent_region', 'permanent_province', 'permanent_municipality',
            'telephone', 'mobile_number',
            'is_face_enrolled', 'face_enrolled_at', 'face_image'
        ]


class CurrentUserProfileSerializer(serializers.ModelSerializer):
    teacher_profile = TeacherSerializer(read_only=True)
    student_profile = StudentSerializer(read_only=True)

    class Meta:
        model = CustomUser
        fields = ['id', 'username', 'first_name', 'last_name', 'email', 'role', 'phone', 'is_active', 'profile_image', 'teacher_profile', 'student_profile']
