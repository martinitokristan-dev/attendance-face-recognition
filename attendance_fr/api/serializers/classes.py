"""
Classes & Academic Structure Serializers
Handles serialization and validation for Programs, Sections, Subjects, Schedules, and Enrollments.
"""
from rest_framework import serializers
from core.models import Program, ProgramSection, Subject, Section, Schedule, StudentSection
from core.serializers import (
    ProgramSerializer,
    ProgramSectionSerializer,
    SubjectSerializer,
    SectionSerializer,
    ScheduleSerializer,
    StudentSectionSerializer,
)


class SectionEnrollmentCreateSerializer(serializers.Serializer):
    """Validates student enrollment into a section."""
    student_id = serializers.IntegerField(required=True)
    subject_id = serializers.IntegerField(required=False, allow_null=True)
