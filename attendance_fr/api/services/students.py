"""
Student & User Management Service
Handles business logic for user creation, student queries, and student ID generation.
"""
from accounts.models import Student, CustomUser
from attendance_fr.api.services.users import (
    UserService,
    get_next_student_id,
    validate_ph_phone,
    validate_password_strength,
)


class StudentService:

    @staticmethod
    def get_students_queryset(search=None):
        """Returns filtered student queryset."""
        from django.db.models import Q
        qs = Student.objects.select_related('user').order_by('user__last_name', 'user__first_name')
        if search:
            qs = qs.filter(
                Q(student_id__icontains=search) |
                Q(user__first_name__icontains=search) |
                Q(user__last_name__icontains=search) |
                Q(user__email__icontains=search)
            )
        return qs

    @staticmethod
    def get_next_id():
        """Generates next student ID."""
        return get_next_student_id()


__all__ = [
    'StudentService',
    'UserService',
    'get_next_student_id',
    'validate_ph_phone',
    'validate_password_strength',
]
