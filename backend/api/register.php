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
$confirm = (string) ($body['password_confirm'] ?? '');

if ($username === '' || strlen($username) < 3) {
    json_response(['ok' => false, 'error' => 'Nom d’utilisateur trop court'], 422);
}
if (strlen($password) < 6) {
    json_response(['ok' => false, 'error' => 'Mot de passe trop court (min 6)'], 422);
}
if ($password !== $confirm) {
    json_response(['ok' => false, 'error' => 'Les mots de passe ne correspondent pas'], 422);
}

$hash = password_hash($password, PASSWORD_DEFAULT);

try {
    $stmt = db()->prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)');
    $stmt->execute([$username, $hash]);
    $userId = (int) db()->lastInsertId();
} catch (PDOException $e) {
    if ((int) $e->getCode() === 23000) {
        json_response(['ok' => false, 'error' => 'Nom d’utilisateur déjà pris'], 409);
    }
    json_response(['ok' => false, 'error' => 'Erreur base de données'], 500);
}

$session = create_session($userId);
json_response([
    'ok' => true,
    'user' => ['id' => $userId, 'username' => $username],
    'token' => $session['token'],
    'expires_at' => $session['expires_at'],
]);
