"""
Classes & Academic Structure Service
Handles business logic for sections, enrollments, and schedule conflict validation.
"""
from django.shortcuts import get_object_or_404
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework.exceptions import ValidationError as DRFValidationError

from core.models import Section, Subject, StudentSection, Schedule
from accounts.models import Student
from core.services.schedule_service import ScheduleService
from core.services.enrollment_service import EnrollmentService
from face_app.services.face_service import FaceService


class ClassService:

    filter_sections_for_user = staticmethod(EnrollmentService.filter_sections_for_user)
    filter_schedules_for_user = staticmethod(EnrollmentService.filter_schedules_for_user)
    student_enrolled_subject_ids = staticmethod(EnrollmentService.student_enrolled_subject_ids)
    user_can_access_section = staticmethod(EnrollmentService.user_can_access_section)

    @staticmethod
    def enroll_student(section_id, student_id, subject_id=None):
        """
        Enrolls a student in a section (and optional subject for irregulars).
        Invalidates biometric face recognition cache for the section.
        Returns (enrollment: StudentSection, created: bool).
        """
        section = get_object_or_404(Section, pk=section_id)
        student = get_object_or_404(Student, pk=student_id)
        subject = None
        if subject_id:
            subject = get_object_or_404(Subject, pk=subject_id, section=section)

        enrollment, created = StudentSection.objects.get_or_create(
            student=student,
            section=section,
            subject=subject,
        )
        FaceService.invalidate_cache(section.pk)
        return enrollment, created

    @staticmethod
    def unenroll_student(section_id, enrollment_id):
        """
        Removes a student enrollment from a section.
        Invalidates biometric face recognition cache for the section.
        """
        enrollment = get_object_or_404(StudentSection, pk=enrollment_id, section_id=section_id)
        enrollment.delete()
        FaceService.invalidate_cache(section_id)
        return True

    @staticmethod
    def validate_and_save_schedule(serializer, is_update=False):
        """
        Validates schedule time constraints and conflicts before saving.
        Raises DRFValidationError on conflict or invalid state.
        """
        try:
            schedule = serializer.save()
        except DjangoValidationError as e:
            messages = list(e.messages) if hasattr(e, 'messages') else [str(e)]
            raise DRFValidationError({'detail': messages[0] if messages else str(e)})

        conflicts = ScheduleService.check_conflicts(schedule)
        if conflicts:
            if not is_update:
                schedule.delete()
            raise DRFValidationError({'detail': conflicts[0]})
        return schedule
