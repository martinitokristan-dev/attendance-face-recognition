from django.contrib import admin
from .models import Subject, Section, Schedule, AttendanceSession, AttendanceRecord, StudentSection


@admin.register(Subject)
class SubjectAdmin(admin.ModelAdmin):
    list_display = ['code', 'name', 'units']
    search_fields = ['code', 'name']


@admin.register(Section)
class SectionAdmin(admin.ModelAdmin):
    list_display = ['name', 'subject', 'teacher', 'school_year', 'semester']
    list_filter = ['school_year', 'semester']
    search_fields = ['name', 'subject__name']
    raw_id_fields = ['teacher']


@admin.register(Schedule)
class ScheduleAdmin(admin.ModelAdmin):
    list_display = ['section', 'day_of_week', 'start_time', 'end_time', 'room']
    list_filter = ['day_of_week']


@admin.register(AttendanceSession)
class AttendanceSessionAdmin(admin.ModelAdmin):
    list_display = ['schedule', 'date', 'started_by', 'status', 'created_at']
    list_filter = ['status', 'date']


@admin.register(AttendanceRecord)
class AttendanceRecordAdmin(admin.ModelAdmin):
    list_display = ['student', 'session', 'status', 'recognized_at', 'confidence_score']
    list_filter = ['status']
    search_fields = ['student__user__username', 'student__student_id']


@admin.register(StudentSection)
class StudentSectionAdmin(admin.ModelAdmin):
    list_display = ['student', 'section', 'enrolled_at']
    search_fields = ['student__user__username', 'section__name']
