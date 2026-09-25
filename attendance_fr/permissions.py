"""
Custom Django REST Framework permissions for Attendance-FR.
Enforces role-based access and object-level authorization across API endpoints.
"""
from rest_framework import permissions


class IsAdminRole(permissions.BasePermission):
    """Allows access only to authenticated users with the 'admin' role."""
    message = "Administrator privileges required to perform this action."

    def has_permission(self, request, view):
        return bool(
            request.user and
            request.user.is_authenticated and
            request.user.role == 'admin'
        )


class IsTeacherOrAdminRole(permissions.BasePermission):
    """Allows access to authenticated Teachers and Admins."""
    message = "Instructor or Administrator privileges required to perform this action."

    def has_permission(self, request, view):
        return bool(
            request.user and
            request.user.is_authenticated and
            request.user.role in ['admin', 'teacher']
        )


class IsAdminOrReadOnly(permissions.BasePermission):
    """
    Allows read-only access (GET, HEAD, OPTIONS) to all authenticated users,
    but restricts write operations (POST, PUT, PATCH, DELETE) to Admins only.
    """
    message = "Only administrators are permitted to create, modify, or delete this resource."

    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False
        if request.method in permissions.SAFE_METHODS:
            return True
        return request.user.role == 'admin'


class IsSessionManager(permissions.BasePermission):
    """
    Grants access to Admins or the Teacher assigned to the specific Attendance Session.
    Students are strictly forbidden.
    """
    message = "You are not authorized to manage or view this attendance session."

    def has_permission(self, request, view):
        return bool(
            request.user and
            request.user.is_authenticated and
            request.user.role in ['admin', 'teacher']
        )

    def has_object_permission(self, request, view, obj):
        if not (request.user and request.user.is_authenticated):
            return False
        if request.user.role == 'admin':
            return True
        if request.user.role == 'teacher':
            teacher = getattr(request.user, 'teacher_profile', None)
            if not teacher:
                return False
            return (
                (obj.started_by == teacher) or
                (obj.schedule.section.teacher == teacher) or
                obj.schedule.section.subjects.filter(teacher=teacher).exists()
            )
        return False
