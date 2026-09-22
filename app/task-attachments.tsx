"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Download, Eye, FileArchive, FileText, Loader2, Paperclip, Presentation,
  Star, Trash2, Upload,
} from "lucide-react";
import { toast } from "sonner";

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export type TaskAttachment = {
  id: string;
  taskId: string;
  storageKey: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  isImage: boolean;
  isFeatured: boolean;
  uploadedBy: string;
  createdAt: string;
};

type AttachmentsResponse = { attachments: TaskAttachment[] };
type AttachmentResponse = { attachment: TaskAttachment };

async function responseJson<T>(response: Response): Promise<T> {
  const data = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(data.error || "İşlem tamamlanamadı.");
  return data as T;
}

function formatBytes(value: number) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
  return `${(value / 1024 / 1024).toLocaleString("tr-TR", { maximumFractionDigits: 1 })} MB`;
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("tr-TR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function fileIcon(contentType: string) {
  if (contentType.includes("pdf") || contentType.includes("word") || contentType.startsWith("text/")) return <FileText />;
  if (contentType.includes("zip") || contentType.includes("compressed")) return <FileArchive />;
  return <Paperclip />;
}

export function TaskAttachments({ taskId }: { taskId: string }) {
  const [attachments, setAttachments] = useState<TaskAttachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState("");
  const [dragging, setDragging] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [previewAttachment, setPreviewAttachment] = useState<TaskAttachment | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dragDepthRef = useRef(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/task-attachments?taskId=${encodeURIComponent(taskId)}`);
      const data = await responseJson<AttachmentsResponse>(response);
      setAttachments(data.attachments);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Dosyalar yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function uploadFiles(files: FileList | null) {
    if (!files?.length) return;
    const selected = [...files].slice(0, 10);
    if (files.length > 10) toast.info("Tek seferde ilk 10 dosya yükleniyor.");
    setUploading(true);
    let completed = 0;
    try {
      for (let index = 0; index < selected.length; index += 1) {
        const file = selected[index];
        setUploadProgress(`${index + 1}/${selected.length} · ${file.name}`);
        const form = new FormData();
        form.append("taskId", taskId);
        form.append("file", file);
        const response = await fetch("/api/task-attachments", { method: "POST", body: form });
        const data = await responseJson<AttachmentResponse>(response);
        setAttachments((current) => [data.attachment, ...current.map((item) => data.attachment.isFeatured ? { ...item, isFeatured: false } : item)]);
        completed += 1;
      }
      toast.success(`${completed} dosya projeye eklendi.`);
    } catch (error) {
      toast.error(`${completed} dosya yüklendi. ${error instanceof Error ? error.message : "Kalan dosyalar yüklenemedi."}`);
    } finally {
      setUploading(false);
      setUploadProgress("");
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function dragEnter(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    if (!event.dataTransfer.types.includes("Files") || uploading) return;
    dragDepthRef.current += 1;
    setDragging(true);
  }

  function dragLeave(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) setDragging(false);
  }

  function dropFiles(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    dragDepthRef.current = 0;
    setDragging(false);
    if (!uploading) void uploadFiles(event.dataTransfer.files);
  }

  async function makeFeatured(id: string) {
    try {
      const response = await fetch("/api/task-attachments", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, isFeatured: true }) });
      const data = await responseJson<AttachmentResponse>(response);
      setAttachments((current) => current.map((item) => ({ ...item, isFeatured: item.id === data.attachment.id })));
      toast.success("Sunum görseli güncellendi.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Sunum görseli seçilemedi.");
    }
  }

  async function deleteAttachment() {
    if (!deleteId) return;
    try {
      const response = await fetch("/api/task-attachments", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: deleteId }) });
      await responseJson<{ deleted: boolean }>(response);
      setAttachments((current) => current.filter((item) => item.id !== deleteId));
      toast.success("Dosya projeden kaldırıldı.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Dosya kaldırılamadı.");
    } finally {
      setDeleteId(null);
    }
  }

  const images = attachments.filter((item) => item.isImage).sort((a, b) => Number(b.isFeatured) - Number(a.isFeatured));
  const files = attachments.filter((item) => !item.isImage);

  return (
    <section className="mt-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#e8eef6] text-[#17365d]"><Paperclip className="size-4" /></span>
          <div><h3 className="font-semibold text-slate-950">Dosyalar ve görseller</h3><p className="mt-0.5 text-xs text-slate-500">Proje belgeleri, sunumlar ve görsel referanslar · Dosya başına en fazla 50 MB</p></div>
        </div>
        <div>
          <input ref={inputRef} type="file" multiple className="sr-only" onChange={(event) => void uploadFiles(event.target.files)} accept="image/jpeg,image/png,image/webp,image/gif,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,.ai,.psd,.indd" />
          <Button size="sm" variant="outline" disabled={uploading} onClick={() => inputRef.current?.click()}>{uploading ? <Loader2 className="animate-spin" /> : <Upload />}<span className="max-w-44 truncate">{uploading ? uploadProgress || "Yükleniyor" : "Dosya / Görsel Ekle"}</span></Button>
        </div>
      </div>

      <div
        role="button"
        tabIndex={uploading ? -1 : 0}
        aria-disabled={uploading}
        aria-label="Dosya veya görselleri sürükleyip bırakın ya da seçin"
        onClick={() => { if (!uploading) inputRef.current?.click(); }}
        onKeyDown={(event) => { if (!uploading && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); inputRef.current?.click(); } }}
        onDragEnter={dragEnter}
        onDragOver={(event) => { event.preventDefault(); if (!uploading) event.dataTransfer.dropEffect = "copy"; }}
        onDragLeave={dragLeave}
        onDrop={dropFiles}
        className={`mt-3 flex min-h-20 cursor-pointer items-center justify-center gap-3 rounded-xl border-2 border-dashed px-4 py-4 text-center transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2f5597]/40 ${dragging ? "border-[#2f5597] bg-blue-50 shadow-inner" : "border-slate-300 bg-white hover:border-[#2f5597]/50 hover:bg-slate-50"} ${uploading ? "cursor-wait opacity-70" : ""}`}
      >
        <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${dragging ? "bg-[#2f5597] text-white" : "bg-[#e8eef6] text-[#17365d]"}`}>{uploading ? <Loader2 className="size-5 animate-spin" /> : <Upload className="size-5" />}</span>
        <div className="min-w-0 text-left"><p className="text-sm font-semibold text-slate-800">{uploading ? uploadProgress || "Dosyalar yükleniyor" : dragging ? "Dosyaları buraya bırakın" : "Dosyaları buraya sürükleyip bırakın"}</p><p className="mt-1 text-xs text-slate-500">{uploading ? "Tamamlanana kadar bu ekranı açık tutun." : "veya tıklayarak cihazınızdan seçin · En fazla 10 dosya"}</p></div>
      </div>

      {loading ? <div className="mt-3 flex items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-white p-5 text-sm text-slate-500"><Loader2 className="size-4 animate-spin" /> Dosyalar yükleniyor</div> : attachments.length === 0 ? <div className="mt-3 rounded-xl border border-dashed border-slate-300 bg-white p-5 text-center text-sm text-slate-500">Bu işe henüz dosya veya görsel eklenmedi.</div> : <div className="mt-3 space-y-3">
        {images.length > 0 && <div className="grid gap-3 sm:grid-cols-2">{images.map((attachment) => <article key={attachment.id} className={`overflow-hidden rounded-xl border bg-white ${attachment.isFeatured ? "border-blue-400 ring-2 ring-blue-100" : "border-slate-200"}`}>
          <button type="button" className="group relative block aspect-video w-full overflow-hidden bg-slate-100" onClick={() => setPreviewAttachment(attachment)}>
            {/* Authenticated project images are served from the app's private R2 route. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/api/task-attachments?id=${encodeURIComponent(attachment.id)}&inline=1`} alt={attachment.fileName} loading="lazy" className="h-full w-full object-cover transition duration-200 group-hover:scale-[1.02]" />
            <span className="absolute bottom-2 right-2 grid size-8 place-items-center rounded-lg bg-slate-950/70 text-white"><Eye className="size-4" /></span>
            {attachment.isFeatured && <Badge className="absolute left-2 top-2 bg-[#17365d] text-white"><Presentation /> Sunum görseli</Badge>}
          </button>
          <div className="p-3"><p className="truncate text-sm font-semibold text-slate-800" title={attachment.fileName}>{attachment.fileName}</p><p className="mt-1 text-xs text-slate-500">{formatBytes(attachment.sizeBytes)} · {formatDateTime(attachment.createdAt)}</p><div className="mt-3 flex flex-wrap justify-end gap-1">{!attachment.isFeatured && <Button size="sm" variant="ghost" className="text-[#2f5597]" onClick={() => void makeFeatured(attachment.id)}><Star /> Sunumda kullan</Button>}<Button size="icon-sm" variant="ghost" asChild><a href={`/api/task-attachments?id=${encodeURIComponent(attachment.id)}`} aria-label="Görseli indir"><Download /></a></Button><Button size="icon-sm" variant="ghost" className="text-red-600" onClick={() => setDeleteId(attachment.id)} aria-label="Görseli sil"><Trash2 /></Button></div></div>
        </article>)}</div>}

        {files.length > 0 && <div className="space-y-2">{files.map((attachment) => <article key={attachment.id} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 sm:p-4">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-slate-100 text-[#17365d] [&_svg]:size-5">{fileIcon(attachment.contentType)}</span>
          <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-slate-800" title={attachment.fileName}>{attachment.fileName}</p><p className="mt-1 text-xs text-slate-500">{formatBytes(attachment.sizeBytes)} · {formatDateTime(attachment.createdAt)} · {attachment.uploadedBy || "Sait Bakırcı"}</p></div>
          <Button size="icon-sm" variant="ghost" asChild><a href={`/api/task-attachments?id=${encodeURIComponent(attachment.id)}`} aria-label={`${attachment.fileName} dosyasını indir`}><Download /></a></Button>
          <Button size="icon-sm" variant="ghost" className="text-red-600" onClick={() => setDeleteId(attachment.id)} aria-label="Dosyayı sil"><Trash2 /></Button>
        </article>)}</div>}
      </div>}

      <Dialog open={Boolean(previewAttachment)} onOpenChange={(open) => !open && setPreviewAttachment(null)}>
        <DialogContent className="max-h-[92vh] overflow-hidden p-0 sm:max-w-5xl">
          <DialogHeader className="border-b border-slate-200 px-5 py-4 pr-12">
            <DialogTitle className="truncate">{previewAttachment?.fileName || "Görsel önizleme"}</DialogTitle>
            <DialogDescription>Önizlemeyi sağ üstteki kapatma düğmesiyle kapatabilirsiniz.</DialogDescription>
          </DialogHeader>
          {previewAttachment && <div className="grid max-h-[78vh] place-items-center overflow-auto bg-slate-950 p-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/api/task-attachments?id=${encodeURIComponent(previewAttachment.id)}&inline=1`} alt={previewAttachment.fileName} className="max-h-[74vh] max-w-full object-contain" />
          </div>}
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(deleteId)} onOpenChange={(open) => !open && setDeleteId(null)}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Bu dosya kaldırılsın mı?</AlertDialogTitle><AlertDialogDescription>Dosyanın içeriği ve proje bağlantısı kalıcı olarak silinecektir. İş hafızası ve diğer proje kayıtları etkilenmez.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Vazgeç</AlertDialogCancel><AlertDialogAction variant="destructive" onClick={deleteAttachment}>Dosyayı Sil</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    </section>
  );
}
