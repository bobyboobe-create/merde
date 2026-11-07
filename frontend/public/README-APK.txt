Placez ici le fichier APK compilé, nommé exactement :

  bloody-cross.apk

Build :
  cd apk
  npx eas build -p android --profile preview

Puis téléchargez l’artefact EAS et copiez-le dans ce dossier (frontend/public/).

Sans ce fichier, le bouton « Télécharger l’APK » du site échoue
(ou télécharge une page HTML de ~1 Ko à la place).
