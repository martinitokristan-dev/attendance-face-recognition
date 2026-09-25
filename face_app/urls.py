from django.urls import path
from . import views

urlpatterns = [
    path('enroll/', views.enroll_face, name='enroll_face'),
    path('enroll/capture/', views.enroll_face_capture, name='enroll_face_capture'),
    path('enroll/delete/', views.delete_face, name='delete_face'),
    path('recognize/', views.recognize_faces, name='recognize_faces'),
]
