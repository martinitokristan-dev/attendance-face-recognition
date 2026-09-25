"""
API Views Package
Exports modular views for Auth, Students/Users, Classes, Attendance, Face Recognition, and Reports.
"""
from attendance_fr.api.views.auth import CurrentUserAPIView
from attendance_fr.api.views.students import (
    NextStudentIdAPIView,
    UserListCreateAPIView,
    UserDetailAPIView,
    StudentListAPIView,
)
from attendance_fr.api.views.classes import (
    ProgramListCreateAPIView,
    ProgramDetailAPIView,
    ProgramSectionListCreateAPIView,
    ProgramSectionDetailAPIView,
    SubjectListCreateAPIView,
    SubjectDetailAPIView,
    SectionListCreateAPIView,
    SectionDetailAPIView,
    SectionEnrollmentListCreateAPIView,
    SectionEnrollmentDestroyAPIView,
    ScheduleListCreateAPIView,
    ScheduleDetailAPIView,
)
from attendance_fr.api.views.attendance import (
    AttendanceSessionListAPIView,
    AttendanceSessionStartAPIView,
    AttendanceSessionCloseAPIView,
    AttendanceSessionReopenAPIView,
    AttendanceSessionDetailAPIView,
    ManualAttendanceMarkAPIView,
)
from attendance_fr.api.views.face_recognition import (
    FaceRecognizeAPIView,
    FaceEnrollAPIView,
)
from attendance_fr.api.views.reports import (
    DashboardStatsAPIView,
    StudentAttendanceOverviewAPIView,
    StudentSectionCalendarAPIView,
)

__all__ = [
    'CurrentUserAPIView',
    'NextStudentIdAPIView',
    'UserListCreateAPIView',
    'UserDetailAPIView',
    'StudentListAPIView',
    'ProgramListCreateAPIView',
    'ProgramDetailAPIView',
    'ProgramSectionListCreateAPIView',
    'ProgramSectionDetailAPIView',
    'SubjectListCreateAPIView',
    'SubjectDetailAPIView',
    'SectionListCreateAPIView',
    'SectionDetailAPIView',
    'SectionEnrollmentListCreateAPIView',
    'SectionEnrollmentDestroyAPIView',
    'ScheduleListCreateAPIView',
    'ScheduleDetailAPIView',
    'AttendanceSessionListAPIView',
    'AttendanceSessionStartAPIView',
    'AttendanceSessionCloseAPIView',
    'AttendanceSessionReopenAPIView',
    'AttendanceSessionDetailAPIView',
    'ManualAttendanceMarkAPIView',
    'FaceRecognizeAPIView',
    'FaceEnrollAPIView',
    'DashboardStatsAPIView',
    'StudentAttendanceOverviewAPIView',
    'StudentSectionCalendarAPIView',
]
