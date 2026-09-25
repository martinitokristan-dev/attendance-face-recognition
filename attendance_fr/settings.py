"""
Django settings for attendance_fr project.
Configured via .env file using python-dotenv.
"""
import os
import sys
from pathlib import Path
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent

# Load .env from project root
load_dotenv(BASE_DIR / '.env')

# ─── Security ─────────────────────────────────────────────────────────────────
SECRET_KEY = os.getenv('SECRET_KEY', 'django-insecure-change-me-before-production')
DEBUG = os.getenv('DEBUG', 'True') == 'True'
ALLOWED_HOSTS = [h.strip() for h in os.getenv('ALLOWED_HOSTS', '127.0.0.1,localhost').split(',') if h.strip()]
RENDER_EXTERNAL_HOSTNAME = os.getenv('RENDER_EXTERNAL_HOSTNAME')
if RENDER_EXTERNAL_HOSTNAME and RENDER_EXTERNAL_HOSTNAME not in ALLOWED_HOSTS:
    ALLOWED_HOSTS.append(RENDER_EXTERNAL_HOSTNAME)
if DEBUG and 'testserver' not in ALLOWED_HOSTS:
    ALLOWED_HOSTS.append('testserver')

# ─── Applications ─────────────────────────────────────────────────────────────
INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'cloudinary_storage',
    'django.contrib.staticfiles',
    'cloudinary',
    # Third-party
    'rest_framework',
    'rest_framework_simplejwt',
    'corsheaders',
    'crispy_forms',
    'crispy_bootstrap5',
    # Local apps
    'accounts',
    'core',
    'face_app',
]

# ─── Middleware ────────────────────────────────────────────────────────────────
MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'corsheaders.middleware.CorsMiddleware',  # CORS placed high before CommonMiddleware
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'attendance_fr.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [BASE_DIR / 'templates'],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'attendance_fr.wsgi.application'

# ─── Database — MySQL (MariaDB 10.4 via XAMPP / phpMyAdmin) ───────────────────
DATABASES = {
    'default': {
        'ENGINE': os.getenv('DB_ENGINE', 'django.db.backends.mysql'),
        'NAME':     os.getenv('DB_NAME',     'attendance_db'),
        'USER':     os.getenv('DB_USER',     'root'),
        'PASSWORD': os.getenv('DB_PASSWORD', ''),
        'HOST':     os.getenv('DB_HOST',     '127.0.0.1'),
        'PORT':     os.getenv('DB_PORT',     '3306'),
        'OPTIONS': {
            'charset': 'utf8mb4',
            # Enforce strict SQL so Django constraints behave the same as in PostgreSQL
            'init_command': "SET sql_mode='STRICT_TRANS_TABLES'",
        },
    }
}

# TiDB Cloud SSL support
db_use_ssl = os.getenv('DB_USE_SSL', 'False').lower() in ('true', '1')
db_ssl_ca = os.getenv('DB_SSL_CA', '')

if db_use_ssl or db_ssl_ca:
    ssl_dict = {}
    ca_candidates = []
    if db_ssl_ca:
        ca_candidates.append(db_ssl_ca)
        ca_candidates.append(os.path.join(BASE_DIR, db_ssl_ca))
    ca_candidates.append(os.path.join(BASE_DIR, 'isrgrootx1.pem'))
    ca_candidates.append('isrgrootx1.pem')
    ca_candidates.append('/etc/ssl/certs/ca-certificates.crt')

    for candidate in ca_candidates:
        if candidate and os.path.exists(candidate):
            ssl_dict['ca'] = os.path.abspath(candidate)
            break

    if 'ca' not in ssl_dict:
        try:
            import certifi
            ssl_dict['ca'] = certifi.where()
        except ImportError:
            pass

    DATABASES['default']['OPTIONS']['ssl'] = ssl_dict

