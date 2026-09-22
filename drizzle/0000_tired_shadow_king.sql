CREATE TABLE `tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`category` text DEFAULT '' NOT NULL,
	`priority` text DEFAULT 'Orta' NOT NULL,
	`status` text DEFAULT 'Başlamadı' NOT NULL,
	`due_date` text,
	`owner` text DEFAULT '' NOT NULL,
	`next_action` text DEFAULT '' NOT NULL,
	`decision` text DEFAULT '' NOT NULL,
	`follow_up_date` text,
	`management_agenda` integer DEFAULT false NOT NULL,
	`risk` text DEFAULT '' NOT NULL,
	`updated_by` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
