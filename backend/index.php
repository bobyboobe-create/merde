<?php
header('Content-Type: application/json; charset=utf-8');
echo json_encode([
    'ok' => true,
    'service' => 'merde-backup',
    'api' => 'api/',
    'endpoints' => [
        'register.php',
        'login.php',
        'me.php',
        'upload.php',
        'check_hashes.php',
        'files.php',
        'devices.php',
        'notes.php',
    ],
], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
