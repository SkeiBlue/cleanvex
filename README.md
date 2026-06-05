# Plateforme personnelle modulaire

Socle V0.1 base sur le cahier des charges PRO V3.2.

## Stack

- Frontend: React + Vite + TypeScript
- Backend: NestJS + TypeScript
- Database: PostgreSQL + Prisma
- Auth: JWT access token court + refresh token en cookie httpOnly
- Fichiers: stockage prive hors dossier public

## Base PostgreSQL

La base peut etre locale ou distante. Si PostgreSQL est sur une autre machine,
configure `backend/.env` avec l'IP ou le nom DNS de cette machine:

```env
DATABASE_URL="postgresql://USER:PASSWORD@POSTGRES_HOST:5432/pj?schema=public"
```

Points a verifier cote serveur PostgreSQL distant:

- le port `5432` est ouvert uniquement pour les machines autorisees;
- `postgresql.conf` autorise l'ecoute reseau via `listen_addresses`;
- `pg_hba.conf` autorise l'utilisateur depuis l'IP de ce PC;
- la base `pj` existe avant de lancer les migrations.

`docker-compose.yml` reste seulement une option pour demarrer une base locale de dev.

## Inscription

La creation de compte V2 est disponible via l'ecran de connexion et l'API. Pour verrouiller l'inscription avec un code prive, ajoute dans `backend/.env`:

```env
SIGNUP_INVITE_CODE="code-prive"
```

En production, le token de verification email n'est pas renvoye par l'API; il faudra brancher un service email.

Variables SMTP disponibles:

```env
APP_PUBLIC_URL="https://ton-domaine.fr"
SMTP_HOST="smtp.example.com"
SMTP_PORT="587"
SMTP_SECURE="false"
SMTP_USER="user"
SMTP_PASS="password"
MAIL_FROM="Personal Platform <no-reply@ton-domaine.fr>"
```

Important: `MAIL_FROM` doit etre une adresse autorisee par le compte SMTP utilise.

## PostHog optionnel

Le frontend peut envoyer des evenements produit non sensibles si `frontend/.env` contient:

```env
VITE_POSTHOG_KEY="phc_xxx"
VITE_POSTHOG_HOST="https://eu.i.posthog.com"
```

Autocapture et session replay sont desactives.

## Demarrage

```powershell
npm run diagnose
npm run prisma:migrate
npm run seed
npm run dev:backend
npm run dev:frontend
```

Si tu veux utiliser la base locale Docker fournie, lance d'abord:

```powershell
npm run db:up
```

Frontend: `http://localhost:5173`

Backend: `http://localhost:3000/api`

Diagnostic local Windows:

```powershell
npm run diagnose
```

Ce script verifie les outils, les variables `backend/.env`, les ports locaux, Prisma et la connexion PostgreSQL sans afficher les secrets.

Compte seed par defaut:

- Email: `admin@example.com`
- Mot de passe: `ChangeMe123!`

## V0.1

- Auth JWT
- Login frontend branche sur l'API
- Dashboard Cosmic UI
- Modules activables
- Documents prives via endpoint backend securise
- Base Prisma prete pour V0.2 Vehicules

## Validation rapide V0.1

- `GET /api/documents` sans token doit repondre `401`.
- `POST /api/auth/login` doit renvoyer un access token.
- Desactiver le module Documents doit bloquer `/api/documents` avec `403`.
- Le frontend doit permettre login, logout, lecture modules et upload document.

Commandes de validation:

```powershell
npm run validate
```

Etat actuel V0.1:

- Auth JWT login, refresh rotation et logout testes.
- Documents prives refuses sans token.
- Upload et listing de documents prives testes.
- Module Documents desactive bloque l'API avec `403`.
- Frontend connecte a l'API pour login, logout, modules et documents.

Note audit: le frontend n'a pas d'alerte. Le backend remonte actuellement des alertes moderees sur une dependance dev de Prisma 7; `npm audit fix --force` propose un downgrade majeur vers Prisma 6, donc le correctif force n'est pas applique.

## V0.2

Le cadrage de demarrage est dans `docs/V0.2_VEHICLES_PLAN.md`.

Etat actuel V0.2:

