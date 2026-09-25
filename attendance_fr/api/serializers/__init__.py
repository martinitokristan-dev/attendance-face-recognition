"""
API Serializers Package
Exports serializers across auth, students, classes, attendance, and reports.
"""
from attendance_fr.api.serializers.auth import (
    CurrentUserProfileSerializer,
    UserProfileUpdateSerializer,
)
from attendance_fr.api.serializers.students import (
    CustomUserSerializer,
    TeacherSerializer,
    StudentSerializer,
    UserCreateInputSerializer,
    UserUpdateInputSerializer,
)
from attendance_fr.api.serializers.classes import (
    ProgramSerializer,
    ProgramSectionSerializer,
    SubjectSerializer,
    SectionSerializer,
    ScheduleSerializer,
    StudentSectionSerializer,
    SectionEnrollmentCreateSerializer,
)
from attendance_fr.api.serializers.attendance import (
    AttendanceSessionSerializer,
    AttendanceRecordSerializer,
    AttendanceSessionStartSerializer,
    ManualAttendanceMarkSerializer,
)
from attendance_fr.api.serializers.reports import (
    DashboardStatsSerializer,
    StudentAttendanceOverviewSerializer,
    StudentSectionCalendarSerializer,
)

__all__ = [
    'CurrentUserProfileSerializer',
    'UserProfileUpdateSerializer',
    'CustomUserSerializer',
    'TeacherSerializer',
    'StudentSerializer',
    'UserCreateInputSerializer',
    'UserUpdateInputSerializer',
    'ProgramSerializer',
    'ProgramSectionSerializer',
    'SubjectSerializer',
    'SectionSerializer',
    'ScheduleSerializer',
    'StudentSectionSerializer',
    'SectionEnrollmentCreateSerializer',
    'AttendanceSessionSerializer',
    'AttendanceRecordSerializer',
    'AttendanceSessionStartSerializer',
    'ManualAttendanceMarkSerializer',
    'DashboardStatsSerializer',
    'StudentAttendanceOverviewSerializer',
    'StudentSectionCalendarSerializer',
]
