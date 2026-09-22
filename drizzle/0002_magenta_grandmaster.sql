CREATE TABLE `task_memory_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`task_id` text NOT NULL,
	`kind` text DEFAULT 'İlerleme' NOT NULL,
	`title` text NOT NULL,
	`detail` text DEFAULT '' NOT NULL,
	`event_date` text NOT NULL,
	`document_name` text,
	`document_version` text,
	`document_url` text,
	`is_current` integer DEFAULT false NOT NULL,
	`source` text DEFAULT 'Manuel' NOT NULL,
	`source_ref` text,
	`updated_by` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_task_memory_task_date` ON `task_memory_entries` (`task_id`,`event_date`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_task_memory_source_ref` ON `task_memory_entries` (`source_ref`);--> statement-breakpoint
ALTER TABLE `tasks` ADD `task_type` text DEFAULT 'goal' NOT NULL;--> statement-breakpoint
ALTER TABLE `tasks` ADD `parent_goal_id` text;--> statement-breakpoint
ALTER TABLE `tasks` ADD `sort_order` integer DEFAULT 0 NOT NULL;