- API vehicles protegee par JWT.
- Module Vehicles desactivable avec blocage `403`.
- Liste, creation, detail et modification vehicule.
- Kilometrage manuel.
- Interventions simples.
- Alertes simples.
- Documents existants lies a un vehicule.
- Upload photo/document depuis une fiche vehicule avec liaison automatique.
- Frontend branche pour liste, creation, fiche, kilometrage, interventions et alertes.

## V0.3

Le cadrage est dans `docs/V0.3_FINANCES_PLAN.md`.

Etat actuel V0.3:

- Tables Prisma finances appliquees en migration.
- API comptes, categories, operations et resume.
- Operations liees a un vehicule via `source_module`, `source_type`, `source_id`.
- Module Finances desactivable avec blocage `403`.
- Frontend branche pour resume, creation compte, categorie, operation et liste simple.

## V0.4

Le cadrage est dans `docs/V0.4_STOCK_PLAN.md`.

Etat actuel V0.4:

- Tables Prisma stock appliquees en migration.
- API articles stock et mouvements.
- Achat stock avec mouvement et depense financiere liee si compte fourni.
- Sortie stock avec mouvement vers vehicule et intervention/cout vehicule.
- Module Stock desactivable avec blocage `403`.
- Frontend branche pour creation article, achat, sortie et liste mouvements.

## V0.5

Le cadrage est dans `docs/V0.5_AGENDA_PLAN.md`.

Etat actuel V0.5:

- Tables Prisma taches, sous-taches et notifications appliquees en migration.
- Champ expiration document ajoute au schema.
- API agenda: dashboard, taches, sous-taches, notifications, marquage lu.
- Notification automatique quand une tache a une echeance.
- Module Agenda desactivable avec blocage `403`.
- Frontend branche pour creation tache, sous-tache, liste taches et notifications.

## V1.0

Le cadrage est dans `docs/V1.0_STABILISATION_PLAN.md`.

Etat actuel V1.0:

- Recherche globale API et frontend.
- Rapport simple API et frontend.
- Export ZIP authentifie avec manifeste et fichiers prives disponibles.
- Export ZIP refuse sans authentification.
- Procedure de restauration documentee.
- Tests e2e et build valides via `npm run validate`.

## V1.1

Le cadrage est dans `docs/V1.1_REAL_ESTATE_PLAN.md`.

Etat actuel V1.1:

- Module Immobilier minimal.
- API biens immobiliers protegee par JWT.
- Liste, creation, fiche detaillee et modification de bien.
- Evenements/echeances simples avec notification automatique.
- Documents existants lies a un bien et upload depuis la fiche.
- Operations financieres liees a un bien via `source_module`, `source_type`, `source_id`.
- Recherche globale, rapports et export ZIP enrichis avec l'immobilier.
- Module Immobilier desactivable avec blocage `403`.

## V1.2

Le cadrage est dans `docs/V1.2_CONTACTS_PLAN.md`.

Etat actuel V1.2:

- Module Contacts minimal.
- API contacts protegee par JWT.
- Liste, creation, fiche detaillee et modification de contact.
- Interactions datees par contact.
- Documents existants lies a un contact et upload depuis la fiche.
- Recherche globale, rapports et export ZIP enrichis avec les contacts.
- Module Contacts desactivable avec blocage `403`.

## V1.3

Le cadrage est dans `docs/V1.3_CORE_SETTINGS_LOGS_PLAN.md`.

Etat actuel V1.3:

- API profil et sessions.
- API parametres utilisateur.
- API activite et audit.
- API erreurs serveur.
- Logs sur auth, profil, parametres et activation modules.
- Frontend branche pour profil, sessions, parametres, activite, audit et erreurs.
- Export ZIP enrichi avec parametres et logs.

## V2.0

Le cadrage est dans `docs/V2.0_AUTH_EMAIL_VERIFICATION_PLAN.md`.

Etat actuel V2.0:

- Inscription avec email, mot de passe, nom et code invitation optionnel.
- Comptes non verifies bloques au login.
- Verification email par token hashé en base.
- Envoi email SMTP optionnel pour le lien de verification.
- Renvoi de verification.
- Logs audit et activite.
- UI minimale d'inscription et verification.

## V2.1

Le cadrage est dans `docs/V2.1_POSTHOG_PLAN.md`.

Etat actuel V2.1:

- PostHog frontend optionnel.
- Tracking manuel sans donnees sensibles.
- Autocapture, pageview automatique et session replay desactives.
