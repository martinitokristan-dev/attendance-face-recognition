"""
Dashboard Service
Computes role-specific dashboard statistics.
Extracted from api_views.py (DashboardStatsAPIView).
"""
from django.db.models import Q
from django.utils import timezone

from accounts.models import Teacher, Student
from core.models import Subject, Section, Schedule, AttendanceSession, StudentSection


class DashboardService:

    @staticmethod
    def get_admin_stats():
        today = timezone.localdate()
        total_students = Student.objects.count()
        face_enrolled = Student.objects.exclude(
            Q(face_encoding__isnull=True) | Q(face_encoding='')
        ).count()
        return {
            'role': 'admin',
            'total_teachers': Teacher.objects.count(),
            'total_students': total_students,
            'total_subjects': Subject.objects.count(),
            'total_sections': Section.objects.count(),
            'open_sessions_count': AttendanceSession.objects.filter(status='open').count(),
            'sessions_today_count': AttendanceSession.objects.filter(date=today).count(),
            'sessions_today_closed': AttendanceSession.objects.filter(date=today, status='closed').count(),
            'face_enrolled_count': face_enrolled,
            'face_enrollment_pct': round(face_enrolled / total_students * 100, 1) if total_students else 0,
        }

    @staticmethod
    def get_teacher_stats(teacher):
        sections_qs = Section.objects.filter(
            Q(teacher=teacher) | Q(subjects__teacher=teacher)
        ).distinct()
        return {
            'role': 'teacher',
            'total_sections': sections_qs.count(),
            'total_students': StudentSection.objects.filter(
                section__in=sections_qs
            ).values('student_id').distinct().count(),
            'total_schedules': Schedule.objects.filter(section__in=sections_qs).count(),
            'open_sessions_count': AttendanceSession.objects.filter(
                Q(started_by=teacher) | Q(schedule__section__in=sections_qs),
                status='open',
            ).distinct().count(),
        }

    @staticmethod
    def get_student_stats(student):
        enrolled_sections = StudentSection.objects.filter(student=student).count() if student else 0
        return {
            'role': 'student',
            'enrolled_sections': enrolled_sections,
            'is_face_enrolled': student.is_face_enrolled if student else False,
        }
