from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import CustomUser, Teacher, Student


@admin.register(CustomUser)
class CustomUserAdmin(UserAdmin):
    list_display = ['username', 'email', 'first_name', 'last_name', 'role', 'is_active']
    list_filter = ['role', 'is_active']
    search_fields = ['username', 'email', 'first_name', 'last_name']
    fieldsets = UserAdmin.fieldsets + (
        ('Role & Contact', {'fields': ('role', 'phone', 'profile_image')}),
    )
    add_fieldsets = UserAdmin.add_fieldsets + (
        ('Role & Contact', {'fields': ('role', 'first_name', 'last_name', 'email', 'phone')}),
    )


@admin.register(Teacher)
class TeacherAdmin(admin.ModelAdmin):
    list_display = ['user', 'employee_id', 'department']
    search_fields = ['user__username', 'user__first_name', 'employee_id']


@admin.register(Student)
class StudentAdmin(admin.ModelAdmin):
    list_display = ['user', 'student_id', 'year_level', 'course', 'is_face_enrolled']
    search_fields = ['user__username', 'user__first_name', 'student_id']
    readonly_fields = ['face_enrolled_at', 'face_encoding']
