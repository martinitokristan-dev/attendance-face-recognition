"""
URL configuration for attendance_fr project.
"""
from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from django.shortcuts import redirect

from django.http import JsonResponse
from django.db import connection

def health_check(request):
    """Health check endpoint for Render and local verification."""
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
        db_status = "connected"
    except Exception as e:
        db_status = f"unhealthy: {str(e)}"

    return JsonResponse({
        "status": "healthy" if db_status == "connected" else "degraded",
        "database": db_status
    }, status=200 if db_status == "connected" else 503)

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/health/', health_check, name='health_check'),
    path('api/', include('attendance_fr.api.urls')),
    path('accounts/', include('accounts.urls')),
    path('', include('core.urls')),
    path('face/', include('face_app.urls')),
    path('', lambda request: redirect('dashboard'), name='home'),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
