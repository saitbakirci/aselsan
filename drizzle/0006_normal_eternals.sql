CREATE TABLE `visits` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`visit_date` text,
	`category` text DEFAULT 'Kurumsal' NOT NULL,
	`priority` text DEFAULT 'Orta' NOT NULL,
	`status` text DEFAULT 'Planlandı' NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_by` text DEFAULT '' NOT NULL,
	`updated_by` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_visits_status_date` ON `visits` (`status`,`visit_date`);--> statement-breakpoint
CREATE INDEX `idx_visits_sort` ON `visits` (`sort_order`);--> statement-breakpoint
ALTER TABLE `department_approvals` ADD `sort_order` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX `idx_department_approvals_sort` ON `department_approvals` (`sort_order`);--> statement-breakpoint
ALTER TABLE `tasks` ADD `workspace` text DEFAULT 'aselsan' NOT NULL;