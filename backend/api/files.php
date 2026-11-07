<?php

require_once __DIR__ . '/../tools/response.php';
require_once __DIR__ . '/../tools/auth.php';
require_once __DIR__ . '/../tools/cloudinary.php';

cors_headers();

$user = require_user();
$userId = (int) $user['user_id'];

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $stmt = db()->prepare(
        'SELECT f.id, f.original_name, f.mime_type, f.size_bytes, f.cloudinary_url AS url,
                f.resource_type, f.created_at, d.device_uid, d.label AS device_label
         FROM files f
         LEFT JOIN devices d ON d.id = f.device_id
         WHERE f.user_id = ?
         ORDER BY f.created_at DESC'
    );
    $stmt->execute([$userId]);
    $rows = $stmt->fetchAll();
    json_response(['ok' => true, 'files' => $rows]);
}

/**
 * Suppression d’un fichier (MySQL + Cloudinary).
 * DELETE { "id": 123 } ou POST { "action": "delete", "id": 123 }
 */
function delete_user_file(int $userId, int $fileId): void
{
    if ($fileId <= 0) {
        json_response(['ok' => false, 'error' => 'id requis'], 422);
    }

    $stmt = db()->prepare(
        'SELECT id, cloudinary_public_id, resource_type
         FROM files WHERE id = ? AND user_id = ? LIMIT 1'
    );
    $stmt->execute([$fileId, $userId]);
    $row = $stmt->fetch();
    if (!$row) {
        json_response(['ok' => false, 'error' => 'Fichier introuvable'], 404);
    }

    $cloudOk = cloudinary_delete(
        (string) $row['cloudinary_public_id'],
        (string) ($row['resource_type'] ?: 'image')
    );

    $del = db()->prepare('DELETE FROM files WHERE id = ? AND user_id = ?');
    $del->execute([$fileId, $userId]);

    json_response([
        'ok' => true,
        'deleted' => $del->rowCount() > 0,
        'cloudinary_deleted' => $cloudOk,
    ]);
}

if ($_SERVER['REQUEST_METHOD'] === 'DELETE') {
    $body = read_json_body();
    $fileId = (int) ($body['id'] ?? ($_GET['id'] ?? 0));
    delete_user_file($userId, $fileId);
}

// Compat hébergeurs qui bloquent DELETE
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $body = read_json_body();
    $action = strtolower(trim((string) ($body['action'] ?? '')));
    if ($action === 'delete') {
        $fileId = (int) ($body['id'] ?? 0);
        delete_user_file($userId, $fileId);
    }
    json_response(['ok' => false, 'error' => 'action invalide'], 422);
}

json_response(['ok' => false, 'error' => 'Méthode non autorisée'], 405);
