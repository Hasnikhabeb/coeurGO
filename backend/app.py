import json
import os
from datetime import datetime, timedelta, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse

from database import DEFAULT_DB_PATH, audit, connect, initialize_database, row_to_dict
from security import hash_password, new_session_token, token_digest, verify_password

SESSION_HOURS = int(os.environ.get("COEURGO_SESSION_HOURS", "12"))


def utc_now():
    return datetime.now(timezone.utc)


def iso_datetime(value):
    return value.astimezone(timezone.utc).replace(microsecond=0).isoformat()


def parse_datetime(value):
    if value.endswith("Z"):
        value = value[:-1] + "+00:00"
    return datetime.fromisoformat(value)


def user_payload(connection, user_id):
    user = connection.execute(
        """
        SELECT id, email, display_name, is_active, created_at, updated_at, last_login_at
        FROM users
        WHERE id = ?
        """,
        (user_id,),
    ).fetchone()
    if not user:
        return None

    roles = [
        row["name"]
        for row in connection.execute(
            """
            SELECT roles.name
            FROM roles
            JOIN user_roles ON user_roles.role_id = roles.id
            WHERE user_roles.user_id = ?
            ORDER BY roles.name
            """,
            (user_id,),
        )
    ]
    permissions = [
        row["code"]
        for row in connection.execute(
            """
            SELECT DISTINCT permissions.code
            FROM permissions
            JOIN role_permissions ON role_permissions.permission_id = permissions.id
            JOIN user_roles ON user_roles.role_id = role_permissions.role_id
            WHERE user_roles.user_id = ?
            ORDER BY permissions.code
            """,
            (user_id,),
        )
    ]
    payload = row_to_dict(user)
    payload["is_active"] = bool(payload["is_active"])
    payload["roles"] = roles
    payload["permissions"] = permissions
    return payload


def assign_roles(connection, user_id, role_names):
    if not role_names:
        role_names = ["viewer"]
    rows = connection.execute(
        f"SELECT id, name FROM roles WHERE name IN ({','.join('?' for _ in role_names)})",
        role_names,
    ).fetchall()
    found = {row["name"]: row["id"] for row in rows}
    missing = sorted(set(role_names) - set(found))
    if missing:
        raise ValueError("Role inconnu: " + ", ".join(missing))

    connection.execute("DELETE FROM user_roles WHERE user_id = ?", (user_id,))
    connection.executemany(
        "INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)",
        [(user_id, role_id) for role_id in found.values()],
    )


class ApiError(Exception):
    def __init__(self, status, message):
        super().__init__(message)
        self.status = status
        self.message = message


