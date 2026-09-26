# B-A BA Hunters

## Développement avec PostgreSQL

1. Créer une base PostgreSQL nommée `syllabic_hunters`.
2. Copier `.env.example` vers `.env` et adapter `DATABASE_URL`.
3. Lancer `npm run dev`.

Le serveur Express écoute sur `http://localhost:3001`. En développement, il relaie le site et les assets vers Vite (`http://localhost:5173`) et conserve les routes `/api` pour l'authentification. En production, il sert directement `dist/` et le frontend ainsi que l'API partagent le même domaine. Le serveur crée les tables PostgreSQL au démarrage; `schema.sql` est fourni pour une initialisation manuelle.

Pour un déploiement, exécuter `npm run build` puis `npm start`. Le build compile le serveur dans `dist-server/`; le démarrage production utilise Node directement et ne dépend donc pas de `tsx` ou des `devDependencies`.

Les mots de passe sont hachés avec bcrypt. Les sessions utilisent un cookie HttpOnly dont seul le hash est stocké en base. Les invités continuent à utiliser `localStorage`; une connexion synchronise ensuite le progrès avec PostgreSQL.
