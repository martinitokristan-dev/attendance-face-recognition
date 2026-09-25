"""
Enrollment visibility helpers shared by API and serializers.
"""
from django.db.models import Q

from core.models import StudentSection


class EnrollmentService:

    @staticmethod
    def filter_sections_for_user(qs, user):
        if user.role == 'teacher' and hasattr(user, 'teacher_profile'):
            teacher = user.teacher_profile
            return qs.filter(
                Q(teacher=teacher) |
                Q(subjects__teacher=teacher) |
                Q(schedules__subject__teacher=teacher)
            ).distinct()
        if user.role == 'student' and hasattr(user, 'student_profile'):
            return qs.filter(enrollments__student=user.student_profile).distinct()
        return qs

    @staticmethod
    def filter_schedules_for_user(qs, user):
        if user.role == 'teacher' and hasattr(user, 'teacher_profile'):
            teacher = user.teacher_profile
            return qs.filter(
                Q(subject__teacher=teacher) |
                Q(section__teacher=teacher)
            ).distinct()
        if user.role == 'student' and hasattr(user, 'student_profile'):
            student = user.student_profile
            enrollments = StudentSection.objects.filter(student=student)
            if not enrollments.exists():
                return qs.none()
            schedule_q = Q()
            for enrollment in enrollments:
                if enrollment.subject_id:
                    schedule_q |= Q(
                        section_id=enrollment.section_id,
                        subject_id=enrollment.subject_id,
                    )
                else:
                    schedule_q |= Q(section_id=enrollment.section_id)
            return qs.filter(schedule_q).distinct()
        return qs

    @staticmethod
    def student_enrolled_subject_ids(student, section):
        """
        Returns subject IDs a student may view within a section.
        None means regular block enrollment (all subjects in the section).
        """
        enrollments = StudentSection.objects.filter(student=student, section=section)
        if not enrollments.exists():
            return []
        if enrollments.filter(subject__isnull=True).exists():
            return None
        return list(enrollments.exclude(subject__isnull=True).values_list('subject_id', flat=True))

    @staticmethod
    def user_can_access_section(user, section):
        if user.role == 'admin':
            return True
        if user.role == 'teacher' and hasattr(user, 'teacher_profile'):
            teacher = user.teacher_profile
            return (
                section.teacher_id == teacher.pk or
                section.subjects.filter(teacher=teacher).exists() or
                section.schedules.filter(subject__teacher=teacher).exists()
            )
        if user.role == 'student' and hasattr(user, 'student_profile'):
            return StudentSection.objects.filter(
                section=section,
                student=user.student_profile,
            ).exists()
        return False
