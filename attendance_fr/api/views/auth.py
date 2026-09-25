"""
Auth & User Profile Views
Handles GET /api/auth/me/ and PATCH /api/auth/me/.
"""
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import permissions, status

from attendance_fr.api.serializers.auth import (
    CurrentUserProfileSerializer,
    UserProfileUpdateSerializer,
)
from attendance_fr.api.services.auth import AuthService


class CurrentUserAPIView(APIView):
    """GET /api/auth/me/ - Get profile. PATCH /api/auth/me/ - Update own profile."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        return Response(CurrentUserProfileSerializer(request.user).data)

    def patch(self, request):
        serializer = UserProfileUpdateSerializer(data=request.data, partial=True)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        try:
            user = AuthService.update_profile(request.user, serializer.validated_data)
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(CurrentUserProfileSerializer(user).data)
