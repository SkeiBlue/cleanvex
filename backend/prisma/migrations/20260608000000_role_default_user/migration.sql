-- Sécurité (C3) : le rôle par défaut ne doit pas être "admin".
-- Les deux chemins de création (inscription, seed) fixent déjà le rôle
-- explicitement ; on aligne le défaut de la colonne pour qu'un futur INSERT
-- sans rôle ne crée plus un administrateur par accident.
ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'user';
