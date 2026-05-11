import json
import sqlite3
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
DEFAULT_DB_PATH = BASE_DIR / "data" / "coeurgo.sqlite3"
SCHEMA_PATH = BASE_DIR / "schema.sql"


def connect(db_path=DEFAULT_DB_PATH):
    db_path = Path(db_path)
    db_path.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(db_path)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    return connection


def initialize_database(db_path=DEFAULT_DB_PATH):
    with connect(db_path) as connection:
        connection.executescript(SCHEMA_PATH.read_text(encoding="utf-8"))


def row_to_dict(row):
    return dict(row) if row else None


def audit(connection, action, target_type, target_id=None, actor_user_id=None, metadata=None):
    connection.execute(
        """
        INSERT INTO audit_logs (actor_user_id, action, target_type, target_id, metadata)
        VALUES (?, ?, ?, ?, ?)
        """,
        (
            actor_user_id,
            action,
            target_type,
            str(target_id) if target_id is not None else None,
            json.dumps(metadata or {}, ensure_ascii=True),
        ),
    )
