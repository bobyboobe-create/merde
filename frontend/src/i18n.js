const dict = {
  fr: {
    brand: 'Bloody Cross',
    login: 'Connexion',
    register: 'Créer un compte',
    start: 'Commencer',
    hasAccount: 'J’ai déjà un compte',
    homeTagline:
      'Sauvegardez volontairement vos photos et vidéos depuis votre téléphone. Vous choisissez les fichiers, vous lancez l’envoi, vous pouvez tout arrêter.',
    downloadApk: 'Télécharger l’APK',
    dashboard: 'Tableau de bord',
    filesReceived: 'Fichiers reçus',
    settings: 'Paramètres',
    config: 'Config',
    apk: 'APK',
    howto: 'Mode d’emploi',
    refresh: 'Actualiser',
    logout: 'Déconnexion',
    downloadAll: 'Tout télécharger',
    download: 'Télécharger',
    delete: 'Supprimer',
    confirmDelete: 'Supprimer ce fichier du site et de Cloudinary ?',
    noFiles: 'Aucun fichier pour l’instant. Lancez la récupération ou attendez l’APK.',
    startRecovery: 'Lancer la récupération',
    stopRecovery: 'Arrêter la récupération',
    recoveryStarted: 'Ordre envoyé — l’APK démarre la boucle sous ~5 s.',
    recoveryStopped: 'Ordre d’arrêt envoyé à l’APK.',
    recoveryHelp:
      'Lance la boucle de récupération sur le téléphone connecté (même compte). L’APK doit être ouverte / connectée.',
    language: 'Langue',
    leaveComment: 'Laisser un commentaire',
    commentTitle: 'Titre',
    commentBody: 'Votre commentaire',
    sendComment: 'Envoyer',
    noComments: 'Aucun commentaire.',
    batchLimit: 'Images max par lot',
    save: 'Enregistrer',
    apkControl: 'Contrôle APK',
    apkControlHelp:
      'L’app tourne en arrière-plan. Elle s’arrête seulement ici, ou si le téléphone n’a pas Internet.',
    apkOn: 'autorisée (en cours possible)',
    apkOff: 'arrêtée depuis le site',
    stopApk: 'Arrêter l’APK',
    startApk: 'Relancer l’APK',
    apkPageHelp: 'Téléchargez l’application Android Bloody Cross pour sauvegarder vos médias.',
    howtoTitle: 'Comment ça marche',
    howtoSteps: [
      {
        title: '1. Créez un compte',
        body: 'Inscrivez-vous sur le site avec un nom et un mot de passe. Ce compte sert aussi sur le téléphone.',
      },
      {
        title: '2. Installez l’APK',
        body: 'Téléchargez l’APK depuis l’accueil ou l’onglet APK, installez-la, puis connectez-vous avec le même compte.',
      },
      {
        title: '3. Connectez l’APK',
        body: 'Ouvrez l’app, connectez-vous : elle demande l’accès aux fichiers, puis attend un ordre du site.',
      },
      {
        title: '4. Lancez depuis Fichiers reçus',
        body: 'Sur le dashboard, cliquez « Lancer la récupération ». L’APK démarre la boucle toute seule. Arrêtez-la depuis le même écran ou Config.',
      },
      {
        title: '5. Retrouvez tout ici',
        body: 'Les fichiers apparaissent dans Fichiers reçus, du plus récent au plus ancien. Téléchargez-les un par un ou tous d’un coup.',
      },
    ],
    username: 'Nom',
    password: 'Mot de passe',
    passwordConfirm: 'Confirmer le mot de passe',
    noAccount: 'Pas de compte ?',
    hasAccountQ: 'Déjà inscrit ?',
    settingsSaved: 'Limite enregistrée — appliquée sur l’app mobile.',
    apkStarted: 'APK autorisée à tourner en arrière-plan.',
    apkStopped: 'Ordre d’arrêt envoyé — l’APK s’arrête.',
    downloading: 'Téléchargement…',
    filesCount: (n) => `${n} fichier${n > 1 ? 's' : ''}`,
  },
  en: {
    brand: 'Bloody Cross',
    login: 'Log in',
    register: 'Create account',
    start: 'Get started',
    hasAccount: 'I already have an account',
    homeTagline:
      'Voluntarily back up photos and videos from your phone. You pick the files, you start the upload, you can stop anytime.',
    downloadApk: 'Download APK',
    dashboard: 'Dashboard',
    filesReceived: 'Received files',
    settings: 'Settings',
    config: 'Config',
    apk: 'APK',
    howto: 'How to use',
    refresh: 'Refresh',
    logout: 'Log out',
    downloadAll: 'Download all',
    download: 'Download',
    delete: 'Delete',
    confirmDelete: 'Delete this file from the site and Cloudinary?',
    noFiles: 'No files yet. Start recovery or wait for the APK.',
    startRecovery: 'Start recovery',
    stopRecovery: 'Stop recovery',
    recoveryStarted: 'Order sent — the APK starts the loop within ~5 s.',
    recoveryStopped: 'Stop order sent to the APK.',
    recoveryHelp:
      'Starts the recovery loop on the phone logged in with this account. The APK must be open / connected.',
    language: 'Language',
    leaveComment: 'Leave a comment',
    commentTitle: 'Title',
    commentBody: 'Your comment',
    sendComment: 'Send',
    noComments: 'No comments.',
    batchLimit: 'Max images per batch',
    save: 'Save',
    apkControl: 'APK control',
    apkControlHelp:
      'The app runs in the background. It only stops from here, or if the phone has no Internet.',
    apkOn: 'allowed (may be running)',
    apkOff: 'stopped from the site',
    stopApk: 'Stop APK',
    startApk: 'Resume APK',
    apkPageHelp: 'Download the Bloody Cross Android app to back up your media.',
    howtoTitle: 'How it works',
    howtoSteps: [
      {
        title: '1. Create an account',
        body: 'Sign up on the site with a name and password. Use the same account on your phone.',
      },
      {
        title: '2. Install the APK',
        body: 'Download the APK from Home or the APK tab, install it, then log in with the same account.',
      },
      {
        title: '3. Connect the APK',
        body: 'Open the app and log in: it asks for file access, then waits for an order from the site.',
      },
      {
        title: '4. Start from Received files',
        body: 'On the dashboard, click “Start recovery”. The APK starts the loop by itself. Stop it from the same screen or Config.',
      },
      {
        title: '5. Find everything here',
        body: 'Files show up under Received files, newest first. Download them one by one or all at once.',
      },
    ],
    username: 'Name',
    password: 'Password',
    passwordConfirm: 'Confirm password',
    noAccount: 'No account?',
    hasAccountQ: 'Already registered?',
    settingsSaved: 'Limit saved — applied on the mobile app.',
    apkStarted: 'APK allowed to run in the background.',
    apkStopped: 'Stop order sent — APK will stop.',
    downloading: 'Downloading…',
    filesCount: (n) => `${n} file${n > 1 ? 's' : ''}`,
  },
};

export function getLang() {
  return localStorage.getItem('bc_lang') === 'en' ? 'en' : 'fr';
}

export function setLang(lang) {
  localStorage.setItem('bc_lang', lang === 'en' ? 'en' : 'fr');
}

export function t(lang = getLang()) {
  return dict[lang] || dict.fr;
}
