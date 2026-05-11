# CoeurGo Access Backend

Backend minimal pour gerer les acces utilisateurs de CoeurGo avec SQLite.

## Fonctionnalites

- Base SQLite locale dans `backend/data/coeurgo.sqlite3`
- Utilisateurs actifs/inactifs
- Roles: `admin`, `manager`, `viewer`
- Permissions: `users:*`, `roles:*`, `dae:*`, `missions:*`
- Sessions par token Bearer
- Journal d'audit des actions sensibles
- API HTTP JSON sans dependance externe

## Demarrage local

```bash
cd /Users/Arthur/.codex/workspaces/default
python3 backend/manage.py init-db
python3 backend/manage.py create-user --email admin@coeurgo.fr --name "Admin CoeurGo" --role admin
python3 backend/app.py
```

L'API demarre par defaut sur:

```text
http://127.0.0.1:8000
```

## Connexion

```bash
curl -X POST http://127.0.0.1:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@coeurgo.fr","password":"mot-de-passe"}'
```

La reponse contient un `token`. Ensuite:

```bash
curl http://127.0.0.1:8000/api/me \
  -H "Authorization: Bearer VOTRE_TOKEN"
```

## Routes principales

| Methode | Route | Permission |
| --- | --- | --- |
| `GET` | `/api/health` | publique |
| `POST` | `/api/auth/login` | publique |
| `POST` | `/api/auth/logout` | session |
| `GET` | `/api/me` | session |
| `GET` | `/api/roles` | `roles:read` |
| `GET` | `/api/users` | `users:read` |
| `POST` | `/api/users` | `users:write` |
| `PATCH` | `/api/users/{id}` | `users:write` |

## Variables d'environnement

| Variable | Defaut |
| --- | --- |
| `COEURGO_DB_PATH` | `backend/data/coeurgo.sqlite3` |
| `COEURGO_HOST` | `127.0.0.1` |
| `COEURGO_PORT` | `8000` |
| `COEURGO_SESSION_HOURS` | `12` |
| `COEURGO_ALLOWED_ORIGIN` | `*` |

## Note de deploiement

GitHub Pages peut servir le site statique, mais ne peut pas executer cette API ni stocker la base SQLite.
Pour utiliser cette gestion des acces en production, il faut heberger `backend/app.py` sur un serveur Python
ou une plateforme d'application, puis configurer le frontend pour appeler l'URL publique de l'API.
