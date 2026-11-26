# B-A BA Hunters

## Développement avec PostgreSQL

1. Créer une base PostgreSQL nommée `syllabic_hunters`.
2. Copier `.env.example` vers `.env` et adapter `DATABASE_URL`.
3. Lancer `npm run dev`.

Le serveur Express écoute sur `http://localhost:3001`. En développement, il relaie le site et les assets vers Vite (`http://localhost:5173`) et conserve les routes `/api` pour l'authentification. En production, il sert directement `dist/` et le frontend ainsi que l'API partagent le même domaine. Le serveur crée les tables PostgreSQL au démarrage; `schema.sql` est fourni pour une initialisation manuelle.

Pour un déploiement, exécuter `npm run build` puis `npm start`. Le build compile le serveur dans `dist-server/`; le démarrage production utilise Node directement et ne dépend donc pas de `tsx` ou des `devDependencies`.

Les mots de passe sont hachés avec bcrypt. Les sessions utilisent un cookie HttpOnly dont seul le hash est stocké en base. Les invités continuent à utiliser `localStorage`; une connexion synchronise ensuite le progrès avec PostgreSQL.

## Assets Seafile

Les assets ne sont pas versionnés dans Git. Ils résident dans la bibliothèque Seafile `Hunters`, sous `Hunters/assets/`. Copier `.env.example` vers `.env` et définir `SEAFILE_TOKEN` avec un jeton API Seafile; le jeton reste côté serveur et n'est jamais envoyé au navigateur.

- `npm run assets:pull` récupère tous les fichiers de Seafile dans le dossier local ignoré `assets/`.
- `npm run assets:pull:final` récupère uniquement `assets/final`.
- `npm run assets:push` envoie les fichiers locaux manquants ou modifiés vers Seafile.
- `npm run assets:status` compare les fichiers locaux et distants.
- Ajouter `-- --force` à `assets:pull` ou `assets:push` pour remplacer aussi les fichiers de même taille.

Faire `assets:pull` après un clone pour disposer des références ImageGen et des médias de travail. La commande `npm run build` télécharge automatiquement `assets/final` avant la compilation.

Le workflow GitHub Actions transmet le secret du dépôt `SEAFILE_TOKEN` à Dokku. Le build Dokku récupère ensuite `assets/final` depuis Seafile. Ajouter ce secret dans **Settings → Secrets and variables → Actions** du dépôt GitHub.
# Revue des voix

Ouvrir `http://localhost:5175/?voice-review` (ou ajouter `?voice-review` à l’adresse du site) pour écouter les sons préenregistrés, voir leur texte et leur contexte, puis signaler ceux qui ont un accent anglais ou un autre souci avec une remarque. Les signalements sont conservés dans le stockage local du navigateur. Le bouton d’export produit un fichier JSON à transmettre pour préparer les corrections.
