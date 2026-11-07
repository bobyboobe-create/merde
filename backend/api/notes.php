<?php

require_once __DIR__ . '/../tools/response.php';
require_once __DIR__ . '/../tools/auth.php';

cors_headers();

$user = require_user();
$userId = (int) $user['user_id'];

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $stmt = db()->prepare(
        'SELECT id, title, body, created_at, updated_at
         FROM user_notes
         WHERE user_id = ?
         ORDER BY id DESC'
    );
    $stmt->execute([$userId]);
    json_response(['ok' => true, 'notes' => $stmt->fetchAll()]);
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $body = read_json_body();
    $title = trim((string) ($body['title'] ?? ''));
    $text = trim((string) ($body['body'] ?? ''));
    if ($text === '') {
        json_response(['ok' => false, 'error' => 'body requis'], 422);
    }
    db()->prepare(
        'INSERT INTO user_notes (user_id, title, body) VALUES (?, ?, ?)'
    )->execute([$userId, $title, $text]);
    json_response([
        'ok' => true,
        'note' => [
            'id' => (int) db()->lastInsertId(),
            'title' => $title,
            'body' => $text,
        ],
    ]);
}

if ($_SERVER['REQUEST_METHOD'] === 'DELETE') {
    $body = read_json_body();
    $id = (int) ($body['id'] ?? ($_GET['id'] ?? 0));
    if ($id <= 0) {
        json_response(['ok' => false, 'error' => 'id requis'], 422);
    }
    $stmt = db()->prepare('DELETE FROM user_notes WHERE id = ? AND user_id = ?');
    $stmt->execute([$id, $userId]);
    json_response(['ok' => true, 'deleted' => $stmt->rowCount() > 0]);
}

json_response(['ok' => false, 'error' => 'Méthode non autorisée'], 405);
