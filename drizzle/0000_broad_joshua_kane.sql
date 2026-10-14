CREATE TABLE `curio_types` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`name` text NOT NULL,
	`json_schema` text NOT NULL,
	`public_field_keys` text DEFAULT '[]' NOT NULL,
	`extraction_prompt` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `global_entities` (
	`id` text PRIMARY KEY NOT NULL,
	`parent_entity_id` text,
	`url_hash` text NOT NULL,
	`entity_key` text NOT NULL,
	`canonical_url` text NOT NULL,
	`core_type` text NOT NULL,
	`title` text NOT NULL,
	`summary` text,
	`hero_image_url` text,
	`core_structured_data` text NOT NULL,
	`extended_attributes` text DEFAULT '{}' NOT NULL,
	`ucp_sku_id` text,
	`price_cents` integer,
	`currency` text DEFAULT 'USD',
	`price_verified_at` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_global_entities_entity_key` ON `global_entities` (`entity_key`);--> statement-breakpoint
CREATE INDEX `idx_global_entities_url_hash` ON `global_entities` (`url_hash`);--> statement-breakpoint
CREATE INDEX `idx_global_entities_parent_id` ON `global_entities` (`parent_entity_id`);--> statement-breakpoint
CREATE INDEX `idx_global_entities_price_cents` ON `global_entities` (`price_cents`);--> statement-breakpoint
CREATE TABLE `list_items` (
	`id` text PRIMARY KEY NOT NULL,
	`list_id` text NOT NULL,
	`save_id` text NOT NULL,
	`position_index` integer DEFAULT 0 NOT NULL,
	`section_header` text,
	`curator_note` text,
	`is_pinned` integer DEFAULT false NOT NULL,
	`added_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`list_id`) REFERENCES `smart_lists`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`save_id`) REFERENCES `user_saves`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_list_items_list_order` ON `list_items` (`list_id`,`position_index`);--> statement-breakpoint
CREATE TABLE `smart_lists` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`title` text NOT NULL,
	`slug` text NOT NULL,
	`description` text,
	`is_paywalled` integer DEFAULT false NOT NULL,
	`access_price_cents` integer,
	`auto_rules` text,
	`external_sync_target` text DEFAULT 'NONE',
	`visibility` text DEFAULT 'PRIVATE' NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `user_saves` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`entity_id` text,
	`custom_type_id` text,
	`is_private_memo` integer DEFAULT false NOT NULL,
	`private_title` text,
	`personal_notes` text,
	`user_custom_values` text DEFAULT '{}',
	`candidate_fallbacks` text DEFAULT '[]',
	`auto_tags` text DEFAULT '[]',
	`has_converted_purchase` integer DEFAULT false NOT NULL,
	`enrichment_status` text DEFAULT 'ENRICHED' NOT NULL,
	`visibility` text DEFAULT 'PRIVATE' NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`entity_id`) REFERENCES `global_entities`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`custom_type_id`) REFERENCES `curio_types`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_user_saves_user_id` ON `user_saves` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_user_saves_entity_id` ON `user_saves` (`entity_id`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`username` text NOT NULL,
	`display_name` text,
	`avatar_url` text,
	`is_pro` integer DEFAULT false NOT NULL,
	`ai_credits_remaining` integer DEFAULT 25 NOT NULL,
	`ai_credits_reset_at` text,
	`custom_domain` text,
	`affiliate_tags` text,
	`google_sync_tokens` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_unique` ON `users` (`username`);