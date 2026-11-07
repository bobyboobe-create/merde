-- À exécuter si la base existe déjà
USE merde_backup;

ALTER TABLE users
  ADD COLUMN apk_enabled TINYINT(1) NOT NULL DEFAULT 1
  AFTER upload_batch_limit;
