-- À exécuter si la base existe déjà (sans recréer le schéma)
USE merde_backup;

ALTER TABLE users
  ADD COLUMN upload_batch_limit INT UNSIGNED NOT NULL DEFAULT 20
  AFTER password_hash;
