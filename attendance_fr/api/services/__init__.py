"""
API Services Package
Contains business logic separated from HTTP views and database models.
"""
from attendance_fr.api.services.auth import AuthService
from attendance_fr.api.services.students import (
    StudentService,
    UserService,
    get_next_student_id,
    validate_ph_phone,
    validate_password_strength,
)
from attendance_fr.api.services.classes import ClassService
from attendance_fr.api.services.attendance import AttendanceService
from attendance_fr.api.services.face_recognition import FaceEnrollService, FaceRecognitionService
from attendance_fr.api.services.reports import ReportService

__all__ = [
    'AuthService',
    'StudentService',
    'UserService',
    'ClassService',
    'AttendanceService',
    'FaceEnrollService',
    'FaceRecognitionService',
    'ReportService',
    'get_next_student_id',
    'validate_ph_phone',
    'validate_password_strength',
]
