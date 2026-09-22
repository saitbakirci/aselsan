import { and, desc, eq } from "drizzle-orm";

import { getDb } from "../../../db";
import { taskMemoryEntries, tasks } from "../../../db/schema";

const kinds = ["İlerleme", "Karar", "Yöntem", "Plan", "Doküman", "Toplantı Notu"] as const;

type MemoryInput = {
  id?: string;
  taskId?: string;
  kind?: string;
  title?: string;
  detail?: string;
  eventDate?: string;
  documentName?: string | null;
  documentVersion?: string | null;
  documentUrl?: string | null;
  isCurrent?: boolean;
  source?: string;
  sourceRef?: string | null;
};

function actor(request: Request) {
  return request.headers.get("oai-authenticated-user-email") || "Sait Bakırcı";
}

function cleanText(value: unknown, max = 1000) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function cleanDate(value: unknown) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? value
    : new Date().toISOString().slice(0, 10);
}

function cleanUrl(value: unknown) {
  const input = cleanText(value, 1600);
  if (!input) return null;
  try {
    const url = new URL(input);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function normalized(input: MemoryInput, request: Request) {
  const taskId = cleanText(input.taskId, 100);
  const title = cleanText(input.title, 180);
  if (!taskId) throw new Error("Bağlı hedef zorunludur.");
  if (!title) throw new Error("Kayıt başlığı zorunludur.");
  const kind = kinds.includes(input.kind as (typeof kinds)[number])
    ? input.kind!
    : "İlerleme";
  const documentUrl = cleanUrl(input.documentUrl);
  if (cleanText(input.documentUrl, 1600) && !documentUrl) {
    throw new Error("Doküman bağlantısı geçerli bir web adresi olmalıdır.");
  }

  return {
    taskId,
    kind,
    title,
    detail: cleanText(input.detail, 5000),
    eventDate: cleanDate(input.eventDate),
    documentName: cleanText(input.documentName, 240) || null,
    documentVersion: cleanText(input.documentVersion, 120) || null,
    documentUrl,
    isCurrent: kind === "Doküman" && Boolean(input.isCurrent),
    source: cleanText(input.source, 80) || "Manuel",
    sourceRef: cleanText(input.sourceRef, 240) || null,
    updatedBy: actor(request),
    updatedAt: new Date().toISOString(),
  };
}

function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "Beklenmeyen bir hata oluştu.";
  const isInputError = message.includes("zorunludur") || message.includes("geçerli");
  return Response.json({ error: message }, { status: isInputError ? 400 : 500 });
}

export async function GET(request: Request) {
  try {
    const taskId = cleanText(new URL(request.url).searchParams.get("taskId"), 100);
    if (!taskId) return Response.json({ error: "Bağlı hedef zorunludur." }, { status: 400 });
    const db = getDb();
    const entries = await db
      .select()
      .from(taskMemoryEntries)
      .where(eq(taskMemoryEntries.taskId, taskId))
      .orderBy(desc(taskMemoryEntries.eventDate), desc(taskMemoryEntries.createdAt))
      .limit(500);
    return Response.json({ entries });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as MemoryInput;
    const values = normalized(payload, request);
    const db = getDb();
    const [parent] = await db.select({ id: tasks.id }).from(tasks).where(eq(tasks.id, values.taskId)).limit(1);
    if (!parent) return Response.json({ error: "Bağlı hedef bulunamadı." }, { status: 404 });

    if (values.sourceRef) {
      const [existing] = await db
        .select()
        .from(taskMemoryEntries)
        .where(eq(taskMemoryEntries.sourceRef, values.sourceRef))
        .limit(1);
      if (existing) return Response.json({ entry: existing });
    }

    if (values.isCurrent) {
      await db
        .update(taskMemoryEntries)
        .set({ isCurrent: false, updatedAt: values.updatedAt, updatedBy: values.updatedBy })
        .where(and(eq(taskMemoryEntries.taskId, values.taskId), eq(taskMemoryEntries.kind, "Doküman")));
    }

    const id = crypto.randomUUID();
    const [entry] = await db.insert(taskMemoryEntries).values({ id, ...values }).returning();
    await db.update(tasks).set({ updatedAt: values.updatedAt, updatedBy: values.updatedBy }).where(eq(tasks.id, values.taskId));
    return Response.json({ entry }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const payload = (await request.json()) as MemoryInput;
    const id = cleanText(payload.id, 100);
    if (!id) return Response.json({ error: "Kayıt kimliği zorunludur." }, { status: 400 });
    const values = normalized(payload, request);
    const db = getDb();

    if (values.isCurrent) {
      await db
        .update(taskMemoryEntries)
        .set({ isCurrent: false, updatedAt: values.updatedAt, updatedBy: values.updatedBy })
        .where(and(eq(taskMemoryEntries.taskId, values.taskId), eq(taskMemoryEntries.kind, "Doküman")));
    }

    const [entry] = await db.update(taskMemoryEntries).set(values).where(eq(taskMemoryEntries.id, id)).returning();
    if (!entry) return Response.json({ error: "Hafıza kaydı bulunamadı." }, { status: 404 });
    await db.update(tasks).set({ updatedAt: values.updatedAt, updatedBy: values.updatedBy }).where(eq(tasks.id, values.taskId));
    return Response.json({ entry });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const payload = (await request.json()) as { id?: string };
    const id = cleanText(payload.id, 100);
    if (!id) return Response.json({ error: "Kayıt kimliği zorunludur." }, { status: 400 });
    const db = getDb();
    const [entry] = await db.delete(taskMemoryEntries).where(eq(taskMemoryEntries.id, id)).returning();
    if (!entry) return Response.json({ error: "Hafıza kaydı bulunamadı." }, { status: 404 });
    return Response.json({ deleted: true });
  } catch (error) {
    return errorResponse(error);
  }
}
