# attendance_fr package
"""
Attendance Face Recognition System.
Local development database compatibility patch:
Allows Django 6.1 to work with XAMPP's MariaDB 10.4.32 or MySQL 8.4
without triggering NotSupportedError or MariaDB 10.4 RETURNING syntax errors.
In production with TiDB Cloud, this maintains seamless compatibility.
"""

try:
    import pymysql
    pymysql.install_as_MySQLdb()
except ImportError:
    pass

try:
    from django.db.backends.base.base import BaseDatabaseWrapper
    from django.db.backends.mysql.features import DatabaseFeatures

    _original_check_database_version_supported = BaseDatabaseWrapper.check_database_version_supported

    def _safe_check_database_version_supported(self):
        try:
            _original_check_database_version_supported(self)
        except Exception:
            # Bypass strict minimum version check on local environments
            pass

    BaseDatabaseWrapper.check_database_version_supported = _safe_check_database_version_supported

    # MariaDB 10.4 does not support INSERT ... RETURNING (added in 10.5)
    # MySQL and TiDB also do not use INSERT ... RETURNING
    DatabaseFeatures.can_return_columns_from_insert = False

    from django.db.backends.mysql.schema import DatabaseSchemaEditor
    # TiDB Cloud does not support adding a column and its foreign key constraint
    # in the same ALTER TABLE statement. Setting sql_create_column_inline_fk to None
    # causes Django to defer the foreign key constraint to a separate statement,
    # which is fully compatible with TiDB, MySQL, and MariaDB.
    DatabaseSchemaEditor.sql_create_column_inline_fk = None

except ImportError:
    pass
