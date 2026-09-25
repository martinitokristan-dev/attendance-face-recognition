from django.urls import path
from . import views

urlpatterns = [
    # Academic Programs
    path('programs/', views.program_list, name='program_list'),
    path('programs/add/', views.program_create, name='program_create'),
    path('programs/<int:pk>/edit/', views.program_edit, name='program_edit'),
    path('programs/<int:pk>/delete/', views.program_delete, name='program_delete'),

    # Subjects
    path('subjects/', views.subject_list, name='subject_list'),
    path('subjects/add/', views.subject_create, name='subject_create'),
    path('subjects/<int:pk>/edit/', views.subject_edit, name='subject_edit'),
    path('subjects/<int:pk>/delete/', views.subject_delete, name='subject_delete'),

    # Sections
    path('sections/', views.section_list, name='section_list'),
    path('sections/add/', views.section_create, name='section_create'),
    path('sections/<int:pk>/', views.section_detail, name='section_detail'),
    path('sections/<int:pk>/edit/', views.section_edit, name='section_edit'),
    path('sections/<int:pk>/delete/', views.section_delete, name='section_delete'),
    path('sections/<int:section_pk>/unenroll/<int:student_pk>/', views.student_unenroll, name='student_unenroll'),

    # Schedules
    path('schedules/', views.schedule_list, name='schedule_list'),
    path('schedules/add/', views.schedule_create, name='schedule_create'),
    path('schedules/<int:pk>/edit/', views.schedule_edit, name='schedule_edit'),
    path('schedules/<int:pk>/delete/', views.schedule_delete, name='schedule_delete'),

    # Attendance Sessions
    path('sessions/start/<int:schedule_pk>/', views.session_start, name='session_start'),
    path('sessions/<int:pk>/live/', views.session_live, name='session_live'),
    path('sessions/<int:pk>/close/', views.session_close, name='session_close'),
    path('sessions/<int:pk>/reopen/', views.session_reopen, name='session_reopen'),
    path('sessions/<int:pk>/report/', views.session_report, name='session_report'),
    path('history/', views.attendance_history, name='attendance_history'),
    path('history/<int:section_pk>/', views.student_section_attendance, name='student_section_attendance'),
    path('reports/attendance/', views.section_attendance_report, name='section_attendance_report'),

    # Section Catalog (3NF Master Definitions)
    path('academic/section-catalog/', views.section_catalog_list, name='section_catalog_list'),
    path('academic/section-catalog/add/', views.section_catalog_create, name='section_catalog_create'),
    path('academic/section-catalog/<int:pk>/delete/', views.section_catalog_delete, name='section_catalog_delete'),

    # AJAX API
    path('api/mark-present/', views.mark_present_api, name='mark_present_api'),
    path('api/students/search/', views.student_search_api, name='api_student_search'),
    path('sections/<int:pk>/enroll/', views.section_enroll_student_api, name='section_enroll_student_api'),
    path('api/sections/<int:pk>/details/', views.api_section_details, name='api_section_details'),
    path('api/sections-by-program/<int:program_id>/', views.api_sections_by_program, name='api_sections_by_program'),
    path('api/program-sections/<int:program_id>/', views.api_program_sections, name='api_program_sections'),
    path('api/program-sections/create/', views.api_create_program_section, name='api_create_program_section'),
]
