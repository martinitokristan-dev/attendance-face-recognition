"""
Authentication Service
Handles user profile updates, password validations, and session context.
"""
from attendance_fr.api.services.users import UserService


class AuthService:

    @staticmethod
    def update_profile(user, data):
        """
        Updates the authenticated user's own profile.
        Delegates to UserService.update_current_user_profile.
        """
        return UserService.update_current_user_profile(user, data)
