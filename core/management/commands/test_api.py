"""
Command alias to run the AttendFR REST API test suite directly.
Usage: python manage.py test_api
"""
from django.core.management import call_command
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = "Runs the AttendFR REST API test suite with styled CLI output"

    def handle(self, *args, **options):
        call_command('test_features', api=True)
