import os
import uuid
from werkzeug.utils import secure_filename

ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif'}

def allowed_file(filename):
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def create_upload_filename(user_id, filename):
    ext = filename.rsplit('.', 1)[1].lower() if '.' in filename else 'jpg'
    unique_id = uuid.uuid4().hex
    return f"user_{user_id}_{unique_id}.{ext}"