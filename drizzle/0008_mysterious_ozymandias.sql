CREATE TABLE `fair_events` (
	`id` text PRIMARY KEY NOT NULL,
	`source` text DEFAULT 'Manuel' NOT NULL,
	`source_ref` text NOT NULL,
	`title` text NOT NULL,
	`country` text DEFAULT '' NOT NULL,
	`city` text DEFAULT '' NOT NULL,
	`event_year` integer NOT NULL,
	`event_month` integer,
	`start_date` text,
	`end_date` text,
	`date_note` text DEFAULT '' NOT NULL,
	`participation_status` text DEFAULT 'Değerlendirilecek' NOT NULL,
	`support_type` text DEFAULT 'Referans' NOT NULL,
	`scope_note` text DEFAULT '' NOT NULL,
	`planning_note` text DEFAULT '' NOT NULL,
	`is_deleted` integer DEFAULT false NOT NULL,
	`created_by` text DEFAULT '' NOT NULL,
	`updated_by` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_fair_events_source_ref` ON `fair_events` (`source_ref`);--> statement-breakpoint
CREATE INDEX `idx_fair_events_year_month` ON `fair_events` (`event_year`,`event_month`);--> statement-breakpoint
CREATE INDEX `idx_fair_events_deleted_date` ON `fair_events` (`is_deleted`,`start_date`);