# Isolated SQLite database for automated test suite runs (fast, zero socket crash risk)
if 'test' in sys.argv or 'test_features' in sys.argv:
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.sqlite3',
            'NAME': ':memory:',
        }
    }

# ─── REST Framework & JWT ─────────────────────────────────────────────────────
from datetime import timedelta

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
        'rest_framework.authentication.SessionAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.IsAuthenticated',
    ),
}

SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=int(os.getenv('JWT_ACCESS_MINUTES', '60'))),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=int(os.getenv('JWT_REFRESH_DAYS', '7'))),
    'ROTATE_REFRESH_TOKENS': True,
    'BLACKLIST_AFTER_ROTATION': False,
    'AUTH_HEADER_TYPES': ('Bearer',),
}

# ─── CORS & CSRF ──────────────────────────────────────────────────────────────
# Allowed origins for Cloudflare Pages, Render, and local dev
CORS_ALLOWED_ORIGINS = [
    origin.strip()
    for origin in os.getenv(
        'CORS_ALLOWED_ORIGINS',
        'http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000,https://*.onrender.com'
    ).split(',')
    if origin.strip()
]
CORS_ALLOW_CREDENTIALS = True

CSRF_TRUSTED_ORIGINS = [
    origin.strip()
    for origin in os.getenv(
        'CSRF_TRUSTED_ORIGINS',
        'http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000,https://*.onrender.com'
    ).split(',')
    if origin.strip()
]
if RENDER_EXTERNAL_HOSTNAME:
    render_origin = f'https://{RENDER_EXTERNAL_HOSTNAME}'
    if render_origin not in CSRF_TRUSTED_ORIGINS:
        CSRF_TRUSTED_ORIGINS.append(render_origin)
    if render_origin not in CORS_ALLOWED_ORIGINS:
        CORS_ALLOWED_ORIGINS.append(render_origin)

# Session & Cookie Hardening
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = 'Lax'
CSRF_COOKIE_SAMESITE = 'Lax'

# ─── Production HTTPS & Security ──────────────────────────────────────────────
if not DEBUG:
    SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
    SECURE_SSL_REDIRECT = True
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_BROWSER_XSS_FILTER = True
    SECURE_CONTENT_TYPE_NOSNIFF = True
    X_FRAME_OPTIONS = 'DENY'
    SECURE_HSTS_SECONDS = 31536000
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD = True

# ─── Authentication ────────────────────────────────────────────────────────────
AUTH_USER_MODEL = 'accounts.CustomUser'

AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
        'OPTIONS': {'min_length': 8},
    },
    {
        'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',
    },
]

LOGIN_URL = '/accounts/login/'
LOGIN_REDIRECT_URL = '/dashboard/'
LOGOUT_REDIRECT_URL = '/accounts/login/'

# ─── Internationalisation ──────────────────────────────────────────────────────
LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'Asia/Manila'
USE_I18N = True
USE_TZ = True

# ─── Static & Media files ─────────────────────────────────────────────────────
STATIC_URL = '/static/'
STATICFILES_DIRS = [BASE_DIR / 'static'] if (BASE_DIR / 'static').exists() else []
STATIC_ROOT = BASE_DIR / 'staticfiles'
STATICFILES_STORAGE = 'whitenoise.storage.CompressedStaticFilesStorage'

MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'

CLOUDINARY_CLOUD_NAME = os.getenv('CLOUDINARY_CLOUD_NAME', '').strip()
CLOUDINARY_API_KEY = os.getenv('CLOUDINARY_API_KEY', '').strip()
CLOUDINARY_API_SECRET = os.getenv('CLOUDINARY_API_SECRET', '').strip()

