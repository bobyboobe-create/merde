<?php

require_once __DIR__ . '/../tools/response.php';
require_once __DIR__ . '/../tools/auth.php';

cors_headers();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_response(['ok' => false, 'error' => 'Méthode non autorisée'], 405);
}

$body = read_json_body();
$username = trim((string) ($body['username'] ?? ''));
$password = (string) ($body['password'] ?? '');
$deviceUid = trim((string) ($body['device_uid'] ?? ($_SERVER['HTTP_X_DEVICE_UID'] ?? '')));
$deviceLabel = trim((string) ($body['device_label'] ?? ($_SERVER['HTTP_X_DEVICE_LABEL'] ?? '')));

if ($username === '' || $password === '') {
    json_response(['ok' => false, 'error' => 'Identifiants requis'], 422);
}

$stmt = db()->prepare('SELECT id, username, password_hash FROM users WHERE username = ? LIMIT 1');
$stmt->execute([$username]);
$user = $stmt->fetch();

if (!$user || !password_verify($password, $user['password_hash'])) {
    json_response(['ok' => false, 'error' => 'Identifiants incorrects'], 401);
}

$userId = (int) $user['id'];
$deviceId = null;
if ($deviceUid !== '') {
    $deviceId = upsert_device($userId, $deviceUid, $deviceLabel !== '' ? $deviceLabel : null);
}

$session = create_session($userId, $deviceId);
json_response([
    'ok' => true,
    'user' => ['id' => $userId, 'username' => $user['username']],
    'device_id' => $deviceId,
    'token' => $session['token'],
    'expires_at' => $session['expires_at'],
]);
