import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const tasks = sqliteTable("tasks", {
  id: text("id").primaryKey(),
  workspace: text("workspace").notNull().default("aselsan"),
  taskType: text("task_type").notNull().default("goal"),
  parentGoalId: text("parent_goal_id"),
  sortOrder: integer("sort_order").notNull().default(0),
  title: text("title").notNull(),
  category: text("category").notNull().default(""),
  priority: text("priority").notNull().default("Orta"),
  status: text("status").notNull().default("Başlamadı"),
  dueDate: text("due_date"),
  owner: text("owner").notNull().default(""),
  nextAction: text("next_action").notNull().default(""),
  decision: text("decision").notNull().default(""),
  followUpDate: text("follow_up_date"),
  managementAgenda: integer("management_agenda", { mode: "boolean" })
    .notNull()
    .default(false),
  risk: text("risk").notNull().default(""),
  updatedBy: text("updated_by").notNull().default(""),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index("idx_tasks_parent_goal").on(table.parentGoalId),
]);

export const taskMemoryEntries = sqliteTable("task_memory_entries", {
  id: text("id").primaryKey(),
  taskId: text("task_id")
    .notNull()
    .references(() => tasks.id, { onDelete: "cascade" }),
  kind: text("kind").notNull().default("İlerleme"),
  title: text("title").notNull(),
  detail: text("detail").notNull().default(""),
  eventDate: text("event_date").notNull(),
  documentName: text("document_name"),
  documentVersion: text("document_version"),
  documentUrl: text("document_url"),
  isCurrent: integer("is_current", { mode: "boolean" }).notNull().default(false),
  source: text("source").notNull().default("Manuel"),
  sourceRef: text("source_ref"),
  updatedBy: text("updated_by").notNull().default(""),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index("idx_task_memory_task_date").on(table.taskId, table.eventDate),
  uniqueIndex("idx_task_memory_source_ref").on(table.sourceRef),
]);

export const meetings = sqliteTable("meetings", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  meetingDate: text("meeting_date").notNull(),
  status: text("status").notNull().default("Aktif"),
  captureStatus: text("capture_status").notNull().default("Hazır"),
  captureStartedAt: text("capture_started_at"),
  captureEndedAt: text("capture_ended_at"),
  generalNotes: text("general_notes").notNull().default(""),
  selectedTaskCount: integer("selected_task_count").notNull().default(0),
  createdBy: text("created_by").notNull().default(""),
  updatedBy: text("updated_by").notNull().default(""),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index("idx_meetings_date").on(table.meetingDate, table.updatedAt),
]);