class CoeurGoHandler(BaseHTTPRequestHandler):
    server_version = "CoeurGoAccessAPI/1.0"

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_common_headers()
        self.end_headers()

    def do_GET(self):
        self.handle_request()

    def do_POST(self):
        self.handle_request()

    def do_PATCH(self):
        self.handle_request()

    def handle_request(self):
        try:
            path = urlparse(self.path).path
            method = self.command
            with connect(self.server.db_path) as connection:
                if method == "GET" and path == "/api/health":
                    return self.send_json({"ok": True, "service": "coeurgo-access-api"})
                if method == "POST" and path == "/api/auth/login":
                    return self.login(connection)

                current_user = self.require_user(connection)
                if method == "POST" and path == "/api/auth/logout":
                    return self.logout(connection, current_user)
                if method == "GET" and path == "/api/me":
                    return self.send_json({"user": current_user})
                if method == "GET" and path == "/api/roles":
                    self.require_permission(current_user, "roles:read")
                    return self.list_roles(connection)
                if method == "GET" and path == "/api/users":
                    self.require_permission(current_user, "users:read")
                    return self.list_users(connection)
                if method == "POST" and path == "/api/users":
                    self.require_permission(current_user, "users:write")
                    return self.create_user(connection, current_user)
                if method == "PATCH" and path.startswith("/api/users/"):
                    self.require_permission(current_user, "users:write")
                    user_id = self.parse_user_id(path)
                    return self.update_user(connection, current_user, user_id)

            raise ApiError(404, "Route introuvable.")
        except ApiError as error:
            self.send_error_json(error.status, error.message)
        except ValueError as error:
            self.send_error_json(400, str(error))
        except Exception:
            self.send_error_json(500, "Erreur interne du serveur.")

    def login(self, connection):
        body = self.read_json()
        email = clean_email(body.get("email"))
        password = body.get("password", "")
        user = connection.execute(
            "SELECT * FROM users WHERE email = ? AND is_active = 1",
            (email,),
        ).fetchone()
        if not user or not verify_password(password, user["password_hash"], user["password_salt"]):
            raise ApiError(401, "Identifiants invalides.")

        token = new_session_token()
        expires_at = iso_datetime(utc_now() + timedelta(hours=SESSION_HOURS))
        connection.execute(
            "INSERT INTO sessions (user_id, token_hash, expires_at) VALUES (?, ?, ?)",
            (user["id"], token_digest(token), expires_at),
        )
        connection.execute(
            "UPDATE users SET last_login_at = ?, updated_at = datetime('now') WHERE id = ?",
            (iso_datetime(utc_now()), user["id"]),
        )
        audit(connection, "auth.login", "user", user["id"], actor_user_id=user["id"])
        connection.commit()
        return self.send_json(
            {
                "token": token,
                "expires_at": expires_at,
                "user": user_payload(connection, user["id"]),
            }
        )

    def logout(self, connection, current_user):
        token = self.bearer_token()
        connection.execute(
            "UPDATE sessions SET revoked_at = datetime('now') WHERE token_hash = ?",
            (token_digest(token),),
        )
        audit(connection, "auth.logout", "user", current_user["id"], actor_user_id=current_user["id"])
        connection.commit()
        return self.send_json({"ok": True})

    def list_roles(self, connection):
        roles = []
        for role in connection.execute("SELECT id, name, description FROM roles ORDER BY name"):
            permissions = [
                row["code"]
                for row in connection.execute(
                    """
                    SELECT permissions.code
                    FROM permissions
                    JOIN role_permissions ON role_permissions.permission_id = permissions.id
                    WHERE role_permissions.role_id = ?
                    ORDER BY permissions.code
                    """,
                    (role["id"],),
                )
            ]
            item = row_to_dict(role)
            item["permissions"] = permissions
            roles.append(item)
        return self.send_json({"roles": roles})

    def list_users(self, connection):
        users = [
            user_payload(connection, row["id"])
            for row in connection.execute("SELECT id FROM users ORDER BY created_at DESC")
        ]
        return self.send_json({"users": users})

    def create_user(self, connection, current_user):
        body = self.read_json()
        email = clean_email(body.get("email"))
        display_name = clean_text(body.get("display_name"), "Nom utilisateur obligatoire.")
        password_hash, password_salt = hash_password(body.get("password", ""))
        cursor = connection.execute(
            """
            INSERT INTO users (email, display_name, password_hash, password_salt)
            VALUES (?, ?, ?, ?)
            """,
            (email, display_name, password_hash, password_salt),
        )
        user_id = cursor.lastrowid
        assign_roles(connection, user_id, clean_roles(body.get("roles")))
        audit(
            connection,
            "users.create",
            "user",
            user_id,
            actor_user_id=current_user["id"],
            metadata={"email": email},
        )
        connection.commit()
        self.send_json({"user": user_payload(connection, user_id)}, status=201)

    def update_user(self, connection, current_user, user_id):
        body = self.read_json()
        if not user_payload(connection, user_id):
            raise ApiError(404, "Utilisateur introuvable.")
        if "display_name" in body:
            connection.execute(
                "UPDATE users SET display_name = ?, updated_at = datetime('now') WHERE id = ?",
                (clean_text(body.get("display_name"), "Nom utilisateur obligatoire."), user_id),
            )
        if "is_active" in body:
            connection.execute(
                "UPDATE users SET is_active = ?, updated_at = datetime('now') WHERE id = ?",
                (1 if bool(body.get("is_active")) else 0, user_id),
            )
        if "password" in body:
            password_hash, password_salt = hash_password(body.get("password", ""))
            connection.execute(
                """
                UPDATE users
                SET password_hash = ?, password_salt = ?, updated_at = datetime('now')
                WHERE id = ?
                """,
                (password_hash, password_salt, user_id),
            )
        if "roles" in body:
            assign_roles(connection, user_id, clean_roles(body.get("roles")))

        audit(connection, "users.update", "user", user_id, actor_user_id=current_user["id"])
        connection.commit()
        return self.send_json({"user": user_payload(connection, user_id)})

    def require_user(self, connection):
        token = self.bearer_token()
        session = connection.execute(
            """
            SELECT sessions.user_id, sessions.expires_at
            FROM sessions
            JOIN users ON users.id = sessions.user_id
            WHERE sessions.token_hash = ?
              AND sessions.revoked_at IS NULL
              AND users.is_active = 1
            """,
            (token_digest(token),),
        ).fetchone()
        if not session or parse_datetime(session["expires_at"]) <= utc_now():
            raise ApiError(401, "Session invalide ou expiree.")
        user = user_payload(connection, session["user_id"])
        if not user:
            raise ApiError(401, "Session invalide.")
        return user

    def require_permission(self, user, permission):
        if permission not in user["permissions"]:
            raise ApiError(403, "Acces refuse.")

    def bearer_token(self):
        authorization = self.headers.get("Authorization", "")
        if not authorization.startswith("Bearer "):
            raise ApiError(401, "Token manquant.")
        return authorization.removeprefix("Bearer ").strip()

    def parse_user_id(self, path):
        value = path.removeprefix("/api/users/").strip("/")
        if not value.isdigit():
            raise ApiError(400, "Identifiant utilisateur invalide.")
        return int(value)

    def read_json(self):
        length = int(self.headers.get("Content-Length", "0"))
        if length <= 0:
            return {}
        try:
            return json.loads(self.rfile.read(length).decode("utf-8"))
        except json.JSONDecodeError:
            raise ApiError(400, "JSON invalide.")

    def send_json(self, payload, status=200):
        data = json.dumps(payload, ensure_ascii=True).encode("utf-8")
        self.send_response(status)
        self.send_common_headers()
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def send_error_json(self, status, message):
        self.send_json({"error": message}, status=status)

    def send_common_headers(self):
        self.send_header("Access-Control-Allow-Origin", os.environ.get("COEURGO_ALLOWED_ORIGIN", "*"))
        self.send_header("Access-Control-Allow-Headers", "Authorization, Content-Type")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PATCH, OPTIONS")

    def log_message(self, format, *args):
        return


def clean_email(value):
    email = str(value or "").strip().lower()
    if "@" not in email or len(email) > 254:
        raise ValueError("Email invalide.")
    return email


def clean_text(value, error_message):
    text = str(value or "").strip()
    if not text:
        raise ValueError(error_message)
    return text


def clean_roles(value):
    if value is None:
        return ["viewer"]
    if not isinstance(value, list):
        raise ValueError("Les roles doivent etre une liste.")
    return [clean_text(role, "Role invalide.") for role in value]


def run():
    db_path = os.environ.get("COEURGO_DB_PATH", str(DEFAULT_DB_PATH))
    initialize_database(db_path)
    host = os.environ.get("COEURGO_HOST", "127.0.0.1")
    port = int(os.environ.get("COEURGO_PORT", "8000"))
    server = ThreadingHTTPServer((host, port), CoeurGoHandler)
    server.db_path = db_path
    print(f"CoeurGo access API disponible sur http://{host}:{port}")
    server.serve_forever()


if __name__ == "__main__":
    run()
