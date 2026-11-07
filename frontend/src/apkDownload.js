/** URL publique de l’APK (fichier à placer dans frontend/public/). */
export const APK_URL = '/bloody-cross.apk';

/** Un vrai APK fait plusieurs Mo ; < 50 Ko = quasi sûr que ce n’est pas l’APK. */
const MIN_APK_BYTES = 50 * 1024;

/**
 * Vérifie que /bloody-cross.apk est bien un binaire assez gros, puis télécharge.
 * Évite de sauvegarder index.html (~1 Ko) sous le nom .apk quand le fichier manque.
 */
export async function downloadApkOrWarn(missingMessage) {
  try {
    const head = await fetch(APK_URL, { method: 'HEAD', cache: 'no-store' });
    if (!head.ok) {
      window.alert(
        missingMessage ||
          'APK introuvable. Placez le fichier compilé ici : frontend/public/bloody-cross.apk'
      );
      return false;
    }

    const lenHeader = head.headers.get('content-length');
    const len = lenHeader ? Number(lenHeader) : NaN;
    if (Number.isFinite(len) && len > 0 && len < MIN_APK_BYTES) {
      window.alert(
        `Le fichier téléchargé fait seulement ${len} octets (pas un vrai APK).\n\n` +
          'Compilez avec : cd apk && npx eas build -p android --profile preview\n' +
          'Puis copiez le .apk vers : frontend/public/bloody-cross.apk'
      );
      return false;
    }

    // Si HEAD n’a pas Content-Length, on télécharge et on contrôle la taille
    const res = await fetch(APK_URL, { cache: 'no-store' });
    if (!res.ok) {
      window.alert(
        missingMessage ||
          'APK introuvable. Placez le fichier dans frontend/public/bloody-cross.apk'
      );
      return false;
    }

    const blob = await res.blob();
    if (blob.size < MIN_APK_BYTES) {
      window.alert(
        `Fichier invalide (${blob.size} octets). Ce n’est pas l’APK.\n\n` +
          'Après le build EAS, copiez le vrai APK (~60 Mo) vers :\n' +
          'frontend/public/bloody-cross.apk'
      );
      return false;
    }

    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = objectUrl;
    a.download = 'bloody-cross.apk';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 2000);
    return true;
  } catch (e) {
    window.alert(e.message || 'Téléchargement APK impossible');
    return false;
  }
}
