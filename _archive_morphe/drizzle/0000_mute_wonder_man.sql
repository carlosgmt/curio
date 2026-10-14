CREATE TABLE `attachments` (
	`id` text PRIMARY KEY NOT NULL,
	`card_id` text NOT NULL,
	`filename` text NOT NULL,
	`mime_type` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`ai_caption` text,
	`path` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`card_id`) REFERENCES `cards`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_attachments_card` ON `attachments` (`card_id`);--> statement-breakpoint
CREATE TABLE `card_events` (
	`id` text PRIMARY KEY NOT NULL,
	`card_id` text NOT NULL,
	`actor` text DEFAULT 'user' NOT NULL,
	`action` text NOT NULL,
	`diff` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`card_id`) REFERENCES `cards`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_events_card` ON `card_events` (`card_id`);--> statement-breakpoint
CREATE TABLE `cards` (
	`id` text PRIMARY KEY NOT NULL,
	`list_id` text DEFAULT 'inbox' NOT NULL,
	`intent` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`title` text NOT NULL,
	`raw_text` text NOT NULL,
	`data` text DEFAULT '{}' NOT NULL,
	`tags` text DEFAULT '[]' NOT NULL,
	`due_at` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	`archived_at` text,
	FOREIGN KEY (`list_id`) REFERENCES `lists`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_cards_intent` ON `cards` (`intent`);--> statement-breakpoint
CREATE INDEX `idx_cards_status` ON `cards` (`status`);--> statement-breakpoint
CREATE INDEX `idx_cards_list` ON `cards` (`list_id`);--> statement-breakpoint
CREATE INDEX `idx_cards_created` ON `cards` (`created_at`);--> statement-breakpoint
CREATE TABLE `list_rules` (
	`id` text PRIMARY KEY NOT NULL,
	`list_id` text NOT NULL,
	`intent` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`list_id`) REFERENCES `lists`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `list_rules_intent_unique` ON `list_rules` (`intent`);--> statement-breakpoint
CREATE TABLE `lists` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`icon` text,
	`color` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`is_default` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `lists_name_unique` ON `lists` (`name`);