export const meetingTranscriptSegments = sqliteTable("meeting_transcript_segments", {
  id: text("id").primaryKey(),
  meetingId: text("meeting_id")
    .notNull()
    .references(() => meetings.id, { onDelete: "cascade" }),
  sequence: integer("sequence").notNull(),
  elapsedSeconds: integer("elapsed_seconds").notNull().default(0),
  capturedAt: text("captured_at").notNull(),
  text: text("text").notNull(),
  confidencePct: integer("confidence_pct"),
  clarity: text("clarity").notNull().default("Net"),
  source: text("source").notNull().default("Canlı Mikrofon"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("idx_meeting_transcript_sequence").on(table.meetingId, table.sequence),
  index("idx_meeting_transcript_meeting_time").on(table.meetingId, table.elapsedSeconds),
]);

export const meetingItems = sqliteTable("meeting_items", {
  id: text("id").primaryKey(),
  meetingId: text("meeting_id")
    .notNull()
    .references(() => meetings.id, { onDelete: "cascade" }),
  taskId: text("task_id")
    .references(() => tasks.id, { onDelete: "set null" }),
  sortOrder: integer("sort_order").notNull().default(0),
  taskTitle: text("task_title").notNull(),
  snapshotJson: text("snapshot_json").notNull(),
  note: text("note").notNull().default(""),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index("idx_meeting_items_meeting_order").on(table.meetingId, table.sortOrder),
  index("idx_meeting_items_task").on(table.taskId),
]);

export const taskAttachments = sqliteTable("task_attachments", {
  id: text("id").primaryKey(),
  taskId: text("task_id")
    .notNull()
    .references(() => tasks.id, { onDelete: "cascade" }),
  storageKey: text("storage_key").notNull(),
  fileName: text("file_name").notNull(),
  contentType: text("content_type").notNull().default("application/octet-stream"),
  sizeBytes: integer("size_bytes").notNull().default(0),
  isImage: integer("is_image", { mode: "boolean" }).notNull().default(false),
  isFeatured: integer("is_featured", { mode: "boolean" }).notNull().default(false),
  uploadedBy: text("uploaded_by").notNull().default(""),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("idx_task_attachments_storage_key").on(table.storageKey),
  index("idx_task_attachments_task_date").on(table.taskId, table.createdAt),
]);

export const taskHistoryEntries = sqliteTable("task_history_entries", {
  id: text("id").primaryKey(),
  taskId: text("task_id").notNull(),
  eventType: text("event_type").notNull().default("Güvenlik Kopyası"),
  snapshotJson: text("snapshot_json").notNull(),
  changedBy: text("changed_by").notNull().default(""),
  sourceRef: text("source_ref"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index("idx_task_history_task_date").on(table.taskId, table.createdAt),
  uniqueIndex("idx_task_history_source_ref").on(table.sourceRef),
]);

export const departmentApprovals = sqliteTable("department_approvals", {
  id: text("id").primaryKey(),
  sortOrder: integer("sort_order").notNull().default(0),
  requestType: text("request_type").notNull().default("Ekipman / Teknoloji"),
  title: text("title").notNull(),
  justification: text("justification").notNull(),
  priority: text("priority").notNull().default("Orta"),
  status: text("status").notNull().default("Taslak"),
  neededBy: text("needed_by"),
  estimatedBudget: text("estimated_budget").notNull().default(""),
  nextAction: text("next_action").notNull().default(""),
  decisionNote: text("decision_note").notNull().default(""),
  submittedAt: text("submitted_at"),
  decisionAt: text("decision_at"),
  createdBy: text("created_by").notNull().default(""),
  updatedBy: text("updated_by").notNull().default(""),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index("idx_department_approvals_sort").on(table.sortOrder),
  index("idx_department_approvals_status_needed").on(table.status, table.neededBy),
  index("idx_department_approvals_updated").on(table.updatedAt),
]);

export const visits = sqliteTable("visits", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  visitDate: text("visit_date"),
  category: text("category").notNull().default("Kurumsal"),
  priority: text("priority").notNull().default("Orta"),
  status: text("status").notNull().default("Planlandı"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdBy: text("created_by").notNull().default(""),
  updatedBy: text("updated_by").notNull().default(""),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index("idx_visits_status_date").on(table.status, table.visitDate),
  index("idx_visits_sort").on(table.sortOrder),
]);

export const fairEvents = sqliteTable("fair_events", {
  id: text("id").primaryKey(),
  source: text("source").notNull().default("Manuel"),
  sourceRef: text("source_ref").notNull(),
  title: text("title").notNull(),
  country: text("country").notNull().default(""),
  city: text("city").notNull().default(""),
  eventYear: integer("event_year").notNull(),
  eventMonth: integer("event_month"),
  startDate: text("start_date"),
  endDate: text("end_date"),
  dateNote: text("date_note").notNull().default(""),
  participationStatus: text("participation_status").notNull().default("Değerlendirilecek"),
  supportType: text("support_type").notNull().default("Referans"),
  scopeNote: text("scope_note").notNull().default(""),
  planningNote: text("planning_note").notNull().default(""),
  isDeleted: integer("is_deleted", { mode: "boolean" }).notNull().default(false),
  createdBy: text("created_by").notNull().default(""),
  updatedBy: text("updated_by").notNull().default(""),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("idx_fair_events_source_ref").on(table.sourceRef),
  index("idx_fair_events_year_month").on(table.eventYear, table.eventMonth),
  index("idx_fair_events_deleted_date").on(table.isDeleted, table.startDate),
]);

export const appState = sqliteTable("app_state", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});
