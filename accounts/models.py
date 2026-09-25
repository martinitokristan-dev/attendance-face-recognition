from django.db import models
from django.contrib.auth.models import AbstractUser


class CustomUser(AbstractUser):
    """Extended User model with role-based access."""
    ROLE_CHOICES = (
        ('admin', 'Admin'),
        ('teacher', 'Teacher'),
        ('student', 'Student'),
    )
    role = models.CharField(max_length=10, choices=ROLE_CHOICES, default='student')
    profile_image = models.ImageField(upload_to='profiles/', blank=True, null=True)
    phone = models.CharField(max_length=20, blank=True)

    def __str__(self):
        return f"{self.get_full_name() or self.username} ({self.get_role_display()})"

    @property
    def is_admin_role(self):
        return self.role == 'admin'

    @property
    def is_teacher_role(self):
        return self.role == 'teacher'

    @property
    def is_student_role(self):
        return self.role == 'student'

    class Meta:
        verbose_name = 'User'
        verbose_name_plural = 'Users'
        indexes = [
            models.Index(fields=['role'], name='user_role_idx'),
            models.Index(fields=['last_name', 'first_name'], name='user_name_idx'),
        ]


class Teacher(models.Model):
    """Teacher profile linked to CustomUser."""
    user = models.OneToOneField(CustomUser, on_delete=models.CASCADE, related_name='teacher_profile')
    employee_id = models.CharField(max_length=20, unique=True)
    department = models.CharField(max_length=100, blank=True)
    specialization = models.CharField(max_length=150, blank=True)

    def __str__(self):
        return f"Teacher: {self.user.get_full_name() or self.user.username}"

    class Meta:
        verbose_name = 'Teacher'
        verbose_name_plural = 'Teachers'


class Student(models.Model):
    """Student profile linked to CustomUser."""
    user = models.OneToOneField(CustomUser, on_delete=models.CASCADE, related_name='student_profile')
    student_id = models.CharField(max_length=20, unique=True)
    year_level = models.PositiveSmallIntegerField(default=1)
    course = models.CharField(max_length=100, blank=True)
    # FSUU Comprehensive Personal Profile
    middle_name = models.CharField(max_length=100, blank=True, default='')
    gender = models.CharField(max_length=10, blank=True, default='Male')
    birth_date = models.DateField(null=True, blank=True)
    birth_place = models.CharField(max_length=150, blank=True, default='')
    civil_status = models.CharField(max_length=30, blank=True, default='Single')
    blood_type = models.CharField(max_length=10, blank=True, default='')
    height = models.CharField(max_length=20, blank=True, default='')
    religion = models.CharField(max_length=100, blank=True, default='Roman Catholic')
    citizenship = models.CharField(max_length=50, blank=True, default='Filipino')
    languages_spoken = models.CharField(max_length=255, blank=True, default='English, Filipino, Cebuano')

    # FSUU Address Information
    current_address = models.CharField(max_length=255, blank=True, default='')
    current_region = models.CharField(max_length=100, blank=True, default='REGION XIII (Caraga)')
    current_province = models.CharField(max_length=100, blank=True, default='Agusan del Norte')
    current_municipality = models.CharField(max_length=100, blank=True, default='Butuan City')

    permanent_address = models.CharField(max_length=255, blank=True, default='')
    permanent_region = models.CharField(max_length=100, blank=True, default='REGION XIII (Caraga)')
    permanent_province = models.CharField(max_length=100, blank=True, default='Agusan del Norte')
    permanent_municipality = models.CharField(max_length=100, blank=True, default='Butuan City')

    # FSUU Contact Details
    telephone = models.CharField(max_length=30, blank=True, default='')
    mobile_number = models.CharField(max_length=30, blank=True, default='')

    # Face encoding stored as JSON string (list of 128 floats per face)
    face_encoding = models.TextField(blank=True, null=True)
    face_enrolled_at = models.DateTimeField(blank=True, null=True)
    face_image = models.ImageField(upload_to='face_images/', blank=True, null=True)

    def __str__(self):
        return f"Student: {self.user.get_full_name() or self.user.username} ({self.student_id})"

    @property
    def is_face_enrolled(self):
        return bool(self.face_encoding)

    class Meta:
        verbose_name = 'Student'
        verbose_name_plural = 'Students'
        indexes = [
            models.Index(fields=['course', 'year_level'], name='student_crs_yr_idx'),
        ]
