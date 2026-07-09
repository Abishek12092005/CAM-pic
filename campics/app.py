import os
from datetime import datetime, timedelta

from flask import Flask, redirect, url_for, session, render_template, request, jsonify, send_file, send_from_directory
from flask_login import LoginManager, current_user, login_user, logout_user, login_required
from itsdangerous import URLSafeTimedSerializer, SignatureExpired, BadTimeSignature
from werkzeug.security import generate_password_hash
from werkzeug.utils import secure_filename

from models import db, User, Image
from utils import allowed_file, create_upload_filename

app = Flask(__name__, template_folder="templates", static_folder="static")

def getenv_int(name: str, default: int) -> int:
    try:
        return int(os.environ.get(name, default))
    except Exception:
        return default


def getenv_str(name: str, default: str) -> str:
    return os.environ.get(name, default)


app.config["SECRET_KEY"] = getenv_str("SECRET_KEY", "dev-secret-change-me")
app.config["REMEMBER_COOKIE_DURATION"] = timedelta(days=30)

app.config["UPLOAD_FOLDER"] = os.path.join(app.root_path, "uploads")
os.makedirs(app.config["UPLOAD_FOLDER"], exist_ok=True)

app.config["MAX_CONTENT_LENGTH"] = getenv_int("MAX_CONTENT_LENGTH", 5 * 1024 * 1024)

db_url = getenv_str("DATABASE_URL", "sqlite:///cam_pics.db")
# Render provides postgres:// but SQLAlchemy requires postgresql://
if db_url.startswith("postgres://"):
    db_url = db_url.replace("postgres://", "postgresql://", 1)

app.config["SQLALCHEMY_DATABASE_URI"] = db_url
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

login_manager = LoginManager()
login_manager.login_view = "login_page"
login_manager.session_protection = "strong"
login_manager.init_app(app)

db.init_app(app)

# Render/Production-la Gunicorn use pannumbodhu tables auto-create aagaradhukku idhu inga irukanum
with app.app_context():
    db.create_all()

@login_manager.user_loader
def load_user(user_id):
    return db.session.get(User, int(user_id))

@app.get("/")
def home_page():
    if current_user.is_authenticated:
        return redirect(url_for("camera_page"))
    return redirect(url_for("login_page"))


@app.get("/login")
def login_page():
    return render_template("login.html")


@app.get("/register")
def register_page():
    return render_template("register.html")


@app.get("/forgot-password")
def forgot_password_page():
    return render_template("forgot_password.html")


@app.get("/reset-password/<token>")
def reset_password_page(token):
    return render_template("reset_password.html", token=token)


@app.get("/camera")
@login_required
def camera_page():
    return render_template("camera.html")


@app.get("/memories")
@login_required
def memories_page():
    return render_template("memories.html")


@app.get("/profile")
@login_required
def profile_page():
    return render_template("profile.html")


@app.get("/profile/edit")
@login_required
def edit_profile_page():
    return render_template("edit_profile.html")


@app.get("/uploads/<path:filename>")
def serve_uploads(filename):
    return send_from_directory(app.config["UPLOAD_FOLDER"], filename)

@app.post("/api/register")
def api_register():
    data = request.get_json(silent=True) or {}
    username = (data.get("username") or "").strip()
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    if not username or not email or not password:
        return jsonify({"error": "Missing fields"}), 400

    if User.query.filter((User.username == username) | (User.email == email)).first():
        return jsonify({"error": "User already exists"}), 409

    user = User(
        username=username,
        email=email,
        password_hash=generate_password_hash(password),
    )
    db.session.add(user)
    db.session.commit()

    login_user(user)
    return jsonify({"ok": True, "user": user.to_dict()})


@app.post("/api/login")
def api_login():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    if not email or not password:
        return jsonify({"error": "Missing fields"}), 400

    user = User.query.filter_by(email=email).first()
    if not user or not user.check_password(password):
        return jsonify({"error": "Invalid credentials"}), 401

    login_user(user)

    return jsonify({"ok": True, "user": user.to_dict()})


@app.post("/api/forgot-password")
def api_forgot_password():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()

    if not email:
        return jsonify({"error": "Email is required"}), 400

    user = User.query.filter_by(email=email).first()
    if not user:
        return jsonify({"error": "Email not found"}), 404

    s = URLSafeTimedSerializer(app.config["SECRET_KEY"])
    token = s.dumps(email, salt="password-reset-salt")
    reset_link = url_for("reset_password_page", token=token, _external=True)
    
    return jsonify({
        "ok": True, 
        "message": "Reset link generated (check console/response for testing)",
        "debug_link": reset_link
    })


