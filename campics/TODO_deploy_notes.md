# Deployment notes (Render)

## 1) Ensure correct start command
- Procfile: `web: gunicorn app:app`
- File name must be `app.py` at repo root.

## 2) Ensure requirements.txt is clean
- Current requirements file appears garbled in viewer.
- Replace with a clean UTF-8 list (see below).

## 3) Environment variables
- SECRET_KEY: set to a long random string.
- DATABASE_URL: copy Render PostgreSQL connection string.

## 4) Uploads
- In production, filesystem may not persist.

