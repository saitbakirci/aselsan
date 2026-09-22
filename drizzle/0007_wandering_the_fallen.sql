CREATE TABLE `meeting_transcript_segments` (
	`id` text PRIMARY KEY NOT NULL,
	`meeting_id` text NOT NULL,
	`sequence` integer NOT NULL,
	`elapsed_seconds` integer DEFAULT 0 NOT NULL,
	`captured_at` text NOT NULL,
	`text` text NOT NULL,
	`confidence_pct` integer,
	`clarity` text DEFAULT 'Net' NOT NULL,
	`source` text DEFAULT 'Canlı Mikrofon' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`meeting_id`) REFERENCES `meetings`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_meeting_transcript_sequence` ON `meeting_transcript_segments` (`meeting_id`,`sequence`);--> statement-breakpoint
CREATE INDEX `idx_meeting_transcript_meeting_time` ON `meeting_transcript_segments` (`meeting_id`,`elapsed_seconds`);--> statement-breakpoint
ALTER TABLE `meetings` ADD `capture_status` text DEFAULT 'Hazır' NOT NULL;--> statement-breakpoint
ALTER TABLE `meetings` ADD `capture_started_at` text;--> statement-breakpoint
ALTER TABLE `meetings` ADD `capture_ended_at` text;