import { asc, desc, eq, inArray } from "drizzle-orm";

import { getD1, getDb } from "../../../db";
import { meetingItems, meetings, meetingTranscriptSegments, taskAttachments, taskMemoryEntries, tasks } from "../../../db/schema";
import type { MeetingAttachmentSummary, MeetingCaptureStatus, MeetingDetail, MeetingMemorySummary, MeetingTaskSnapshot, MeetingTaskSummary } from "../../meeting-types";

type CreateMeetingInput = {
  taskIds?: unknown;
  title?: unknown;
  meetingDate?: unknown;
  mode?: unknown;
};

type UpdateMeetingInput = {
  action?: unknown;
  id?: unknown;
  itemId?: unknown;
  title?: unknown;
  generalNotes?: unknown;
  note?: unknown;
  status?: unknown;
};

function actor(request: Request) {
  return request.headers.get("oai-authenticated-user-email") || "Sait Bakırcı";
}

function cleanText(value: unknown, max = 1000) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function cleanDate(value: unknown) {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  return new Date().toISOString().slice(0, 10);
}

function defaultMeetingTitle(date: string) {
  const [year, month, day] = date.split("-");
  return `Çalışma Gündemi - ${day}.${month}.${year}`;
}

function defaultStandaloneMeetingTitle(date: string) {
  const [year, month, day] = date.split("-");
  return `Toplantı Notları - ${day}.${month}.${year}`;
}

function taskSummary(task: typeof tasks.$inferSelect): MeetingTaskSummary {
  return {
    id: task.id,
    title: task.title,
    category: task.category,
    priority: task.priority,
    status: task.status,
    dueDate: task.dueDate,
    followUpDate: task.followUpDate,
    owner: task.owner,
    nextAction: task.nextAction,
    decision: task.decision,
    risk: task.risk,
  };
}

function memorySummary(entry: typeof taskMemoryEntries.$inferSelect): MeetingMemorySummary {
  return {
    id: entry.id,
    taskId: entry.taskId,
    kind: entry.kind,
    title: entry.title,
    detail: entry.detail,
    eventDate: entry.eventDate,
    documentName: entry.documentName,
    documentVersion: entry.documentVersion,
    documentUrl: entry.documentUrl,
    isCurrent: entry.isCurrent,
  };
}

function attachmentSummary(entry: typeof taskAttachments.$inferSelect): MeetingAttachmentSummary {
  return {
    id: entry.id,
    taskId: entry.taskId,
    fileName: entry.fileName,
    contentType: entry.contentType,
    sizeBytes: entry.sizeBytes,
    isImage: entry.isImage,
    isFeatured: entry.isFeatured,
    createdAt: entry.createdAt,
  };
}

function parseSnapshot(value: string): MeetingTaskSnapshot {
  try {
    const parsed = JSON.parse(value) as MeetingTaskSnapshot;
    return { ...parsed, attachments: parsed.attachments || [] };
  } catch {
    return {
      task: { id: "", title: "Kayıt okunamadı", category: "", priority: "Orta", status: "", dueDate: null, followUpDate: null, owner: "", nextAction: "", decision: "", risk: "" },
      subtasks: [],
      history: [],
      documents: [],
      attachments: [],
    };
  }
}

async function meetingDetail(id: string): Promise<MeetingDetail | null> {
  const db = getDb();
  const [meeting] = await db.select().from(meetings).where(eq(meetings.id, id)).limit(1);
  if (!meeting) return null;
  const [rows, transcript] = await Promise.all([
    db
      .select()
      .from(meetingItems)
      .where(eq(meetingItems.meetingId, id))
      .orderBy(asc(meetingItems.sortOrder)),
    db
      .select()
      .from(meetingTranscriptSegments)
      .where(eq(meetingTranscriptSegments.meetingId, id))
      .orderBy(asc(meetingTranscriptSegments.sequence)),
  ]);
  return {
    meeting: meeting as MeetingDetail["meeting"],
    items: rows.map((row) => ({ ...row, snapshot: parseSnapshot(row.snapshotJson), snapshotJson: undefined })) as MeetingDetail["items"],
    transcript: transcript as MeetingDetail["transcript"],
  };
}