if CLOUDINARY_CLOUD_NAME and CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET:
    CLOUDINARY_STORAGE = {
        'CLOUD_NAME': CLOUDINARY_CLOUD_NAME,
        'API_KEY': CLOUDINARY_API_KEY,
        'API_SECRET': CLOUDINARY_API_SECRET,
        'SECURE': True,
    }
    DEFAULT_FILE_STORAGE = 'cloudinary_storage.storage.MediaCloudinaryStorage'
    STORAGES = {
        'default': {
            'BACKEND': 'cloudinary_storage.storage.MediaCloudinaryStorage',
        },
        'staticfiles': {
            'BACKEND': 'whitenoise.storage.CompressedStaticFilesStorage',
        },
    }
else:
    STORAGES = {
        'default': {
            'BACKEND': 'django.core.files.storage.FileSystemStorage',
        },
        'staticfiles': {
            'BACKEND': 'whitenoise.storage.CompressedStaticFilesStorage',
        },
    }

# ─── CORS (Cross-Origin Resource Sharing for Vite & Cloudflare Pages) ──────────
CORS_ALLOW_ALL_ORIGINS = True
CORS_ALLOW_CREDENTIALS = True
CORS_ALLOWED_ORIGIN_REGEXES = [
    r"^http:\/\/localhost:\d+$",
    r"^http:\/\/127\.0\.0\.1:\d+$",
    r"^https:\/\/.*\.pages\.dev$",
]

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# ─── Crispy Forms ─────────────────────────────────────────────────────────────
CRISPY_ALLOWED_TEMPLATE_PACKS = 'bootstrap5'
CRISPY_TEMPLATE_PACK = 'bootstrap5'

# ─── Caching  (locmem for dev — switch to Redis for production) ───────────────
CACHES = {
    'default': {
        'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
        'LOCATION': 'attendfr-cache',
    }
}

# ─── Face Recognition ─────────────────────────────────────────────────────────
# Euclidean threshold for dlib 128-D embeddings (lower = stricter; 0.38 rejects look-alikes)
FACE_RECOGNITION_TOLERANCE = float(os.getenv('FACE_RECOGNITION_TOLERANCE', '0.38'))
# Minimum confidence (0–1) required before marking attendance (1 - tolerance ≈ 0.62)
MIN_FACE_CONFIDENCE = float(os.getenv('MIN_FACE_CONFIDENCE', '0.62'))
# Best match must beat second-best by at least this distance to avoid ambiguous matches
FACE_MATCH_MARGIN = float(os.getenv('FACE_MATCH_MARGIN', '0.08'))
# Consecutive matching frames required before attendance is marked (weak matches)
FACE_CONSENSUS_FRAMES = int(os.getenv('FACE_CONSENSUS_FRAMES', '2'))
# Strong match marks on first frame (~1.5s queue time with fast rescan)
FACE_INSTANT_MARK_CONFIDENCE = float(os.getenv('FACE_INSTANT_MARK_CONFIDENCE', '0.70'))
# Minutes after class starts before a student is considered "late"
LATE_THRESHOLD_MINUTES = int(os.getenv('LATE_THRESHOLD_MINUTES', '15'))
# Chi-squared threshold for LBPH fallback encoder
LBPH_THRESHOLD = 40.0
# Directory reserved for future binary embedding files
FACE_ENCODINGS_DIR = BASE_DIR / 'media' / 'face_encodings'

# ─── Logging ──────────────────────────────────────────────────────────────────
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'simple': {
            'format': '[{levelname}] {name}: {message}',
            'style': '{',
        },
    },
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
            'formatter': 'simple',
        },
    },
    'root': {
        'handlers': ['console'],
        'level': 'INFO',
    },
    'loggers': {
        'face_app': {'handlers': ['console'], 'level': 'DEBUG', 'propagate': False},
        'core':     {'handlers': ['console'], 'level': 'DEBUG', 'propagate': False},
        'accounts': {'handlers': ['console'], 'level': 'DEBUG', 'propagate': False},
    },
}

# ─── Password Validation ──────────────────────────────────────────────────────
AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
    },
    {
        'NAME': 'accounts.validators.ComplexPasswordValidator',
        'OPTIONS': {
            'min_length': 6,
        }
    },
]

