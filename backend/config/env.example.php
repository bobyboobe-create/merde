<?php
/**
 * Fichier d'exemple de configuration.
 *
 * Usage :
 *   1. Copier ce fichier vers env.php
 *      copy env.example.php env.php
 *   2. Remplacer les valeurs ci-dessous (MySQL + Cloudinary)
 *
 * Ne committez jamais env.php avec de vrais secrets.
 */
return [
    'db' => [
        'host' => '127.0.0.1',
        'name' => 'merde_backup',
        'user' => 'root',
        'pass' => '',
        'charset' => 'utf8mb4',
    ],
    'cloudinary' => [
        'cloud_name' => 'VOTRE_CLOUD_NAME',
        'api_key' => 'VOTRE_API_KEY',
        'api_secret' => 'VOTRE_API_SECRET',
        'folder' => 'merde_backup',
    ],
    'app' => [
        'cors_origin' => '*',
        'session_ttl_hours' => 720,
    ],
];
