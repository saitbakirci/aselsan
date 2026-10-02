CREATE TABLE `task_time_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`task_id` text NOT NULL,
	`work_date` text NOT NULL,
	`minutes` integer NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`entry_type` text DEFAULT 'Çalışma' NOT NULL,
	`created_by` text DEFAULT '' NOT NULL,
	`updated_by` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_task_time_task_date` ON `task_time_entries` (`task_id`,`work_date`);--> statement-breakpoint
CREATE INDEX `idx_task_time_date` ON `task_time_entries` (`work_date`);--> statement-breakpoint
ALTER TABLE `tasks` ADD `estimated_duration_days` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `tasks` ADD `tracking_cadence_days` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `tasks` ADD `estimated_effort_minutes` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `tasks` ADD `received_at` text;--> statement-breakpoint
ALTER TABLE `tasks` ADD `completed_at` text;--> statement-breakpoint
ALTER TABLE `tasks` ADD `effort_source` text DEFAULT 'Sistem Tahmini' NOT NULL;