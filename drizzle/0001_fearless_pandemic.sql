CREATE TABLE `entry_connections` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`source_save_id` text NOT NULL,
	`target_save_id` text NOT NULL,
	`connection_type` text NOT NULL,
	`context_note` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`source_save_id`) REFERENCES `user_saves`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`target_save_id`) REFERENCES `user_saves`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_entry_connections_user` ON `entry_connections` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_entry_connections_pair` ON `entry_connections` (`source_save_id`,`target_save_id`);