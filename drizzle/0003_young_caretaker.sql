CREATE TABLE `meeting_items` (
	`id` text PRIMARY KEY NOT NULL,
	`meeting_id` text NOT NULL,
	`task_id` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`task_title` text NOT NULL,
	`snapshot_json` text NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`meeting_id`) REFERENCES `meetings`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_meeting_items_meeting_order` ON `meeting_items` (`meeting_id`,`sort_order`);--> statement-breakpoint
CREATE INDEX `idx_meeting_items_task` ON `meeting_items` (`task_id`);--> statement-breakpoint
CREATE TABLE `meetings` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`meeting_date` text NOT NULL,
	`status` text DEFAULT 'Aktif' NOT NULL,
	`general_notes` text DEFAULT '' NOT NULL,
	`selected_task_count` integer DEFAULT 0 NOT NULL,
	`created_by` text DEFAULT '' NOT NULL,
	`updated_by` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_meetings_date` ON `meetings` (`meeting_date`,`updated_at`);--> statement-breakpoint
CREATE INDEX `idx_tasks_parent_goal` ON `tasks` (`parent_goal_id`);