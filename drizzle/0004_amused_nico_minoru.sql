CREATE TABLE `task_attachments` (
	`id` text PRIMARY KEY NOT NULL,
	`task_id` text NOT NULL,
	`storage_key` text NOT NULL,
	`file_name` text NOT NULL,
	`content_type` text DEFAULT 'application/octet-stream' NOT NULL,
	`size_bytes` integer DEFAULT 0 NOT NULL,
	`is_image` integer DEFAULT false NOT NULL,
	`is_featured` integer DEFAULT false NOT NULL,
	`uploaded_by` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_task_attachments_storage_key` ON `task_attachments` (`storage_key`);--> statement-breakpoint
CREATE INDEX `idx_task_attachments_task_date` ON `task_attachments` (`task_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `task_history_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`task_id` text NOT NULL,
	`event_type` text DEFAULT 'Güvenlik Kopyası' NOT NULL,
	`snapshot_json` text NOT NULL,
	`changed_by` text DEFAULT '' NOT NULL,
	`source_ref` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_task_history_task_date` ON `task_history_entries` (`task_id`,`created_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_task_history_source_ref` ON `task_history_entries` (`source_ref`);