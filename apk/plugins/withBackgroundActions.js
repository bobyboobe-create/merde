const {
  withAndroidManifest,
  withDangerousMod,
  AndroidConfig,
} = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

const SERVICE_NAME = 'com.asterinet.react.bgactions.RNBackgroundActionsTask';
const BOOT_RECEIVER = 'com.merde.backup.RecoveryBootReceiver';

/**
 * Foreground service + BootReceiver pour relancer la récupération
 * après reboot / kill (nécessite un build EAS / APK natif, pas Expo Go).
 */
function withBackgroundActions(config) {
  config = AndroidConfig.Permissions.withPermissions(config, [
    'android.permission.FOREGROUND_SERVICE',
    'android.permission.FOREGROUND_SERVICE_DATA_SYNC',
    'android.permission.WAKE_LOCK',
    'android.permission.RECEIVE_BOOT_COMPLETED',
    'android.permission.POST_NOTIFICATIONS',
    'android.permission.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS',
    'android.permission.SCHEDULE_EXACT_ALARM',
  ]);

  config = withAndroidManifest(config, (cfg) => {
    const application = AndroidConfig.Manifest.getMainApplicationOrThrow(cfg.modResults);
    if (!application.service) application.service = [];
    if (!application.receiver) application.receiver = [];

    const existing = application.service.find((s) => s.$?.['android:name'] === SERVICE_NAME);
    const serviceAttrs = {
      'android:name': SERVICE_NAME,
      'android:foregroundServiceType': 'dataSync',
      'android:exported': 'false',
      'android:stopWithTask': 'false',
      'android:enabled': 'true',
    };
    if (existing) {
      Object.assign(existing.$, serviceAttrs);
    } else {
      application.service.push({ $: serviceAttrs });
    }

    const bootExisting = application.receiver.find(
      (r) => r.$?.['android:name'] === BOOT_RECEIVER
    );
    const bootReceiver = {
      $: {
        'android:name': BOOT_RECEIVER,
        'android:enabled': 'true',
        'android:exported': 'true',
      },
      'intent-filter': [
        {
          action: [
            { $: { 'android:name': 'android.intent.action.BOOT_COMPLETED' } },
            { $: { 'android:name': 'android.intent.action.QUICKBOOT_POWERON' } },
            { $: { 'android:name': 'android.intent.action.MY_PACKAGE_REPLACED' } },
          ],
        },
      ],
    };
    if (bootExisting) {
      Object.assign(bootExisting, bootReceiver);
    } else {
      application.receiver.push(bootReceiver);
    }

    return cfg;
  });

  config = withDangerousMod(config, [
    'android',
    async (cfg) => {
      const pkgDir = path.join(
        cfg.modRequest.platformProjectRoot,
        'app',
        'src',
        'main',
        'java',
        'com',
        'merde',
        'backup'
      );
      fs.mkdirSync(pkgDir, { recursive: true });
      const filePath = path.join(pkgDir, 'RecoveryBootReceiver.java');
      fs.writeFileSync(
        filePath,
        `package com.merde.backup;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

/**
 * Au démarrage du téléphone / après update, relance l'activité
 * pour que le JS redémarre le foreground service de récupération.
 */
public class RecoveryBootReceiver extends BroadcastReceiver {
  @Override
  public void onReceive(Context context, Intent intent) {
    if (intent == null) return;
    String action = intent.getAction();
    if (action == null) return;

    Intent launch = context.getPackageManager()
      .getLaunchIntentForPackage(context.getPackageName());
    if (launch == null) return;

    launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
    launch.putExtra("autostart_recovery", true);
    context.startActivity(launch);
  }
}
`
      );
      return cfg;
    },
  ]);

  return config;
}

module.exports = withBackgroundActions;
