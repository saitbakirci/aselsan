CREATE TABLE `department_approvals` (
	`id` text PRIMARY KEY NOT NULL,
	`request_type` text DEFAULT 'Ekipman / Teknoloji' NOT NULL,
	`title` text NOT NULL,
	`justification` text NOT NULL,
	`priority` text DEFAULT 'Orta' NOT NULL,
	`status` text DEFAULT 'Taslak' NOT NULL,
	`needed_by` text,
	`estimated_budget` text DEFAULT '' NOT NULL,
	`next_action` text DEFAULT '' NOT NULL,
	`decision_note` text DEFAULT '' NOT NULL,
	`submitted_at` text,
	`decision_at` text,
	`created_by` text DEFAULT '' NOT NULL,
	`updated_by` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_department_approvals_status_needed` ON `department_approvals` (`status`,`needed_by`);--> statement-breakpoint
CREATE INDEX `idx_department_approvals_updated` ON `department_approvals` (`updated_at`);