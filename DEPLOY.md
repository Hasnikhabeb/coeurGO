# Déployer le projet

Le dépôt actuel est vide (aucun code applicatif détecté), donc un déploiement réel n'est pas possible pour l'instant.

## Étapes dès que le code est ajouté

1. Ajouter le code source du projet dans ce dépôt.
2. Définir la cible de déploiement (Vercel, Netlify, Docker, VPS, etc.).
3. Ajouter les variables d'environnement dans un fichier `.env.example`.
4. Créer un pipeline CI/CD (GitHub Actions) pour:
   - exécuter les tests,
   - construire l'application,
   - publier en production.
5. Documenter les commandes exactes de build et de lancement dans `README.md`.

## Vérification rapide

- `git status` doit être propre avant release.
- Les tests doivent passer.
- Les secrets ne doivent pas être versionnés.
