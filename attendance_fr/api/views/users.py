"""
User & Student Management Views (Compatibility Module)
Re-exports from attendance_fr.api.views.students.
"""
from attendance_fr.api.views.students import (
    NextStudentIdAPIView,
    UserListCreateAPIView,
    UserDetailAPIView,
    StudentListAPIView,
)

__all__ = [
    'NextStudentIdAPIView',
    'UserListCreateAPIView',
    'UserDetailAPIView',
    'StudentListAPIView',
]
