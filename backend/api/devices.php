<?php

require_once __DIR__ . '/../tools/response.php';
require_once __DIR__ . '/../tools/auth.php';

cors_headers();

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    json_response(['ok' => false, 'error' => 'Méthode non autorisée'], 405);
}

$user = require_user();
$stmt = db()->prepare(
    'SELECT id, device_uid, label, last_seen_at, created_at
     FROM devices WHERE user_id = ? ORDER BY last_seen_at DESC'
);
$stmt->execute([(int) $user['user_id']]);
json_response(['ok' => true, 'devices' => $stmt->fetchAll()]);