@app.post("/api/reset-password")
def api_reset_password():
    data = request.get_json(silent=True) or {}
    token = data.get("token")
    new_password = data.get("password")

    if not token or not new_password:
        return jsonify({"error": "Missing data"}), 400

    s = URLSafeTimedSerializer(app.config["SECRET_KEY"])
    try:
        email = s.loads(token, salt="password-reset-salt", max_age=3600)
    except (SignatureExpired, BadTimeSignature):
        return jsonify({"error": "Invalid or expired token"}), 400

    user = User.query.filter_by(email=email).first()
    if not user:
        return jsonify({"error": "User not found"}), 404

    user.password_hash = generate_password_hash(new_password)
    db.session.commit()
    return jsonify({"ok": True})


@app.post("/api/logout")
def api_logout():
    if current_user.is_authenticated:
        logout_user()
    session.clear()
    return jsonify({"ok": True})

@app.post("/api/profile")
@login_required
def api_update_profile():
    username = request.form.get("username", "").strip()
    file = request.files.get("profile_image")

    if not username:
        return jsonify({"error": "Username required"}), 400

    if User.query.filter(User.username == username, User.id != current_user.id).first():
        return jsonify({"error": "Username already taken"}), 409

    current_user.username = username

    if file and file.filename:
        if not allowed_file(file.filename):
            return jsonify({"error": "Invalid file type"}), 400

        filename = secure_filename(file.filename)
        final_name = create_upload_filename(current_user.id, filename)
        save_path = os.path.join(app.config["UPLOAD_FOLDER"], final_name)
        file.save(save_path)
        current_user.profile_image = f"/uploads/{final_name}"

    db.session.commit()
    return jsonify({"ok": True, "user": current_user.to_dict()})

@app.post("/api/upload")
@login_required
def api_upload():
    uploaded_files = request.files.getlist("image")
    if not uploaded_files:
        return jsonify({"error": "No images provided"}), 400

    uploaded_images_data = []
    for file in uploaded_files:
        if not file or not file.filename:
            continue

        if not allowed_file(file.filename):
            return jsonify({"error": f"Invalid file type for {file.filename}"}), 400

        filename = secure_filename(file.filename)
        final_name = create_upload_filename(current_user.id, filename)
        save_path = os.path.join(app.config["UPLOAD_FOLDER"], final_name)
        file.save(save_path)

        image = Image(
            user_id=current_user.id,
            image_name=final_name,
            image_path=f"/uploads/{final_name}",
        )
        db.session.add(image)
        db.session.flush()  # Flush to populate the ID and default captured_at timestamp
        uploaded_images_data.append(image.to_dict())
    db.session.commit()

    return jsonify({"ok": True, "images": uploaded_images_data})


@app.get("/api/images")
@login_required
def api_get_images():
    try:
        page = max(int(request.args.get("page", 1)), 1)
    except (ValueError, TypeError):
        page = 1

    try:
        per_page = min(max(int(request.args.get("per_page", 12)), 1), 50)
    except (ValueError, TypeError):
        per_page = 12

    def parse_date(date_str):
        try:
            # Handle ISO strings (including those with 'Z' from JS)
            return datetime.fromisoformat(date_str.replace('Z', '+00:00'))
        except ValueError:
            # Fallback for simple YYYY-MM-DD date strings
            return datetime.strptime(date_str, "%Y-%m-%d")

    date_from = request.args.get("date_from")
    date_to = request.args.get("date_to")

    query = Image.query

    if current_user.is_authenticated:
        query = query.filter(Image.user_id == current_user.id)
    else:
        return jsonify({"images": [], "page": page, "has_more": False})

    if date_from:
        try:
            dt_from = parse_date(date_from)
            query = query.filter(Image.captured_at >= dt_from)
        except ValueError: pass
    if date_to:
        try:
            dt_to = parse_date(date_to).replace(hour=23, minute=59, second=59)
            query = query.filter(Image.captured_at <= dt_to)
        except ValueError: pass

    query = query.order_by(Image.captured_at.desc())

    items = query.offset((page - 1) * per_page).limit(per_page + 1).all()
    has_more = len(items) > per_page
    items = items[:per_page]

    return jsonify({
        "images": [i.to_dict() for i in items],
        "page": page,
        "has_more": has_more,
    })


@app.delete("/api/images/<int:image_id>")
@login_required
def api_delete_image(image_id: int):
    image = Image.query.filter_by(id=image_id, user_id=current_user.id).first()
    if not image:
        return jsonify({"error": "Not found"}), 404

    if image.image_name:
        try:
            path = os.path.join(app.config["UPLOAD_FOLDER"], image.image_name)
            if os.path.exists(path):
                os.remove(path)
        except Exception:
            pass

    db.session.delete(image)
    db.session.commit()
    return jsonify({"ok": True})


@app.get("/api/images/<int:image_id>/download")
@login_required
def api_download_image(image_id: int):
    image = Image.query.filter_by(id=image_id, user_id=current_user.id).first()
    if not image:
        return jsonify({"error": "Not found"}), 404

    path = os.path.join(app.config["UPLOAD_FOLDER"], image.image_name)
    if not os.path.exists(path):
        return jsonify({"error": "File missing"}), 404

    return send_file(path, as_attachment=True, download_name=image.image_name)


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5000)), debug=True)