async function syncCompletedMeetingNotes(meetingId: string, request: Request) {
  const db = getDb();
  const [meeting] = await db.select().from(meetings).where(eq(meetings.id, meetingId)).limit(1);
  if (!meeting || meeting.status !== "Tamamlandı") return;
  const items = await db.select().from(meetingItems).where(eq(meetingItems.meetingId, meetingId));
  const notedItems = items.filter((item) => item.taskId && item.note.trim());
  if (notedItems.length === 0) return;

  const now = new Date().toISOString();
  const by = actor(request);
  const d1 = getD1();
  const statements = notedItems.flatMap((item) => {
    const sourceRef = `meeting-note:${meetingId}:${item.id}`;
    return [
      d1.prepare(`
        INSERT INTO task_memory_entries (
          id, task_id, kind, title, detail, event_date,
          document_name, document_version, document_url, is_current,
          source, source_ref, updated_by, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, NULL, 0, ?, ?, ?, ?, ?)
        ON CONFLICT(source_ref) DO UPDATE SET
          title = excluded.title,
          detail = excluded.detail,
          event_date = excluded.event_date,
          updated_by = excluded.updated_by,
          updated_at = excluded.updated_at
      `).bind(
        crypto.randomUUID(),
        item.taskId,
        "Toplantı Notu",
        `${meeting.title} toplantı notu`.slice(0, 180),
        item.note.trim().slice(0, 5000),
        meeting.meetingDate,
        "Toplantı",
        sourceRef,
        by,
        now,
        now
      ),
      d1.prepare("UPDATE tasks SET updated_by = ?, updated_at = ? WHERE id = ?").bind(by, now, item.taskId),
    ];
  });
  for (let index = 0; index < statements.length; index += 50) {
    await d1.batch(statements.slice(index, index + 50));
  }
}

function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "Beklenmeyen bir hata oluştu.";
  const normalizedMessage = message.toLocaleLowerCase("tr-TR");
  const badRequest = normalizedMessage.includes("seç") || normalizedMessage.includes("zorunludur") || normalizedMessage.includes("bulunamadı") || normalizedMessage.includes("ana hedef değil") || normalizedMessage.includes("deşifre") || normalizedMessage.includes("tamamlanan toplantı");
  return Response.json({ error: message }, { status: badRequest ? 400 : 500 });
}

