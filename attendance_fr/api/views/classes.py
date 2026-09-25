"""
Classes Views
Handles Programs, ProgramSections, Subjects, Sections, and Schedules.
"""
from django.shortcuts import get_object_or_404
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.generics import ListCreateAPIView, RetrieveUpdateDestroyAPIView

from core.models import Program, ProgramSection, Subject, Section, Schedule, StudentSection
from attendance_fr.api.serializers.classes import (
    ProgramSerializer,
    ProgramSectionSerializer,
    SubjectSerializer,
    SectionSerializer,
    ScheduleSerializer,
    StudentSectionSerializer,
    SectionEnrollmentCreateSerializer,
)
from attendance_fr.api.services.classes import ClassService
from attendance_fr.permissions import IsAdminRole, IsAdminOrReadOnly


# ── Programs ─────────────────────────────────────────────────────────────────

class ProgramListCreateAPIView(ListCreateAPIView):
    """GET /api/programs/ - List programs. POST /api/programs/ - Create program (Admin only)."""
    queryset = Program.objects.all().order_by('code')
    serializer_class = ProgramSerializer
    permission_classes = [IsAdminOrReadOnly]


class ProgramDetailAPIView(RetrieveUpdateDestroyAPIView):
    queryset = Program.objects.all()
    serializer_class = ProgramSerializer
    permission_classes = [IsAdminOrReadOnly]


# ── Program Sections (Catalog) ────────────────────────────────────────────────

class ProgramSectionListCreateAPIView(ListCreateAPIView):
    """GET /api/program-sections/ - List master catalog. POST /api/program-sections/ - Create definition."""
    serializer_class = ProgramSectionSerializer
    permission_classes = [IsAdminOrReadOnly]

    def get_queryset(self):
        qs = ProgramSection.objects.select_related('program').order_by(
            'program__code', 'course', 'year_level', 'name'
        )
        program_id = self.request.query_params.get('program')
        course = self.request.query_params.get('course')
        year_level = self.request.query_params.get('year_level')

        if program_id:
            qs = qs.filter(program_id=program_id)
        if course:
            qs = qs.filter(course__iexact=course)
        if year_level:
            qs = qs.filter(year_level=year_level)
        return qs


class ProgramSectionDetailAPIView(RetrieveUpdateDestroyAPIView):
    queryset = ProgramSection.objects.all()
    serializer_class = ProgramSectionSerializer
    permission_classes = [IsAdminOrReadOnly]


# ── Subjects ──────────────────────────────────────────────────────────────────

class SubjectListCreateAPIView(ListCreateAPIView):
    serializer_class = SubjectSerializer
    permission_classes = [IsAdminOrReadOnly]

    def get_queryset(self):
        program_id = self.request.query_params.get('program_id')
        user = self.request.user
        qs = Subject.objects.select_related('program', 'teacher__user', 'section')
        if program_id:
            qs = qs.filter(program_id=program_id)
        if user.role == 'teacher' and hasattr(user, 'teacher_profile'):
            qs = qs.filter(teacher=user.teacher_profile)
        return qs.order_by('code')


class SubjectDetailAPIView(RetrieveUpdateDestroyAPIView):
    queryset = Subject.objects.all()
    serializer_class = SubjectSerializer
    permission_classes = [IsAdminOrReadOnly]


# ── Sections ──────────────────────────────────────────────────────────────────

class SectionListCreateAPIView(ListCreateAPIView):
    serializer_class = SectionSerializer
    permission_classes = [IsAdminOrReadOnly]

    def get_queryset(self):
        user = self.request.user
        qs = Section.objects.select_related(
            'program', 'program_section', 'subject', 'teacher__user'
        ).prefetch_related('subjects', 'schedules')

        program_id = self.request.query_params.get('program')
        course = self.request.query_params.get('course')
        year_level = self.request.query_params.get('year_level')

        if program_id:
            qs = qs.filter(program_id=program_id)
        if course:
            qs = qs.filter(course__iexact=course)
        if year_level:
            qs = qs.filter(year_level=year_level)

        qs = ClassService.filter_sections_for_user(qs, user)
        return qs.order_by('name')


class SectionDetailAPIView(RetrieveUpdateDestroyAPIView):
    serializer_class = SectionSerializer
    permission_classes = [IsAdminOrReadOnly]

    def get_queryset(self):
        qs = Section.objects.select_related(
            'program', 'program_section', 'subject', 'teacher__user'
        ).prefetch_related('subjects', 'schedules')
        return ClassService.filter_sections_for_user(qs, self.request.user)


# ── Section Enrollments ───────────────────────────────────────────────────────

class SectionEnrollmentListCreateAPIView(APIView):
    """GET/POST /api/sections/<pk>/enrollments/ - View and add enrollments."""
    permission_classes = [IsAdminOrReadOnly]

    def get(self, request, pk):
        section = get_object_or_404(Section, pk=pk)
        if not ClassService.user_can_access_section(request.user, section):
            return Response(
                {'error': 'You are not enrolled in or assigned to this section.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        enrollments = StudentSection.objects.filter(
            section=section
        ).select_related(
            'student__user', 'subject', 'section'
        ).order_by('student__user__last_name', 'student__user__first_name')
        return Response(StudentSectionSerializer(enrollments, many=True).data)

    def post(self, request, pk):
        if request.user.role != 'admin':
            return Response({'error': 'Only administrators can enroll students.'}, status=status.HTTP_403_FORBIDDEN)

        serializer = SectionEnrollmentCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        student_id = serializer.validated_data.get('student_id')
        subject_id = serializer.validated_data.get('subject_id')

        enrollment, created = ClassService.enroll_student(pk, student_id, subject_id)
        return Response(
            StudentSectionSerializer(enrollment).data,
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )


class SectionEnrollmentDestroyAPIView(APIView):
    """DELETE /api/sections/<pk>/enrollments/<enrollment_pk>/ - Remove student from section."""
    permission_classes = [IsAdminRole]

    def delete(self, request, pk, enrollment_pk):
        ClassService.unenroll_student(pk, enrollment_pk)
        return Response({'success': True, 'message': 'Student removed from section.'}, status=status.HTTP_200_OK)


# ── Schedules ─────────────────────────────────────────────────────────────────

class ScheduleListCreateAPIView(ListCreateAPIView):
    serializer_class = ScheduleSerializer
    permission_classes = [IsAdminOrReadOnly]

    def get_queryset(self):
        section_id = self.request.query_params.get('section_id')
        user = self.request.user
        qs = Schedule.objects.select_related(
            'section__program', 'section__teacher__user', 'section__subject',
            'subject', 'subject__teacher__user',
        )
        if section_id:
            qs = qs.filter(section_id=section_id)
        qs = ClassService.filter_schedules_for_user(qs, user)
        return qs.order_by('day_of_week', 'start_time')

    def perform_create(self, serializer):
        ClassService.validate_and_save_schedule(serializer)


class ScheduleDetailAPIView(RetrieveUpdateDestroyAPIView):
    serializer_class = ScheduleSerializer
    permission_classes = [IsAdminOrReadOnly]

    def get_queryset(self):
        qs = Schedule.objects.select_related(
            'section__program', 'section__teacher__user', 'section__subject',
            'subject', 'subject__teacher__user',
        )
        return ClassService.filter_schedules_for_user(qs, self.request.user)

    def perform_update(self, serializer):
        ClassService.validate_and_save_schedule(serializer, is_update=True)
