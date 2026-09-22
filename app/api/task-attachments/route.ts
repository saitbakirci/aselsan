import { and, desc, eq } from "drizzle-orm";

import { getBucket, getD1, getDb } from "../../../db";
import { taskAttachments, tasks } from "../../../db/schema";

const MAX_FILE_SIZE = 50 * 1024 * 1024;
const blockedExtensions = new Set(["exe", "msi", "bat", "cmd", "com", "js", "html", "htm", "svg"]);
const inlineImageTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

function actor(request: Request) {
  return request.headers.get("oai-authenticated-user-email") || "Sait Bakırcı";
}

function cleanText(value: unknown, max = 1000) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function cleanFileName(value: string) {
  const cleaned = value
    .normalize("NFC")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/[\\/]+/g, "-")
    .trim()
    .slice(0, 180);
  return cleaned || "dosya";
}

function extension(value: string) {
  const match = value.toLocaleLowerCase("tr-TR").match(/\.([a-z0-9]+)$/);
  return match?.[1] || "";
}

function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "Beklenmeyen bir hata oluştu.";
  const lower = message.toLocaleLowerCase("tr-TR");
  const badRequest = lower.includes("zorunludur") || lower.includes("desteklenmiyor") || lower.includes("boyutu") || lower.includes("bulunamadı");
  return Response.json({ error: message }, { status: badRequest ? 400 : 500 });
}

function contentDisposition(fileName: string, inline: boolean) {
  const ascii = fileName.replace(/[^\x20-\x7E]/g, "_").replace(/["\\]/g, "_") || "file";
  return `${inline ? "inline" : "attachment"}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const id = cleanText(url.searchParams.get("id"), 100);
    const db = getDb();

    if (id) {
      const [attachment] = await db.select().from(taskAttachments).where(eq(taskAttachments.id, id)).limit(1);
      if (!attachment) return Response.json({ error: "Dosya bulunamadı." }, { status: 404 });
      const object = await getBucket().get(attachment.storageKey);
      if (!object) return Response.json({ error: "Dosya içeriği bulunamadı." }, { status: 404 });
      const inline = url.searchParams.get("inline") === "1" && attachment.isImage;
      const headers = new Headers();
      object.writeHttpMetadata(headers);
      headers.set("Content-Type", attachment.contentType);
      headers.set("Content-Length", String(object.size));
      headers.set("Content-Disposition", contentDisposition(attachment.fileName, inline));
      headers.set("Cache-Control", inline ? "private, max-age=300" : "private, no-store");
      headers.set("X-Content-Type-Options", "nosniff");
      return new Response(object.body, { headers });
    }

    const taskId = cleanText(url.searchParams.get("taskId"), 100);
    if (!taskId) throw new Error("İş kimliği zorunludur.");
    const rows = await db
      .select()
      .from(taskAttachments)
      .where(eq(taskAttachments.taskId, taskId))
      .orderBy(desc(taskAttachments.isFeatured), desc(taskAttachments.createdAt))
      .limit(100);
    return Response.json({ attachments: rows });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  let storageKey = "";
  try {
    const form = await request.formData();
    const taskId = cleanText(form.get("taskId"), 100);
    const fileValue = form.get("file");
    if (!taskId) throw new Error("İş kimliği zorunludur.");
    if (!(fileValue instanceof File)) throw new Error("Yüklenecek dosya zorunludur.");
    if (fileValue.size === 0) throw new Error("Boş dosya yüklenemez.");
    if (fileValue.size > MAX_FILE_SIZE) throw new Error("Dosya boyutu 50 MB sınırını aşamaz.");

    const fileName = cleanFileName(fileValue.name);
    if (blockedExtensions.has(extension(fileName))) throw new Error("Bu dosya türü güvenlik nedeniyle desteklenmiyor.");
    const contentType = cleanText(fileValue.type, 120) || "application/octet-stream";
    const isImage = inlineImageTypes.has(contentType);
    const db = getDb();
    const [task] = await db.select({ id: tasks.id }).from(tasks).where(eq(tasks.id, taskId)).limit(1);
    if (!task) throw new Error("İlgili iş bulunamadı.");

    const id = crypto.randomUUID();
    storageKey = `tasks/${taskId}/${id}/${fileName}`;
    const [featured] = isImage
      ? await db.select({ id: taskAttachments.id }).from(taskAttachments).where(and(eq(taskAttachments.taskId, taskId), eq(taskAttachments.isFeatured, true))).limit(1)
      : [];
    const isFeatured = isImage && !featured;
    await getBucket().put(storageKey, fileValue.stream(), {
      httpMetadata: { contentType },
      customMetadata: { taskId, attachmentId: id, uploadedBy: actor(request) },
    });

    const [attachment] = await db.insert(taskAttachments).values({
      id,
      taskId,
      storageKey,
      fileName,
      contentType,
      sizeBytes: fileValue.size,
      isImage,
      isFeatured,
      uploadedBy: actor(request),
      createdAt: new Date().toISOString(),
    }).returning();
    return Response.json({ attachment }, { status: 201 });
  } catch (error) {
    if (storageKey) {
      try { await getBucket().delete(storageKey); } catch { /* Keep the original upload error. */ }
    }
    return errorResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const payload = await request.json() as { id?: unknown; isFeatured?: unknown };
    const id = cleanText(payload.id, 100);
    if (!id) throw new Error("Dosya kimliği zorunludur.");
    const db = getDb();
    const [attachment] = await db.select().from(taskAttachments).where(eq(taskAttachments.id, id)).limit(1);
    if (!attachment) throw new Error("Dosya bulunamadı.");
    if (!attachment.isImage) throw new Error("Yalnızca görseller sunum görseli olabilir.");

    const d1 = getD1();
    await d1.batch([
      d1.prepare("UPDATE task_attachments SET is_featured = 0 WHERE task_id = ?").bind(attachment.taskId),
      d1.prepare("UPDATE task_attachments SET is_featured = 1 WHERE id = ?").bind(id),
    ]);
    const [updated] = await db.select().from(taskAttachments).where(eq(taskAttachments.id, id)).limit(1);
    return Response.json({ attachment: updated });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const payload = await request.json() as { id?: unknown };
    const id = cleanText(payload.id, 100);
    if (!id) throw new Error("Dosya kimliği zorunludur.");
    const db = getDb();
    const [attachment] = await db.select().from(taskAttachments).where(eq(taskAttachments.id, id)).limit(1);
    if (!attachment) return Response.json({ error: "Dosya bulunamadı." }, { status: 404 });
    await getBucket().delete(attachment.storageKey);
    await db.delete(taskAttachments).where(eq(taskAttachments.id, id));
    return Response.json({ deleted: true });
  } catch (error) {
    return errorResponse(error);
  }
}
