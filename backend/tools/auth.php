<?php

require_once __DIR__ . '/../config/database.php';

function create_session(int $userId, ?int $deviceId = null): array
{
    $cfg = require __DIR__ . '/../config/env.php';
    $ttl = (int) ($cfg['app']['session_ttl_hours'] ?? 720);
    $token = bin2hex(random_bytes(32));
    $expires = (new DateTimeImmutable("+{$ttl} hours"))->format('Y-m-d H:i:s');

    $stmt = db()->prepare(
        'INSERT INTO sessions (user_id, device_id, token, expires_at) VALUES (?, ?, ?, ?)'
    );
    $stmt->execute([$userId, $deviceId, $token, $expires]);

    return ['token' => $token, 'expires_at' => $expires];
}

function require_user(): array
{
    $token = bearer_token();
    if (!$token) {
        json_response(['ok' => false, 'error' => 'Non authentifié'], 401);
    }

    $stmt = db()->prepare(
        'SELECT s.id AS session_id, s.device_id, s.expires_at, u.id AS user_id, u.username
         FROM sessions s
         INNER JOIN users u ON u.id = s.user_id
         WHERE s.token = ?
         LIMIT 1'
    );
    $stmt->execute([$token]);
    $row = $stmt->fetch();

    if (!$row) {
        json_response(['ok' => false, 'error' => 'Session invalide'], 401);
    }

    if (strtotime($row['expires_at']) < time()) {
        json_response(['ok' => false, 'error' => 'Session expirée'], 401);
    }

    return $row;
}

function upsert_device(int $userId, string $deviceUid, ?string $label = null): int
{
    $pdo = db();
    $stmt = $pdo->prepare(
        'SELECT id FROM devices WHERE user_id = ? AND device_uid = ? LIMIT 1'
    );
    $stmt->execute([$userId, $deviceUid]);
    $existing = $stmt->fetch();

    if ($existing) {
        $upd = $pdo->prepare(
            'UPDATE devices SET label = COALESCE(?, label), last_seen_at = NOW() WHERE id = ?'
        );
        $upd->execute([$label, $existing['id']]);
        return (int) $existing['id'];
    }

    $ins = $pdo->prepare(
        'INSERT INTO devices (user_id, device_uid, label, last_seen_at) VALUES (?, ?, ?, NOW())'
    );
    $ins->execute([$userId, $deviceUid, $label]);
    return (int) $pdo->lastInsertId();
}
