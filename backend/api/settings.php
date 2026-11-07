<?php

require_once __DIR__ . '/../tools/response.php';
require_once __DIR__ . '/../tools/auth.php';

cors_headers();

$user = require_user();
$userId = (int) $user['user_id'];

const BATCH_LIMIT_MIN = 1;
const BATCH_LIMIT_MAX = 500;

function fetch_settings(int $userId): array
{
    $stmt = db()->prepare(
        'SELECT upload_batch_limit, apk_enabled FROM users WHERE id = ? LIMIT 1'
    );
    $stmt->execute([$userId]);
    $row = $stmt->fetch();
    if (!$row) {
        json_response(['ok' => false, 'error' => 'Utilisateur introuvable'], 404);
    }
    return [
        'upload_batch_limit' => (int) $row['upload_batch_limit'],
        'apk_enabled' => (int) $row['apk_enabled'] === 1,
    ];
}

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    json_response(['ok' => true, 'settings' => fetch_settings($userId)]);
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $body = read_json_body();
    $current = fetch_settings($userId);
    $limit = $current['upload_batch_limit'];
    $apkEnabled = $current['apk_enabled'] ? 1 : 0;

    if (array_key_exists('upload_batch_limit', $body)) {
        $limit = (int) $body['upload_batch_limit'];
        if ($limit < BATCH_LIMIT_MIN || $limit > BATCH_LIMIT_MAX) {
            json_response([
                'ok' => false,
                'error' => 'Limite invalide (entre ' . BATCH_LIMIT_MIN . ' et ' . BATCH_LIMIT_MAX . ')',
            ], 422);
        }
    }

    if (array_key_exists('apk_enabled', $body)) {
        $apkEnabled = filter_var($body['apk_enabled'], FILTER_VALIDATE_BOOLEAN) ? 1 : 0;
    }

    if (
        !array_key_exists('upload_batch_limit', $body)
        && !array_key_exists('apk_enabled', $body)
    ) {
        json_response(['ok' => false, 'error' => 'Aucun paramètre à mettre à jour'], 422);
    }

    db()->prepare(
        'UPDATE users SET upload_batch_limit = ?, apk_enabled = ? WHERE id = ?'
    )->execute([$limit, $apkEnabled, $userId]);

    json_response(['ok' => true, 'settings' => fetch_settings($userId)]);
}

json_response(['ok' => false, 'error' => 'Méthode non autorisée'], 405);
