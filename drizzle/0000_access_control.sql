CREATE TABLE `audit_events` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`occurred_at` datetime(3) NOT NULL,
	`request_id` char(26) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
	`actor_type` enum('user','system','cli') NOT NULL,
	`actor_user_id` char(26) CHARACTER SET ascii COLLATE ascii_bin,
	`actor_label` varchar(200),
	`actor_roles` varchar(100),
	`session_id` char(26) CHARACTER SET ascii COLLATE ascii_bin,
	`ip` varchar(45),
	`action` varchar(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
	`entity_type` varchar(32) CHARACTER SET ascii COLLATE ascii_bin,
	`entity_id` varchar(64),
	`entity_label` varchar(255),
	`outcome` enum('success','denied','failed') NOT NULL,
	`summary` varchar(500) NOT NULL,
	`before_revision_id` char(26) CHARACTER SET ascii COLLATE ascii_bin,
	`after_revision_id` char(26) CHARACTER SET ascii COLLATE ascii_bin,
	`changes` json,
	`prev_hash` binary(32),
	`hash` binary(32),
	CONSTRAINT `audit_events_id` PRIMARY KEY(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_520_ci;
--> statement-breakpoint
CREATE TABLE `auth_tokens` (
	`id` char(26) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
	`user_id` char(26) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
	`purpose` enum('password_reset','invitation','email_change','owner_setup') NOT NULL,
	`token_hash` binary(32) NOT NULL,
	`new_email` varchar(254),
	`expires_at` datetime(3) NOT NULL,
	`used_at` datetime(3),
	`created_at` datetime(3) NOT NULL,
	`created_by` char(26) CHARACTER SET ascii COLLATE ascii_bin,
	`created_ip` varchar(45),
	CONSTRAINT `auth_tokens_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_auth_tokens_token` UNIQUE(`token_hash`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_520_ci;
--> statement-breakpoint
CREATE TABLE `locales` (
	`code` varchar(10) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
	`name` varchar(60) NOT NULL,
	`native_name` varchar(60) NOT NULL,
	`direction` enum('ltr','rtl') NOT NULL,
	`html_lang` varchar(16) NOT NULL,
	`og_locale` varchar(16) NOT NULL,
	`is_default` boolean NOT NULL,
	`is_enabled` boolean NOT NULL,
	`is_required` boolean NOT NULL,
	`sort_order` smallint NOT NULL,
	CONSTRAINT `locales_code` PRIMARY KEY(`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_520_ci;
--> statement-breakpoint
CREATE TABLE `login_attempts` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`attempted_at` datetime(3) NOT NULL,
	`email_hash` binary(32) NOT NULL,
	`user_id` char(26) CHARACTER SET ascii COLLATE ascii_bin,
	`ip` varchar(45),
	`succeeded` boolean NOT NULL,
	`failure_reason` enum('bad_credentials','locked','disabled','mfa_failed','rate_limited'),
	`user_agent` varchar(255),
	CONSTRAINT `login_attempts_id` PRIMARY KEY(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_520_ci;
--> statement-breakpoint
CREATE TABLE `permissions` (
	`key` varchar(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
	`resource` varchar(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
	`action` varchar(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
	`description` varchar(300) NOT NULL,
	`is_sensitive` boolean NOT NULL,
	CONSTRAINT `permissions_key` PRIMARY KEY(`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_520_ci;
--> statement-breakpoint
CREATE TABLE `rate_limits` (
	`key_hash` binary(32) NOT NULL,
	`window_start` datetime(3) NOT NULL,
	`count` int unsigned NOT NULL,
	`expires_at` datetime(3) NOT NULL,
	CONSTRAINT `rate_limits_key_hash_window_start_pk` PRIMARY KEY(`key_hash`,`window_start`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_520_ci;
--> statement-breakpoint
CREATE TABLE `role_permissions` (
	`role_key` varchar(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
	`permission_key` varchar(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
	CONSTRAINT `role_permissions_role_key_permission_key_pk` PRIMARY KEY(`role_key`,`permission_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_520_ci;
--> statement-breakpoint
CREATE TABLE `roles` (
	`key` varchar(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
	`name` varchar(60) NOT NULL,
	`description` varchar(300),
	`rank` smallint NOT NULL,
	`is_system` boolean NOT NULL,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`created_by` char(26) CHARACTER SET ascii COLLATE ascii_bin,
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_by` char(26) CHARACTER SET ascii COLLATE ascii_bin,
	CONSTRAINT `roles_key` PRIMARY KEY(`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_520_ci;
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` char(26) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
	`user_id` char(26) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
	`token_hash` binary(32) NOT NULL,
	`created_at` datetime(3) NOT NULL,
	`last_seen_at` datetime(3) NOT NULL,
	`idle_expires_at` datetime(3) NOT NULL,
	`absolute_expires_at` datetime(3) NOT NULL,
	`reauthenticated_at` datetime(3) NOT NULL,
	`mfa_verified_at` datetime(3),
	`ip` varchar(45),
	`user_agent` varchar(255),
	`revoked_at` datetime(3),
	`revoked_reason` enum('logout','revoked','password_changed','role_changed','user_disabled','rotated','restore'),
	`replaced_by_id` char(26) CHARACTER SET ascii COLLATE ascii_bin,
	CONSTRAINT `sessions_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_sessions_token` UNIQUE(`token_hash`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_520_ci;
--> statement-breakpoint
CREATE TABLE `user_mfa` (
	`user_id` char(26) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
	`totp_secret_enc` varbinary(255) NOT NULL,
	`key_version` tinyint unsigned NOT NULL,
	`confirmed_at` datetime(3),
	`last_used_step` bigint unsigned,
	`created_at` datetime(3) NOT NULL,
	CONSTRAINT `user_mfa_user_id` PRIMARY KEY(`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_520_ci;
--> statement-breakpoint
CREATE TABLE `user_recovery_codes` (
	`id` char(26) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
	`user_id` char(26) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
	`code_hash` binary(32) NOT NULL,
	`used_at` datetime(3),
	`created_at` datetime(3) NOT NULL,
	CONSTRAINT `user_recovery_codes_id` PRIMARY KEY(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_520_ci;
--> statement-breakpoint
CREATE TABLE `user_roles` (
	`user_id` char(26) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
	`role_key` varchar(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
	`granted_by` char(26) CHARACTER SET ascii COLLATE ascii_bin,
	`granted_at` datetime(3) NOT NULL,
	CONSTRAINT `user_roles_user_id_role_key_pk` PRIMARY KEY(`user_id`,`role_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_520_ci;
--> statement-breakpoint
CREATE TABLE `users` (
	`id` char(26) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
	`email` varchar(254) NOT NULL,
	`email_normalized` varchar(254) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
	`display_name` varchar(120) NOT NULL,
	`status` enum('invited','active','disabled') NOT NULL,
	`password_hash` varchar(255),
	`password_changed_at` datetime(3),
	`failed_login_count` smallint unsigned NOT NULL DEFAULT 0,
	`locked_until` datetime(3),
	`last_login_at` datetime(3),
	`admin_locale` varchar(10) CHARACTER SET ascii COLLATE ascii_bin,
	`disabled_at` datetime(3),
	`disabled_by` char(26) CHARACTER SET ascii COLLATE ascii_bin,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`created_by` char(26) CHARACTER SET ascii COLLATE ascii_bin,
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_by` char(26) CHARACTER SET ascii COLLATE ascii_bin,
	`deleted_at` datetime(3),
	`deleted_by` char(26) CHARACTER SET ascii COLLATE ascii_bin,
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_users_email` UNIQUE(`email_normalized`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_520_ci;
--> statement-breakpoint
ALTER TABLE `auth_tokens` ADD CONSTRAINT `fk_auth_tokens_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `auth_tokens` ADD CONSTRAINT `fk_auth_tokens_created_by` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `login_attempts` ADD CONSTRAINT `fk_login_attempts_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `role_permissions` ADD CONSTRAINT `fk_rp_role` FOREIGN KEY (`role_key`) REFERENCES `roles`(`key`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `role_permissions` ADD CONSTRAINT `fk_rp_permission` FOREIGN KEY (`permission_key`) REFERENCES `permissions`(`key`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `roles` ADD CONSTRAINT `fk_roles_created_by` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `roles` ADD CONSTRAINT `fk_roles_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sessions` ADD CONSTRAINT `fk_sessions_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `user_mfa` ADD CONSTRAINT `fk_user_mfa_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `user_recovery_codes` ADD CONSTRAINT `fk_recovery_codes_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `user_roles` ADD CONSTRAINT `fk_ur_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `user_roles` ADD CONSTRAINT `fk_ur_role` FOREIGN KEY (`role_key`) REFERENCES `roles`(`key`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `user_roles` ADD CONSTRAINT `fk_ur_granted_by` FOREIGN KEY (`granted_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `users` ADD CONSTRAINT `fk_users_locale` FOREIGN KEY (`admin_locale`) REFERENCES `locales`(`code`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `users` ADD CONSTRAINT `fk_users_disabled_by` FOREIGN KEY (`disabled_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `users` ADD CONSTRAINT `fk_users_created_by` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `users` ADD CONSTRAINT `fk_users_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `users` ADD CONSTRAINT `fk_users_deleted_by` FOREIGN KEY (`deleted_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `ix_audit_time` ON `audit_events` (`occurred_at`);--> statement-breakpoint
CREATE INDEX `ix_audit_entity` ON `audit_events` (`entity_type`,`entity_id`,`occurred_at`);--> statement-breakpoint
CREATE INDEX `ix_audit_actor` ON `audit_events` (`actor_user_id`,`occurred_at`);--> statement-breakpoint
CREATE INDEX `ix_audit_action` ON `audit_events` (`action`,`occurred_at`);--> statement-breakpoint
CREATE INDEX `ix_audit_request` ON `audit_events` (`request_id`);--> statement-breakpoint
CREATE INDEX `ix_auth_tokens_user` ON `auth_tokens` (`user_id`,`purpose`,`used_at`);--> statement-breakpoint
CREATE INDEX `ix_auth_tokens_expiry` ON `auth_tokens` (`expires_at`);--> statement-breakpoint
CREATE INDEX `ix_login_attempts_email` ON `login_attempts` (`email_hash`,`attempted_at`);--> statement-breakpoint
CREATE INDEX `ix_login_attempts_ip` ON `login_attempts` (`ip`,`attempted_at`);--> statement-breakpoint
CREATE INDEX `ix_login_attempts_time` ON `login_attempts` (`attempted_at`);--> statement-breakpoint
CREATE INDEX `ix_rate_limits_expiry` ON `rate_limits` (`expires_at`);--> statement-breakpoint
CREATE INDEX `ix_role_permissions_permission` ON `role_permissions` (`permission_key`);--> statement-breakpoint
CREATE INDEX `ix_sessions_user` ON `sessions` (`user_id`,`revoked_at`);--> statement-breakpoint
CREATE INDEX `ix_sessions_expiry` ON `sessions` (`absolute_expires_at`);--> statement-breakpoint
CREATE INDEX `ix_recovery_codes_user` ON `user_recovery_codes` (`user_id`);--> statement-breakpoint
CREATE INDEX `ix_user_roles_role` ON `user_roles` (`role_key`);--> statement-breakpoint
CREATE INDEX `ix_users_status` ON `users` (`status`);--> statement-breakpoint
CREATE INDEX `ix_users_deleted` ON `users` (`deleted_at`);