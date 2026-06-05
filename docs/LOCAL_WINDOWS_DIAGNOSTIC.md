# Diagnostic local Windows

## Commande

```powershell
npm run diagnose
```

## Verifications

- `node`, `npm`, `git`.
- `pg_dump` et `pg_restore` pour les sauvegardes PostgreSQL.
- Presence de `backend/.env`.
- Presence de `backend/node_modules` et `frontend/node_modules`.
- Variables obligatoires du backend.
- Ports locaux `3000`, `5173`, `5432`.
- Generation Prisma.
- Connexion PostgreSQL via `DATABASE_URL`.

## Notes

Le script ne modifie pas la base et ne lance aucun serveur. Les valeurs sensibles ne sont pas affichees.
