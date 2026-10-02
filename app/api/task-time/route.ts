import { and, desc, eq, gte, lte } from "drizzle-orm";

import { getDb } from "../../../db";
import { tasks, taskTimeEntries } from "../../../db/schema";

function actor(request: Request) {
  return request.headers.get("oai-authenticated-user-email") || "Sait Bakırcı";
}

function cleanText(value: unknown, max = 500) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function cleanDate(value: unknown) {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  return null;
}

function cleanMinutes(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return null;
  const minutes = Math.round(parsed);
  return minutes >= 1 && minutes <= 1440 ? minutes : null;
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const taskId = cleanText(url.searchParams.get("taskId"), 100);
    const from = cleanDate(url.searchParams.get("from"));
    const to = cleanDate(url.searchParams.get("to"));
    const filters = [];
    if (taskId) filters.push(eq(taskTimeEntries.taskId, taskId));
    if (from) filters.push(gte(taskTimeEntries.workDate, from));
    if (to) filters.push(lte(taskTimeEntries.workDate, to));
    const db = getDb();
    const query = db.select().from(taskTimeEntries);
    const entries = filters.length > 0
      ? await query.where(and(...filters)).orderBy(desc(taskTimeEntries.workDate), desc(taskTimeEntries.createdAt)).limit(3000)
      : await query.orderBy(desc(taskTimeEntries.workDate), desc(taskTimeEntries.createdAt)).limit(3000);
    return Response.json({ entries });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Zaman kayıtları yüklenemedi.";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const payload = await request.json() as { taskId?: string; workDate?: string; minutes?: number; note?: string; entryType?: string };
    const taskId = cleanText(payload.taskId, 100);
    const workDate = cleanDate(payload.workDate);
    const minutes = cleanMinutes(payload.minutes);
    if (!taskId || !workDate || minutes === null) {
      return Response.json({ error: "İş, çalışma günü ve en az 1 dakikalık süre zorunludur." }, { status: 400 });
    }
    const db = getDb();
    const [task] = await db.select({ id: tasks.id }).from(tasks).where(eq(tasks.id, taskId)).limit(1);
    if (!task) return Response.json({ error: "İş bulunamadı." }, { status: 404 });
    const now = new Date().toISOString();
    const by = actor(request);
    const [entry] = await db.insert(taskTimeEntries).values({
      id: crypto.randomUUID(),
      taskId,
      workDate,
      minutes,
      note: cleanText(payload.note, 1000),
      entryType: cleanText(payload.entryType, 60) || "Çalışma",
      createdBy: by,
      updatedBy: by,
      createdAt: now,
      updatedAt: now,
    }).returning();
    return Response.json({ entry }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Zaman kaydı eklenemedi.";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const payload = await request.json() as { id?: string; workDate?: string; minutes?: number; note?: string; entryType?: string };
    const id = cleanText(payload.id, 100);
    const workDate = cleanDate(payload.workDate);
    const minutes = cleanMinutes(payload.minutes);
    if (!id || !workDate || minutes === null) {
      return Response.json({ error: "Kayıt, çalışma günü ve süre zorunludur." }, { status: 400 });
    }
    const db = getDb();
    const [entry] = await db.update(taskTimeEntries).set({
      workDate,
      minutes,
      note: cleanText(payload.note, 1000),
      entryType: cleanText(payload.entryType, 60) || "Çalışma",
      updatedBy: actor(request),
      updatedAt: new Date().toISOString(),
    }).where(eq(taskTimeEntries.id, id)).returning();
    if (!entry) return Response.json({ error: "Zaman kaydı bulunamadı." }, { status: 404 });
    return Response.json({ entry });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Zaman kaydı güncellenemedi.";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const payload = await request.json() as { id?: string };
    const id = cleanText(payload.id, 100);
    if (!id) return Response.json({ error: "Kayıt kimliği zorunludur." }, { status: 400 });
    const db = getDb();
    const [deleted] = await db.delete(taskTimeEntries).where(eq(taskTimeEntries.id, id)).returning({ id: taskTimeEntries.id });
    if (!deleted) return Response.json({ error: "Zaman kaydı bulunamadı." }, { status: 404 });
    return Response.json({ deleted: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Zaman kaydı silinemedi.";
    return Response.json({ error: message }, { status: 500 });
  }
}
