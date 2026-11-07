<?php

function cloudinary_upload(string $tmpPath, string $mime, string $originalName): array
{
    $cfg = require __DIR__ . '/../config/env.php';
    $c = $cfg['cloudinary'];

    $resourceType = str_starts_with($mime, 'video/') ? 'video' : 'image';
    if (!str_starts_with($mime, 'image/') && !str_starts_with($mime, 'video/')) {
        $resourceType = 'raw';
    }

    $timestamp = time();
    $folder = $c['folder'] ?? 'merde_backup';
    $publicId = $folder . '/' . bin2hex(random_bytes(8));

    $paramsToSign = [
        'folder' => $folder,
        'public_id' => $publicId,
        'timestamp' => $timestamp,
    ];
    ksort($paramsToSign);
    $toSign = [];
    foreach ($paramsToSign as $k => $v) {
        $toSign[] = $k . '=' . $v;
    }
    $signature = sha1(implode('&', $toSign) . $c['api_secret']);

    $url = sprintf(
        'https://api.cloudinary.com/v1_1/%s/%s/upload',
        rawurlencode($c['cloud_name']),
        $resourceType
    );

    $post = [
        'file' => new CURLFile($tmpPath, $mime, $originalName),
        'api_key' => $c['api_key'],
        'timestamp' => $timestamp,
        'folder' => $folder,
        'public_id' => $publicId,
        'signature' => $signature,
    ];

    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => $post,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 120,
    ]);
    $raw = curl_exec($ch);
    $err = curl_error($ch);
    $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($raw === false) {
        throw new RuntimeException('Cloudinary: ' . $err);
    }

    $data = json_decode($raw, true);
    if ($code >= 400 || !is_array($data) || empty($data['secure_url'])) {
        $msg = is_array($data) ? ($data['error']['message'] ?? $raw) : $raw;
        throw new RuntimeException('Cloudinary upload échoué: ' . $msg);
    }

    return [
        'public_id' => $data['public_id'],
        'url' => $data['secure_url'],
        'resource_type' => $data['resource_type'] ?? $resourceType,
        'bytes' => (int) ($data['bytes'] ?? 0),
    ];
}

/**
 * Supprime un fichier sur Cloudinary (best-effort).
 */
function cloudinary_delete(string $publicId, string $resourceType = 'image'): bool
{
    if ($publicId === '') {
        return false;
    }

    $cfg = require __DIR__ . '/../config/env.php';
    $c = $cfg['cloudinary'];
    $type = $resourceType ?: 'image';
    if (!in_array($type, ['image', 'video', 'raw'], true)) {
        $type = 'image';
    }

    $timestamp = time();
    $paramsToSign = [
        'public_id' => $publicId,
        'timestamp' => $timestamp,
    ];
    ksort($paramsToSign);
    $toSign = [];
    foreach ($paramsToSign as $k => $v) {
        $toSign[] = $k . '=' . $v;
    }
    $signature = sha1(implode('&', $toSign) . $c['api_secret']);

    $url = sprintf(
        'https://api.cloudinary.com/v1_1/%s/%s/destroy',
        rawurlencode($c['cloud_name']),
        $type
    );

    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => [
            'public_id' => $publicId,
            'api_key' => $c['api_key'],
            'timestamp' => $timestamp,
            'signature' => $signature,
        ],
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 30,
    ]);
    $raw = curl_exec($ch);
    $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($raw === false || $code >= 400) {
        return false;
    }
    $data = json_decode($raw, true);
    return is_array($data) && (($data['result'] ?? '') === 'ok' || ($data['result'] ?? '') === 'not found');
}
