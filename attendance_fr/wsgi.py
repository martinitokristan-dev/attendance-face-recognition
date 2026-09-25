"""
WSGI config for attendance_fr project.
"""
import os
from django.core.wsgi import get_wsgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'attendance_fr.settings')
application = get_wsgi_application()
