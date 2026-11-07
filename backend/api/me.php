<?php

require_once __DIR__ . '/../tools/response.php';
require_once __DIR__ . '/../tools/auth.php';

cors_headers();

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    json_response(['ok' => false, 'error' => 'Méthode non autorisée'], 405);
}

$user = require_user();
$userId = (int) $user['user_id'];

$stmt = db()->prepare(
    'SELECT upload_batch_limit, apk_enabled FROM users WHERE id = ? LIMIT 1'
);
$stmt->execute([$userId]);
$row = $stmt->fetch();
$batchLimit = $row ? (int) $row['upload_batch_limit'] : 20;
$apkEnabled = $row ? ((int) $row['apk_enabled'] === 1) : true;

json_response([
    'ok' => true,
    'user' => [
        'id' => $userId,
        'username' => $user['username'],
        'upload_batch_limit' => $batchLimit,
        'apk_enabled' => $apkEnabled,
    ],
    'settings' => [
        'upload_batch_limit' => $batchLimit,
        'apk_enabled' => $apkEnabled,
    ],
    'device_id' => $user['device_id'] !== null ? (int) $user['device_id'] : null,
]);
