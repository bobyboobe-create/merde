# Merde Backup — sauvegarde personnelle

Site web + app mobile + backend PHP. L’utilisateur **choisit** ses fichiers, **lance** l’envoi, et peut **tout arrêter**. Rien ne tourne en arrière-plan sans action.

## Structure

```
merde/
  apk/        React Native (Expo) — UI minimale, objectif APK < 20 Mo
  backend/    PHP + MySQL + Cloudinary
  frontend/   React (Vite) — vitrine, compte, tableau de bord
```

## Principes (légitimes)

- Connexion avec **votre** compte (nom + mot de passe).
- Sélection **explicite** d’images / vidéos dans l’app.
- Pas de scan automatique de tout le téléphone.
- Pas d’upload tant que l’utilisateur n’appuie pas sur « Démarrer ».
- Bouton **TOUT ARRÊTER** : coupe immédiatement la file d’attente.
- Anti-doublon via hash local + `check_hashes.php`.
- Pause / reprise si la connexion coupe (pendant une session démarrée).
- Fichiers stockés sur **Cloudinary**, métadonnées en **MySQL**.
- Plusieurs appareils possibles **pour le même compte** (table `devices` + sessions).

## Backend

### Dossiers

- `backend/config/` — `env.php`, `database.php`
- `backend/tools/` — auth, Cloudinary, réponses JSON
- `backend/api/` — endpoints
- `backend/sql/schema.sql` — schéma MySQL

### API

| Endpoint | Méthode | Rôle |
|----------|---------|------|
| `register.php` | POST | Créer un compte |
| `login.php` | POST | Connexion (+ device_uid optionnel) |
| `me.php` | GET | Utilisateur courant |
| `upload.php` | POST | Upload fichier (multipart + `local_hash`) |
| `check_hashes.php` | POST | Savoir quels hash existent déjà |
| `files.php` | GET / DELETE | Lister / supprimer **ses** fichiers |
| `devices.php` | GET | Appareils liés au compte |
| `notes.php` | GET / POST / DELETE | Notes liées à l’utilisateur |

### Mise en route

1. Importer `backend/sql/schema.sql` dans MySQL.
2. Copier `backend/config/env.example.php` → `env.php` et renseigner MySQL + Cloudinary.
3. Servir `backend/` via Apache/Nginx (ex. `http://localhost/merde/backend/api`).

## App mobile (`apk/`)

- Expo, styles natifs basiques.
- Images uniquement ; limite de lot définie sur le site web.
- Service Android persistant : continue **app fermée** (notification).
- Reprise automatique après **rallumage** du téléphone (`startOnBoot`).
- Arrêt distant depuis le dashboard (`apk_enabled`), ou si Internet insuffisant.
- Build **EAS requis** (pas Expo Go) à cause du foreground service.

```bash
cd apk
npm install
# Éditer src/config.js → URL du backend
npx eas build -p android --profile preview
```

Après install APK : dans Réglages → Batterie, autoriser l’activité en arrière-plan pour Merde Backup.

## Frontend (`frontend/`) — Bloody Cross

```bash
cd frontend
npm install
cp .env.example .env   # VITE_API_BASE=...
npm run dev
```

- `/` vitrine (logo Bloody Cross + téléchargement APK)  
- `/register` nom + mot de passe + confirmation  
- `/login`  
- `/dashboard` sidebar : fichiers reçus, paramètres (langue / commentaire / déconnexion), config, APK, mode d’emploi  

Placez l’APK compilé dans `frontend/public/bloody-cross.apk` (nom exact) pour activer le téléchargement.

```bash
cd apk
npx eas build -p android --profile preview
# puis copier le .apk téléchargé → frontend/public/bloody-cross.apk
```

Si le téléchargement fait ~1 Ko (ex. 886 octets), le fichier APK est **absent** : le serveur renvoie la page HTML à la place.

## Flux

1. Créer un compte sur le site.
2. Se connecter dans l’app avec le même compte.
3. Choisir des fichiers → Démarrer l’envoi.
4. Les voir sur le tableau de bord web.
