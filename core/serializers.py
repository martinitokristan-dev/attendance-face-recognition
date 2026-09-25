from rest_framework import serializers
from core.models import Program, ProgramSection, Subject, Section, Schedule, AttendanceSession, AttendanceRecord, StudentSection
from accounts.serializers import TeacherSerializer, StudentSerializer


class ProgramSerializer(serializers.ModelSerializer):
    section_count = serializers.SerializerMethodField()
    subject_count = serializers.SerializerMethodField()

    class Meta:
        model = Program
        fields = ['id', 'code', 'name', 'college', 'description', 'section_count', 'subject_count', 'created_at']

    def get_section_count(self, obj):
        return obj.standard_sections.count()

    def get_subject_count(self, obj):
        return obj.subjects.count()


class ProgramSectionSerializer(serializers.ModelSerializer):
    program_details = ProgramSerializer(source='program', read_only=True)
    year_level_display = serializers.CharField(source='get_year_level_display', read_only=True)
    active_classes_count = serializers.SerializerMethodField()

    class Meta:
        model = ProgramSection
        fields = ['id', 'program', 'program_details', 'course', 'name', 'year_level', 'year_level_display', 'description', 'active_classes_count', 'created_at']

    def get_active_classes_count(self, obj):
        return Section.objects.filter(name=obj.name).count()


class SubjectSerializer(serializers.ModelSerializer):
    program_details = ProgramSerializer(source='program', read_only=True)
    teacher_details = TeacherSerializer(source='teacher', read_only=True)
    section_name = serializers.CharField(source='section.name', read_only=True, default='')

    class Meta:
        model = Subject
        fields = [
            'id', 'name', 'code', 'description', 'units', 'program', 'program_details',
            'section', 'section_name', 'teacher', 'teacher_details', 'created_at'
        ]


class ScheduleSerializer(serializers.ModelSerializer):
    section_name = serializers.CharField(source='section.name', read_only=True)
    day_display = serializers.CharField(source='get_day_of_week_display', read_only=True)
    days_display = serializers.CharField(read_only=True)
    time_display = serializers.CharField(read_only=True)
    full_days_display = serializers.CharField(read_only=True)
    subject_details = SubjectSerializer(source='subject', read_only=True)
    subject_code = serializers.SerializerMethodField()
    subject_name = serializers.SerializerMethodField()
    teacher_name = serializers.SerializerMethodField()

    class Meta:
        model = Schedule
        fields = [
            'id', 'section', 'section_name', 'subject', 'subject_details',
            'day_of_week', 'day_2', 'day_display',
            'days_display', 'full_days_display', 'start_time', 'end_time', 'time_display',
            'room', 'effective_from', 'effective_to', 'subject_code', 'subject_name', 'teacher_name'
        ]

    def get_subject_code(self, obj):
        if obj.subject:
            return obj.subject.code
        if obj.section and obj.section.effective_subject:
            return obj.section.effective_subject.code
        return '—'

    def get_subject_name(self, obj):
        if obj.subject:
            return obj.subject.name
        if obj.section and obj.section.effective_subject:
            return obj.section.effective_subject.name
        return ''

    def get_teacher_name(self, obj):
        if obj.subject and obj.subject.teacher and obj.subject.teacher.user:
            return obj.subject.teacher.user.get_full_name() or obj.subject.teacher.user.username
        if obj.section and obj.section.teacher and obj.section.teacher.user:
            return obj.section.teacher.user.get_full_name() or obj.section.teacher.user.username
        return '—'


class StudentSectionSerializer(serializers.ModelSerializer):
    student_details = StudentSerializer(source='student', read_only=True)
    subject_details = SubjectSerializer(source='subject', read_only=True)
    subject_code = serializers.CharField(source='subject.code', read_only=True, default=None)
    subject_name = serializers.CharField(source='subject.name', read_only=True, default=None)
    is_irregular = serializers.SerializerMethodField()

    class Meta:
        model = StudentSection
        fields = [
            'id', 'student', 'student_details', 'section', 'subject', 'subject_details',
            'subject_code', 'subject_name', 'is_irregular', 'enrolled_at'
        ]

    def get_is_irregular(self, obj):
        return obj.subject_id is not None