export async function GET(request: Request) {
  try {
    const id = cleanText(new URL(request.url).searchParams.get("id"), 100);
    if (id) {
      const detail = await meetingDetail(id);
      if (!detail) return Response.json({ error: "Toplantı bulunamadı." }, { status: 404 });
      return Response.json(detail);
    }
    const db = getDb();
    const rows = await db.select().from(meetings).orderBy(desc(meetings.meetingDate), desc(meetings.updatedAt)).limit(100);
    return Response.json({ meetings: rows });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as CreateMeetingInput;
    const taskIds = Array.isArray(payload.taskIds)
      ? [...new Set(payload.taskIds.map((value) => cleanText(value, 100)).filter(Boolean))].slice(0, 50)
      : [];
    const standalone = cleanText(payload.mode, 40) === "standalone";
    if (!standalone && taskIds.length === 0) throw new Error("Sunum için en az bir hedef seçilmelidir.");

    const db = getDb();
    const selectedRows = taskIds.length > 0 ? await db.select().from(tasks).where(inArray(tasks.id, taskIds)) : [];
    const selectedById = new Map(selectedRows.filter((task) => task.taskType === "goal").map((task) => [task.id, task]));
    const selectedTasks = taskIds.map((id) => selectedById.get(id)).filter((task): task is typeof tasks.$inferSelect => Boolean(task));
    if (selectedTasks.length !== taskIds.length) throw new Error("Seçilen hedeflerden biri bulunamadı veya ana hedef değil.");

    const childRows = taskIds.length > 0 ? await db.select().from(tasks).where(inArray(tasks.parentGoalId, taskIds)) : [];
    const allTaskIds = [...taskIds, ...childRows.map((task) => task.id)];
    const memoryRows = allTaskIds.length > 0
      ? await db.select().from(taskMemoryEntries).where(inArray(taskMemoryEntries.taskId, allTaskIds)).orderBy(desc(taskMemoryEntries.eventDate), desc(taskMemoryEntries.createdAt))
      : [];
    const attachmentRows = allTaskIds.length > 0
      ? await db.select().from(taskAttachments).where(inArray(taskAttachments.taskId, allTaskIds)).orderBy(desc(taskAttachments.isFeatured), desc(taskAttachments.createdAt))
      : [];
    const childrenByGoal = new Map<string, typeof childRows>();
    for (const child of childRows) {
      const rows = childrenByGoal.get(child.parentGoalId || "") || [];
      rows.push(child);
      childrenByGoal.set(child.parentGoalId || "", rows);
    }
    const meetingDate = cleanDate(payload.meetingDate);
    const title = cleanText(payload.title, 180) || (standalone ? defaultStandaloneMeetingTitle(meetingDate) : defaultMeetingTitle(meetingDate));
    const meetingId = crypto.randomUUID();
    const by = actor(request);
    const now = new Date().toISOString();
    const d1 = getD1();
    const statements = [
      d1.prepare(`
        INSERT INTO meetings (
          id, title, meeting_date, status, general_notes, selected_task_count,
          created_by, updated_by, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(meetingId, title, meetingDate, "Aktif", "", selectedTasks.length, by, by, now, now),
    ];

    const responseItems: MeetingDetail["items"] = [];
    selectedTasks.forEach((task, index) => {
      const childTasks = (childrenByGoal.get(task.id) || []).sort((a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title, "tr"));
      const relatedIds = new Set([task.id, ...childTasks.map((child) => child.id)]);
      const relatedMemory = [...memoryRows].filter((entry) => relatedIds.has(entry.taskId));
      const snapshot: MeetingTaskSnapshot = {
        task: taskSummary(task),
        subtasks: childTasks.map(taskSummary),
        history: relatedMemory.filter((entry) => entry.kind !== "Doküman").slice(0, 8).map(memorySummary),
        documents: relatedMemory
          .filter((entry) => entry.kind === "Doküman")
          .sort((a, b) => Number(b.isCurrent) - Number(a.isCurrent) || b.eventDate.localeCompare(a.eventDate))
          .slice(0, 8)
          .map(memorySummary),
        attachments: attachmentRows
          .filter((entry) => relatedIds.has(entry.taskId))
          .sort((a, b) => Number(b.isFeatured) - Number(a.isFeatured) || Number(b.isImage) - Number(a.isImage) || b.createdAt.localeCompare(a.createdAt))
          .slice(0, 12)
          .map(attachmentSummary),
      };
      const itemId = crypto.randomUUID();
      statements.push(
        d1.prepare(`
          INSERT INTO meeting_items (
            id, meeting_id, task_id, sort_order, task_title, snapshot_json, note, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(itemId, meetingId, task.id, index, task.title, JSON.stringify(snapshot), "", now, now)
      );
      responseItems.push({ id: itemId, meetingId, taskId: task.id, sortOrder: index, taskTitle: task.title, snapshot, note: "", createdAt: now, updatedAt: now });
    });
    await d1.batch(statements);

    return Response.json({
      meeting: { id: meetingId, title, meetingDate, status: "Aktif", captureStatus: "Hazır", captureStartedAt: null, captureEndedAt: null, generalNotes: "", selectedTaskCount: selectedTasks.length, createdBy: by, updatedBy: by, createdAt: now, updatedAt: now },
      items: responseItems,
      transcript: [],
    } satisfies MeetingDetail, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const payload = (await request.json()) as UpdateMeetingInput;
    const action = cleanText(payload.action, 40);
    const by = actor(request);
    const now = new Date().toISOString();
    const db = getDb();

    if (action === "update_item_note") {
      const itemId = cleanText(payload.itemId, 100);
      if (!itemId) throw new Error("Sunum maddesi zorunludur.");
      const [item] = await db.update(meetingItems).set({ note: cleanText(payload.note, 10000), updatedAt: now }).where(eq(meetingItems.id, itemId)).returning();
      if (!item) throw new Error("Sunum maddesi bulunamadı.");
      await db.update(meetings).set({ updatedAt: now, updatedBy: by }).where(eq(meetings.id, item.meetingId));
      await syncCompletedMeetingNotes(item.meetingId, request);
      return Response.json({ item: { ...item, snapshot: parseSnapshot(item.snapshotJson), snapshotJson: undefined } });
    }

    const id = cleanText(payload.id, 100);
    if (!id) throw new Error("Toplantı kimliği zorunludur.");
    const current = await meetingDetail(id);
    if (!current) throw new Error("Toplantı bulunamadı.");

    // Historic transcripts remain readable; microphone capture and transcript writes are retired.
    if (action === "append_transcript" || action === "set_capture_status" || action === "update_transcript_segment") {
      return Response.json({ error: "Canlı deşifre özelliği kaldırıldı." }, { status: 410 });
    }

    const status = payload.status === "Tamamlandı" ? "Tamamlandı" : payload.status === "Aktif" ? "Aktif" : current.meeting.status;
    const title = cleanText(payload.title, 180) || current.meeting.title;
    const generalNotes = typeof payload.generalNotes === "string" ? cleanText(payload.generalNotes, 20000) : current.meeting.generalNotes;
    const captureStatus: MeetingCaptureStatus = status === "Tamamlandı" ? "Tamamlandı" : current.meeting.captureStatus;
    const captureEndedAt = status === "Tamamlandı" ? current.meeting.captureEndedAt || now : current.meeting.captureEndedAt;
    await db.update(meetings).set({ title, generalNotes, status, captureStatus, captureEndedAt, updatedAt: now, updatedBy: by }).where(eq(meetings.id, id));
    await syncCompletedMeetingNotes(id, request);
    const detail = await meetingDetail(id);
    return Response.json(detail);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const payload = (await request.json()) as { id?: unknown };
    const id = cleanText(payload.id, 100);
    if (!id) throw new Error("Toplantı kimliği zorunludur.");
    const db = getDb();
    const [meeting] = await db.delete(meetings).where(eq(meetings.id, id)).returning();
    if (!meeting) return Response.json({ error: "Toplantı bulunamadı." }, { status: 404 });
    return Response.json({ deleted: true });
  } catch (error) {
    return errorResponse(error);
  }
}
