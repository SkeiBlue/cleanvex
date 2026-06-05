# Sauvegarde et restauration

## Export applicatif

Depuis l'interface, le bouton `Export ZIP` genere une archive authentifiee avec `manifest.json` et les fichiers prives de l'utilisateur connecte.

## Sauvegarde PostgreSQL

Depuis la racine du repo :

```powershell
npm run backup:db
```

Le script lit `DATABASE_URL` dans `backend/.env` et cree un dump PostgreSQL dans `backups/`.

## Restauration PostgreSQL

Utiliser `pg_restore` vers la base cible :

```powershell
pg_restore --clean --if-exists --dbname "<DATABASE_URL_CIBLE>" backups\postgres-YYYYMMDD-HHMMSS.dump
```

Verifier ensuite les variables `DATABASE_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET` et `PRIVATE_FILES_DIR` avant de relancer le backend.
