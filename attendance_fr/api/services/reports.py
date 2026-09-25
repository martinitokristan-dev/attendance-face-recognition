"""
Reports & Analytics Service
Handles dashboard metrics aggregation, student attendance analytics, and monthly calendar reporting.
"""
from attendance_fr.api.services.dashboard import DashboardService
from attendance_fr.api.services.attendance import AttendanceReportService


class ReportService:

    @staticmethod
    def get_dashboard_stats(user):
        """Returns role-specific dashboard metrics."""
        if user.role == 'admin':
            return DashboardService.get_admin_stats()
        elif user.role == 'teacher':
            teacher = getattr(user, 'teacher_profile', None)
            return DashboardService.get_teacher_stats(teacher)
        elif user.role == 'student':
            student = getattr(user, 'student_profile', None)
            return DashboardService.get_student_stats(student)
        return {'role': user.role}

    @staticmethod
    def get_student_overview(student):
        """Returns complete attendance overview, rates, and recent logs for a student."""
        return AttendanceReportService.get_student_overview(student)

    @staticmethod
    def get_student_section_calendar(student, section, target_year, target_month):
        """Returns monthly calendar matrix and attendance records for a student section."""
        return AttendanceReportService.get_student_section_calendar(
            student, section, target_year, target_month
        )

