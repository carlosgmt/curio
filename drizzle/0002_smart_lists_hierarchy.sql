CREATE TABLE `audit_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`operator_user_id` text NOT NULL,
	`action` text NOT NULL,
	`target_entity_id` text,
	`metadata` text,
	`ip_address` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`operator_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_audit_logs_operator` ON `audit_logs` (`operator_user_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `background_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`queue_name` text NOT NULL,
	`payload` text NOT NULL,
	`status` text DEFAULT 'QUEUED' NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`max_attempts` integer DEFAULT 3 NOT NULL,
	`last_error` text,
	`scheduled_at` text DEFAULT (datetime('now')) NOT NULL,
	`locked_at` text,
	`completed_at` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_jobs_queue_status` ON `background_jobs` (`queue_name`,`status`,`scheduled_at`);--> statement-breakpoint
CREATE TABLE `checkout_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`board_id` text,
	`curator_id` text NOT NULL,
	`buyer_user_id` text,
	`total_cents` integer NOT NULL,
	`currency` text DEFAULT 'USD' NOT NULL,
	`status` text DEFAULT 'READY' NOT NULL,
	`ucp_line_items` text NOT NULL,
	`affiliate_items` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`expires_at` text NOT NULL,
	FOREIGN KEY (`board_id`) REFERENCES `smart_lists`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`curator_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`buyer_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_checkout_sessions_curator` ON `checkout_sessions` (`curator_id`);--> statement-breakpoint
CREATE INDEX `idx_checkout_sessions_board` ON `checkout_sessions` (`board_id`);--> statement-breakpoint
CREATE INDEX `idx_checkout_sessions_expires` ON `checkout_sessions` (`expires_at`);--> statement-breakpoint
CREATE TABLE `entity_price_history` (
	`id` text PRIMARY KEY NOT NULL,
	`entity_id` text NOT NULL,
	`source_id` text,
	`seller_name` text NOT NULL,
	`price_cents` integer NOT NULL,
	`currency` text DEFAULT 'USD' NOT NULL,
	`in_stock` integer DEFAULT true NOT NULL,
	`recorded_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`entity_id`) REFERENCES `global_entities`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`source_id`) REFERENCES `entity_sources`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_price_history_entity` ON `entity_price_history` (`entity_id`,`recorded_at`);--> statement-breakpoint
CREATE TABLE `entity_sources` (
	`id` text PRIMARY KEY NOT NULL,
	`entity_id` text NOT NULL,
	`seller_name` text NOT NULL,
	`source_url` text NOT NULL,
	`url_hash` text NOT NULL,
	`price_cents` integer,
	`currency` text DEFAULT 'USD',
	`affiliate_template` text,
	`in_stock` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`entity_id`) REFERENCES `global_entities`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_entity_sources_entity_id` ON `entity_sources` (`entity_id`);--> statement-breakpoint
CREATE INDEX `idx_entity_sources_url_hash` ON `entity_sources` (`url_hash`);--> statement-breakpoint
CREATE TABLE `user_accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`provider` text NOT NULL,
	`provider_account_id` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_user_accounts_user_id` ON `user_accounts` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_user_accounts_provider_account` ON `user_accounts` (`provider`,`provider_account_id`);--> statement-breakpoint
CREATE TABLE `user_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`token` text NOT NULL,
	`expires_at` text NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_sessions_token_unique` ON `user_sessions` (`token`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_user_sessions_token` ON `user_sessions` (`token`);--> statement-breakpoint
CREATE INDEX `idx_user_sessions_user_id` ON `user_sessions` (`user_id`);--> statement-breakpoint
ALTER TABLE `curio_types` ADD `parent_type_id` text;--> statement-breakpoint
ALTER TABLE `curio_types` ADD `type_path` text NOT NULL;--> statement-breakpoint
ALTER TABLE `curio_types` ADD `root_archetype` text NOT NULL;--> statement-breakpoint
ALTER TABLE `curio_types` ADD `default_silhouette` text NOT NULL;--> statement-breakpoint
ALTER TABLE `curio_types` ADD `identity_rules` text;--> statement-breakpoint
ALTER TABLE `curio_types` ADD `type_embedding` F32_BLOB(768);--> statement-breakpoint
ALTER TABLE `curio_types` ADD `localized_aliases` text DEFAULT '{}';--> statement-breakpoint
ALTER TABLE `curio_types` ADD `own_json_schema` text DEFAULT '{}';--> statement-breakpoint
ALTER TABLE `curio_types` ADD `effective_json_schema` text DEFAULT '{}';--> statement-breakpoint
ALTER TABLE `curio_types` ADD `ui_field_config` text DEFAULT '[]';--> statement-breakpoint
CREATE UNIQUE INDEX `curio_types_type_path_unique` ON `curio_types` (`type_path`);--> statement-breakpoint
CREATE INDEX `idx_curio_types_parent` ON `curio_types` (`parent_type_id`);--> statement-breakpoint
CREATE INDEX `idx_curio_types_path` ON `curio_types` (`type_path`);--> statement-breakpoint
ALTER TABLE `entry_connections` ADD `weight` real DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `entry_connections` ADD `confidence` real DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `entry_connections` ADD `is_bidirectional` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `entry_connections` ADD `metadata` text DEFAULT '{}';--> statement-breakpoint
ALTER TABLE `global_entities` ADD `canonical_external_id` text;--> statement-breakpoint
ALTER TABLE `global_entities` ADD `identity_fingerprint` text;--> statement-breakpoint
ALTER TABLE `global_entities` ADD `brand_or_creator` text;--> statement-breakpoint
ALTER TABLE `global_entities` ADD `type_path` text;--> statement-breakpoint
ALTER TABLE `global_entities` ADD `best_price_cents` integer;--> statement-breakpoint
ALTER TABLE `global_entities` ADD `embedding` F32_BLOB(768);--> statement-breakpoint
CREATE INDEX `idx_global_entities_canonical_ext` ON `global_entities` (`canonical_external_id`);--> statement-breakpoint
CREATE INDEX `idx_global_entities_type_path` ON `global_entities` (`type_path`);--> statement-breakpoint
CREATE INDEX `idx_global_entities_title` ON `global_entities` (`title`);--> statement-breakpoint
ALTER TABLE `smart_lists` ADD `parent_id` text REFERENCES smart_lists(id);--> statement-breakpoint
ALTER TABLE `smart_lists` ADD `position_index` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX `idx_smart_lists_parent` ON `smart_lists` (`parent_id`,`position_index`);--> statement-breakpoint
CREATE INDEX `idx_smart_lists_user` ON `smart_lists` (`user_id`);--> statement-breakpoint
ALTER TABLE `user_saves` ADD `type_id` text REFERENCES curio_types(id);--> statement-breakpoint
ALTER TABLE `user_saves` ADD `type_path` text;--> statement-breakpoint
ALTER TABLE `user_saves` ADD `preferred_source_id` text REFERENCES entity_sources(id);--> statement-breakpoint
ALTER TABLE `user_saves` ADD `wishlist` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `user_saves` ADD `private_embedding` F32_BLOB(768);--> statement-breakpoint
CREATE INDEX `idx_user_saves_type_path` ON `user_saves` (`type_path`);--> statement-breakpoint
CREATE INDEX `idx_user_saves_private_title` ON `user_saves` (`private_title`);--> statement-breakpoint
ALTER TABLE `users` ADD `password_hash` text;--> statement-breakpoint
ALTER TABLE `users` ADD `onboarding_completed` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `is_admin` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `taste_vector` F32_BLOB(768);