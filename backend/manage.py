import argparse
import getpass
import sys

from database import DEFAULT_DB_PATH, audit, connect, initialize_database
from security import hash_password


def create_user(args):
    initialize_database(args.db_path)
    password = args.password or getpass.getpass("Mot de passe: ")
    password_hash, password_salt = hash_password(password)
    with connect(args.db_path) as connection:
        cursor = connection.execute(
            """
            INSERT INTO users (email, display_name, password_hash, password_salt, is_active)
            VALUES (?, ?, ?, ?, 1)
            """,
            (args.email.strip().lower(), args.name.strip(), password_hash, password_salt),
        )
        user_id = cursor.lastrowid
        roles = args.role or ["viewer"]
        assign_roles(connection, user_id, roles)
        audit(
            connection,
            "users.create",
            "user",
            user_id,
            metadata={"source": "manage.py", "email": args.email.strip().lower()},
        )
        connection.commit()
    print(f"Utilisateur cree: {args.email} ({', '.join(roles)})")


def assign_roles(connection, user_id, role_names):
    placeholders = ",".join("?" for _ in role_names)
    rows = connection.execute(
        f"SELECT id, name FROM roles WHERE name IN ({placeholders})",
        role_names,
    ).fetchall()
    found = {row["name"]: row["id"] for row in rows}
    missing = sorted(set(role_names) - set(found))
    if missing:
        raise SystemExit("Role inconnu: " + ", ".join(missing))
    connection.executemany(
        "INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)",
        [(user_id, role_id) for role_id in found.values()],
    )


def list_users(args):
    initialize_database(args.db_path)
    with connect(args.db_path) as connection:
        rows = connection.execute(
            """
            SELECT users.id, users.email, users.display_name, users.is_active,
                   GROUP_CONCAT(roles.name, ', ') AS roles
            FROM users
            LEFT JOIN user_roles ON user_roles.user_id = users.id
            LEFT JOIN roles ON roles.id = user_roles.role_id
            GROUP BY users.id
            ORDER BY users.created_at DESC
            """
        ).fetchall()
    if not rows:
        print("Aucun utilisateur.")
        return
    for row in rows:
        status = "actif" if row["is_active"] else "inactif"
        print(f"{row['id']} | {row['email']} | {row['display_name']} | {status} | {row['roles'] or '-'}")


def init_db(args):
    initialize_database(args.db_path)
    print(f"Base initialisee: {args.db_path}")


def build_parser():
    parser = argparse.ArgumentParser(description="Administration de la base CoeurGo.")
    parser.add_argument("--db-path", default=str(DEFAULT_DB_PATH), help="Chemin de la base SQLite.")
    subparsers = parser.add_subparsers(dest="command", required=True)

    init_parser = subparsers.add_parser("init-db", help="Initialiser le schema SQLite.")
    init_parser.set_defaults(func=init_db)

    create_parser = subparsers.add_parser("create-user", help="Creer un utilisateur.")
    create_parser.add_argument("--email", required=True)
    create_parser.add_argument("--name", required=True)
    create_parser.add_argument("--password", help="Mot de passe. Sinon, saisie interactive.")
    create_parser.add_argument("--role", action="append", choices=["admin", "manager", "viewer"])
    create_parser.set_defaults(func=create_user)

    users_parser = subparsers.add_parser("list-users", help="Lister les utilisateurs.")
    users_parser.set_defaults(func=list_users)
    return parser


def main(argv=None):
    parser = build_parser()
    args = parser.parse_args(argv)
    args.func(args)


if __name__ == "__main__":
    main(sys.argv[1:])
