<?php

require_once __DIR__ . '/../tools/response.php';
require_once __DIR__ . '/../tools/auth.php';
require_once __DIR__ . '/../tools/cloudinary.php';

cors_headers();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_response(['ok' => false, 'error' => 'Méthode non autorisée'], 405);
}

$user = require_user();
$userId = (int) $user['user_id'];
$deviceId = $user['device_id'] !== null ? (int) $user['device_id'] : null;

if (empty($_FILES['file'])) {
    json_response(['ok' => false, 'error' => 'Fichier manquant'], 422);
}

$file = $_FILES['file'];
if (($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
    json_response(['ok' => false, 'error' => 'Erreur upload PHP'], 400);
}

$localHash = trim((string) ($_POST['local_hash'] ?? ''));
if ($localHash === '' || !preg_match('/^[a-f0-9]{32,128}$/i', $localHash)) {
    json_response(['ok' => false, 'error' => 'local_hash requis'], 422);
}

$check = db()->prepare('SELECT id, cloudinary_url FROM files WHERE user_id = ? AND local_hash = ? LIMIT 1');
$check->execute([$userId, strtolower($localHash)]);
$existing = $check->fetch();
if ($existing) {
    json_response([
        'ok' => true,
        'duplicate' => true,
        'file' => [
            'id' => (int) $existing['id'],
            'url' => $existing['cloudinary_url'],
        ],
    ]);
}

$originalName = basename((string) $file['name']);
$mime = (string) ($file['type'] ?: 'application/octet-stream');
$size = (int) $file['size'];

// RN / Android envoie parfois application/octet-stream → on déduit via extension
if ($mime === 'application/octet-stream' || $mime === '' || $mime === 'image') {
    $lower = strtolower($originalName);
    if (str_ends_with($lower, '.png')) $mime = 'image/png';
    elseif (str_ends_with($lower, '.webp')) $mime = 'image/webp';
    elseif (str_ends_with($lower, '.gif')) $mime = 'image/gif';
    elseif (str_ends_with($lower, '.heic')) $mime = 'image/heic';
    elseif (str_ends_with($lower, '.heif')) $mime = 'image/heif';
    elseif (str_ends_with($lower, '.bmp')) $mime = 'image/bmp';
    elseif (preg_match('/\.(jpe?g)$/', $lower)) $mime = 'image/jpeg';
    else $mime = 'image/jpeg';
}

$allowed = str_starts_with($mime, 'image/') || str_starts_with($mime, 'video/');
if (!$allowed) {
    json_response(['ok' => false, 'error' => 'Seules images et vidéos autorisées'], 422);
}

try {
    $uploaded = cloudinary_upload($file['tmp_name'], $mime, $originalName);
} catch (Throwable $e) {
    json_response(['ok' => false, 'error' => $e->getMessage()], 502);
}

$ins = db()->prepare(
    'INSERT INTO files
      (user_id, device_id, local_hash, original_name, mime_type, size_bytes, cloudinary_public_id, cloudinary_url, resource_type)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
);

try {
    $ins->execute([
        $userId,
        $deviceId,
        strtolower($localHash),
        $originalName,
        $mime,
        $uploaded['bytes'] ?: $size,
        $uploaded['public_id'],
        $uploaded['url'],
        $uploaded['resource_type'],
    ]);
} catch (PDOException $e) {
    if ((int) $e->getCode() === 23000) {
        $again = db()->prepare('SELECT id, cloudinary_url FROM files WHERE user_id = ? AND local_hash = ? LIMIT 1');
        $again->execute([$userId, strtolower($localHash)]);
        $row = $again->fetch();
        json_response([
            'ok' => true,
            'duplicate' => true,
            'file' => [
                'id' => (int) $row['id'],
                'url' => $row['cloudinary_url'],
            ],
        ]);
    }
    json_response(['ok' => false, 'error' => 'Erreur enregistrement'], 500);
}

json_response([
    'ok' => true,
    'duplicate' => false,
    'file' => [
        'id' => (int) db()->lastInsertId(),
        'original_name' => $originalName,
        'url' => $uploaded['url'],
        'resource_type' => $uploaded['resource_type'],
        'size_bytes' => $uploaded['bytes'] ?: $size,
    ],
]);
