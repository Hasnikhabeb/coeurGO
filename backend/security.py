import base64
import hashlib
import secrets
from hmac import compare_digest

PASSWORD_ITERATIONS = 310_000


def hash_password(password, salt=None):
    if not password or len(password) < 8:
        raise ValueError("Le mot de passe doit contenir au moins 8 caracteres.")
    salt_bytes = salt or secrets.token_bytes(16)
    password_hash = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt_bytes,
        PASSWORD_ITERATIONS,
    )
    return (
        base64.b64encode(password_hash).decode("ascii"),
        base64.b64encode(salt_bytes).decode("ascii"),
    )


def verify_password(password, password_hash, password_salt):
    if not password or not password_hash or not password_salt:
        return False
    salt = base64.b64decode(password_salt.encode("ascii"))
    candidate_hash, _ = hash_password(password, salt)
    return compare_digest(candidate_hash, password_hash)


def new_session_token():
    return secrets.token_urlsafe(32)


def token_digest(token):
    return hashlib.sha256(token.encode("utf-8")).hexdigest()