class SectionSerializer(serializers.ModelSerializer):
    program_details = ProgramSerializer(source='program', read_only=True)
    program_section_details = ProgramSectionSerializer(source='program_section', read_only=True)
    subject_details = SubjectSerializer(source='subject', read_only=True)
    teacher_details = TeacherSerializer(source='teacher', read_only=True)
    year_level_display = serializers.CharField(source='get_year_level_display', read_only=True)
    schedule_display = serializers.ReadOnlyField()
    effective_subject_code = serializers.SerializerMethodField()
    effective_subject_name = serializers.SerializerMethodField()
    subjects = serializers.SerializerMethodField()
    schedules = serializers.SerializerMethodField()
    student_count = serializers.SerializerMethodField()

    class Meta:
        model = Section
        fields = [
            'id', 'name', 'course', 'program', 'program_details', 'program_section', 'program_section_details',
            'year_level', 'year_level_display', 'subject', 'subject_details', 'teacher',
            'teacher_details', 'school_year', 'semester', 'schedule_display',
            'effective_subject_code', 'effective_subject_name', 'subjects', 'schedules', 'student_count', 'created_at'
        ]

    def get_effective_subject_code(self, obj):
        eff = obj.effective_subject
        return eff.code if eff else '—'

    def get_effective_subject_name(self, obj):
        eff = obj.effective_subject
        return eff.name if eff else ''

    def get_student_count(self, obj):
        return obj.enrollments.values('student_id').distinct().count()

    def _student_visible_subjects(self, obj):
        request = self.context.get('request')
        subjects = obj.subjects.all()
        if not request or request.user.role != 'student':
            return subjects
        student = getattr(request.user, 'student_profile', None)
        if not student:
            return subjects.none()
        from core.services.enrollment_service import EnrollmentService
        allowed_subject_ids = EnrollmentService.student_enrolled_subject_ids(student, obj)
        if allowed_subject_ids is None:
            return subjects
        if not allowed_subject_ids:
            return subjects.none()
        return subjects.filter(id__in=allowed_subject_ids)

    def get_subjects(self, obj):
        return SubjectSerializer(
            self._student_visible_subjects(obj),
            many=True,
            context=self.context,
        ).data

    def get_schedules(self, obj):
        schedules = obj.schedules.all()
        request = self.context.get('request')
        if request and request.user.role == 'student':
            student = getattr(request.user, 'student_profile', None)
            if student:
                from core.services.enrollment_service import EnrollmentService
                allowed_subject_ids = EnrollmentService.student_enrolled_subject_ids(student, obj)
                if allowed_subject_ids is not None:
                    if not allowed_subject_ids:
                        schedules = schedules.none()
                    else:
                        schedules = schedules.filter(subject_id__in=allowed_subject_ids)
        return ScheduleSerializer(schedules, many=True, context=self.context).data


class AttendanceRecordSerializer(serializers.ModelSerializer):
    student_details = StudentSerializer(source='student', read_only=True)
    student_info = StudentSerializer(source='student', read_only=True)
    student_name = serializers.SerializerMethodField()
    student_id_number = serializers.SerializerMethodField()

    class Meta:
        model = AttendanceRecord
        fields = [
            'id', 'session', 'student', 'student_details', 'student_info',
            'student_name', 'student_id_number', 'status', 'recognized_at',
            'confidence_score', 'remarks'
        ]

    def get_student_name(self, obj):
        if obj.student and obj.student.user:
            fn = obj.student.user.first_name or ''
            ln = obj.student.user.last_name or ''
            full = f"{fn} {ln}".strip()
            return full or obj.student.user.username
        return "Unknown Student"

    def get_student_id_number(self, obj):
        return obj.student.student_id if obj.student else ""


class AttendanceSessionSerializer(serializers.ModelSerializer):
    schedule_details = ScheduleSerializer(source='schedule', read_only=True)
    summary = serializers.SerializerMethodField()
    section_name = serializers.SerializerMethodField()
    subject_code = serializers.SerializerMethodField()
    subject_name = serializers.SerializerMethodField()
    schedule_display = serializers.SerializerMethodField()
    room = serializers.SerializerMethodField()
    teacher_name = serializers.SerializerMethodField()
    started_by_name = serializers.SerializerMethodField()

    class Meta:
        model = AttendanceSession
        fields = [
            'id', 'schedule', 'schedule_details', 'section_name', 'subject_code', 'subject_name',
            'schedule_display', 'room', 'teacher_name', 'started_by_name',
            'date', 'started_by', 'status', 'created_at', 'closed_at', 'summary'
        ]

    def get_summary(self, obj):
        from core.services.attendance_service import AttendanceService
        return AttendanceService.get_session_summary(obj)

    def get_section_name(self, obj):
        if obj.schedule and obj.schedule.section:
            return obj.schedule.section.name
        return 'Section'

    def get_subject_code(self, obj):
        if obj.schedule:
            if obj.schedule.subject:
                return obj.schedule.subject.code
            if obj.schedule.section and obj.schedule.section.effective_subject:
                return obj.schedule.section.effective_subject.code
        return '—'

    def get_subject_name(self, obj):
        if obj.schedule:
            if obj.schedule.subject:
                return obj.schedule.subject.name
            if obj.schedule.section and obj.schedule.section.effective_subject:
                return obj.schedule.section.effective_subject.name
        return ''

    def get_schedule_display(self, obj):
        if obj.schedule:
            days = getattr(obj.schedule, 'days_display', '')
            time = getattr(obj.schedule, 'time_display', '')
            room = getattr(obj.schedule, 'room', '')
            parts = [p for p in [f"{days} {time}".strip(), f"@{room}" if room else ""] if p]
            return " ".join(parts) or '—'
        return '—'

    def get_room(self, obj):
        if obj.schedule:
            return getattr(obj.schedule, 'room', '') or ''
        return ''

    def get_teacher_name(self, obj):
        if obj.schedule:
            if obj.schedule.subject and obj.schedule.subject.teacher and obj.schedule.subject.teacher.user:
                return obj.schedule.subject.teacher.user.get_full_name() or obj.schedule.subject.teacher.user.username
            if obj.schedule.section and obj.schedule.section.teacher and obj.schedule.section.teacher.user:
                return obj.schedule.section.teacher.user.get_full_name() or obj.schedule.section.teacher.user.username
        return '—'

    def get_started_by_name(self, obj):
        if obj.started_by and obj.started_by.user:
            return obj.started_by.user.get_full_name() or obj.started_by.user.username
        return self.get_teacher_name(obj)
