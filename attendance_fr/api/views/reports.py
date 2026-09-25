"""
Reports & Analytics Views
Handles dashboard metrics, student attendance overview, and calendar reports.
"""
from django.shortcuts import get_object_or_404
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import permissions, status

from django.utils import timezone
from core.models import Section
from accounts.models import Student
from attendance_fr.api.services.reports import ReportService


class DashboardStatsAPIView(APIView):
    """GET /api/dashboard/stats/ - Role-specific summary metrics for the active user."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        stats = ReportService.get_dashboard_stats(request.user)
        return Response(stats)


class StudentAttendanceOverviewAPIView(APIView):
    """GET /api/attendance/student/overview/ - Attendance statistics for student or admin."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        student = None

        if user.role == 'student':
            student = getattr(user, 'student_profile', None)
            if not student:
                return Response({'error': 'Student profile not found.'}, status=status.HTTP_404_NOT_FOUND)
        elif user.role in ('admin', 'teacher'):
            student_id = request.query_params.get('student_id')
            if not student_id:
                return Response({'error': 'student_id query param is required.'}, status=status.HTTP_400_BAD_REQUEST)
            student = Student.objects.filter(student_id=student_id).first()
            if not student:
                return Response({'error': f'Student "{student_id}" not found.'}, status=status.HTTP_404_NOT_FOUND)
        else:
            return Response({'error': 'Unauthorized.'}, status=status.HTTP_403_FORBIDDEN)

        data = ReportService.get_student_overview(student)
        return Response(data)


class StudentSectionCalendarAPIView(APIView):
    """GET /api/attendance/student/calendar/<section_pk>/ - Monthly calendar for student section."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, section_pk):
        user = request.user
        section = get_object_or_404(Section, pk=section_pk)

        if user.role == 'student':
            student = getattr(user, 'student_profile', None)
            if not student:
                return Response({'error': 'Student profile not found.'}, status=status.HTTP_404_NOT_FOUND)
        elif user.role in ('admin', 'teacher'):
            student_id = request.query_params.get('student_id')
            if not student_id:
                return Response({'error': 'student_id is required for non-students.'}, status=status.HTTP_400_BAD_REQUEST)
            student = Student.objects.filter(student_id=student_id).first()
            if not student:
                return Response({'error': f'Student "{student_id}" not found.'}, status=status.HTTP_404_NOT_FOUND)
        else:
            return Response({'error': 'Unauthorized.'}, status=status.HTTP_403_FORBIDDEN)

        today = timezone.localdate()
        try:
            target_year = int(request.query_params.get('year', today.year))
            target_month = int(request.query_params.get('month', today.month))
            if not (1 <= target_month <= 12):
                raise ValueError()
        except ValueError:
            target_year = today.year
            target_month = today.month

        data = ReportService.get_student_section_calendar(
            student, section, target_year, target_month
        )
        return Response(data)
