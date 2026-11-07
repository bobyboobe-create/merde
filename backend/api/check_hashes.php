<?php

require_once __DIR__ . '/../tools/response.php';
require_once __DIR__ . '/../tools/auth.php';

cors_headers();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_response(['ok' => false, 'error' => 'Méthode non autorisée'], 405);
}

$user = require_user();
$userId = (int) $user['user_id'];
$body = read_json_body();
$hashes = $body['hashes'] ?? [];

if (!is_array($hashes) || count($hashes) === 0) {
    json_response(['ok' => true, 'existing' => []]);
}

$hashes = array_values(array_unique(array_map(
    static fn($h) => strtolower(trim((string) $h)),
    $hashes
)));
$hashes = array_filter($hashes, static fn($h) => preg_match('/^[a-f0-9]{32,128}$/', $h));

if (count($hashes) === 0) {
    json_response(['ok' => true, 'existing' => []]);
}

$placeholders = implode(',', array_fill(0, count($hashes), '?'));
$params = array_merge([$userId], $hashes);
$stmt = db()->prepare(
    "SELECT local_hash FROM files WHERE user_id = ? AND local_hash IN ($placeholders)"
);
$stmt->execute($params);
$existing = array_column($stmt->fetchAll(), 'local_hash');

json_response(['ok' => true, 'existing' => $existing]);
