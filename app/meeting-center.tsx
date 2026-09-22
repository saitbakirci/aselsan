"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import {
  AlertTriangle, ArrowDown, ArrowUp, CalendarDays, Check, CheckCircle2, ChevronLeft, ChevronRight,
  Clipboard, FileClock, FileText, History, Image as ImageIcon, Loader2, Mail,
  Paperclip, Presentation, Save, Share2, X,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { MeetingDetail, MeetingItemRecord, MeetingRecord } from "./meeting-types";

type MeetingCenterProps = {
  selectedTasks: Array<{ id: string; title: string }>;
  onClearSelection: () => void;
};

export type MeetingCenterHandle = { openStart: () => void };

type MeetingsResponse = { meetings: MeetingRecord[] };
type ItemResponse = { item: MeetingItemRecord };

async function requestJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...options, headers: { "Content-Type": "application/json", ...(options?.headers || {}) } });
  const data = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(data.error || "İşlem tamamlanamadı.");
  return data as T;
}

function formatDate(value: string | null) {
  if (!value) return "Tarih belirlenmedi";
  return new Intl.DateTimeFormat("tr-TR", { day: "2-digit", month: "long", year: "numeric" }).format(new Date(`${value}T00:00:00`));
}

function statusTone(status: string) {
  if (status === "Tamamlandı") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "İptal Edildi") return "border-rose-200 bg-rose-50 text-rose-700";
  if (status === "Onay Bekliyor") return "border-amber-200 bg-amber-50 text-amber-700";
  if (status === "Beklemede") return "border-slate-200 bg-slate-100 text-slate-600";
  return "border-blue-200 bg-blue-50 text-blue-700";
}

function priorityTone(priority: string) {
  if (priority === "Kritik") return "border-red-200 bg-red-50 text-red-700";
  if (priority === "Yüksek") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-slate-200 bg-white text-slate-600";
}

function meetingText(detail: MeetingDetail) {
  const lines = [
    "TOPLANTI NOTU",
    detail.meeting.title,
    `Tarih: ${formatDate(detail.meeting.meetingDate)}`,
    "",
  ];
  detail.items.forEach((item, index) => {
    const task = item.snapshot.task;
    lines.push(`${index + 1}. ${item.taskTitle}`);
    lines.push(`Durum: ${task.status}`);
    if (task.followUpDate) lines.push(`Başlangıç: ${formatDate(task.followUpDate)}`);
    if (task.dueDate) lines.push(`Bitiş: ${formatDate(task.dueDate)}`);
    if (task.nextAction) lines.push(`Sonraki adım: ${task.nextAction}`);
    if (task.decision) lines.push(`Karar / onay: ${task.decision}`);
    lines.push(`Toplantı notu: ${item.note.trim() || "Not girilmedi"}`);
    if (item.snapshot.attachments.length > 0) {
      lines.push(`Ekler: ${item.snapshot.attachments.map((attachment) => attachment.fileName).join(", ")}`);
    }
    lines.push("");
  });
  if (detail.meeting.generalNotes.trim()) {
    lines.push("GENEL NOTLAR");
    lines.push(detail.meeting.generalNotes.trim());
    lines.push("");
  }
  if (detail.transcript.length > 0) {
    lines.push("ÖNCEKİ TOPLANTIDAN KALAN METİN");
    for (const segment of detail.transcript) lines.push(segment.text);
    lines.push("");
  }
  return lines.join("\n");
}

async function copyText(value: string) {
  await navigator.clipboard.writeText(value);
  toast.success("Toplantı notu kopyalandı.");
}

export const MeetingCenter = forwardRef<MeetingCenterHandle, MeetingCenterProps>(function MeetingCenter({ selectedTasks, onClearSelection }, ref) {
  const [creating, setCreating] = useState(false);
  const [orderOpen, setOrderOpen] = useState(false);
  const [orderedTaskIds, setOrderedTaskIds] = useState<string[]>([]);
  const [presentationOpen, setPresentationOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [meetingLoading, setMeetingLoading] = useState(false);
  const [meetings, setMeetings] = useState<MeetingRecord[]>([]);
  const [activeMeeting, setActiveMeeting] = useState<MeetingDetail | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const dirtyNotesRef = useRef(new Map<string, string>());
  const noteWritesRef = useRef(new Map<string, Promise<void>>());

  async function createPresentation(taskIds: string[]) {
    if (taskIds.length === 0) {
      toast.error("Sunum için en az bir hedef seçin.");
      return;
    }
    setCreating(true);
    try {
      const detail = await requestJson<MeetingDetail>("/api/meetings", { method: "POST", body: JSON.stringify({ taskIds }) });
      setActiveMeeting(detail);
      dirtyNotesRef.current.clear();
      setCurrentIndex(0);
      setPresentationOpen(true);
      setOrderOpen(false);
      onClearSelection();
      toast.success("Toplantı sunumu hazırlandı.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Sunum hazırlanamadı.");
    } finally {
      setCreating(false);
    }
  }

  function openOrder() {
    setOrderedTaskIds(selectedTasks.map((task) => task.id));
    setOrderOpen(true);
  }

  async function createStandaloneMeeting() {
    if (creating) return;
    setCreating(true);
    try {
      const detail = await requestJson<MeetingDetail>("/api/meetings", { method: "POST", body: JSON.stringify({ mode: "standalone" }) });
      setActiveMeeting(detail);
      dirtyNotesRef.current.clear();
      setCurrentIndex(0);
      setPresentationOpen(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Toplantı notu açılamadı.");
    } finally {
      setCreating(false);
    }
  }

  useImperativeHandle(ref, () => ({ openStart: () => { void createStandaloneMeeting(); } }));

  function moveSelected(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= orderedTaskIds.length) return;
    setOrderedTaskIds((current) => {
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  async function loadHistory() {
    setHistoryOpen(true);
    setHistoryLoading(true);
    try {
      const data = await requestJson<MeetingsResponse>("/api/meetings");
      setMeetings(data.meetings);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Toplantılar yüklenemedi.");
    } finally {
      setHistoryLoading(false);
    }
  }

  async function openMeeting(id: string, destination: "presentation" | "summary") {
    setMeetingLoading(true);
    try {
      const detail = await requestJson<MeetingDetail>(`/api/meetings?id=${encodeURIComponent(id)}`);
      setActiveMeeting(detail);
      dirtyNotesRef.current.clear();
      setCurrentIndex(0);
      setHistoryOpen(false);
      if (destination === "presentation") setPresentationOpen(true);
      else setSummaryOpen(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Toplantı yüklenemedi.");
    } finally {
      setMeetingLoading(false);
    }
  }

  const saveItemNote = useCallback(async (itemId: string, note: string) => {
    const previous = noteWritesRef.current.get(itemId);
    const write = (previous?.catch(() => undefined) || Promise.resolve()).then(async () => {
      const data = await requestJson<ItemResponse>("/api/meetings", { method: "PATCH", body: JSON.stringify({ action: "update_item_note", itemId, note }) });
      setActiveMeeting((current) => current ? { ...current, items: current.items.map((item) => item.id === itemId ? { ...data.item, note: dirtyNotesRef.current.get(itemId) ?? data.item.note } : item) } : current);
      if (dirtyNotesRef.current.get(itemId) === note) dirtyNotesRef.current.delete(itemId);
    });
    noteWritesRef.current.set(itemId, write);
    try {
      await write;
    } finally {
      if (noteWritesRef.current.get(itemId) === write) noteWritesRef.current.delete(itemId);
    }
  }, []);

  const updateDraftNote = useCallback((itemId: string, note: string) => {
    dirtyNotesRef.current.set(itemId, note);
    setActiveMeeting((current) => current ? { ...current, items: current.items.map((item) => item.id === itemId ? { ...item, note } : item) } : current);
  }, []);

  const flushDirtyNotes = useCallback(async () => {
    const pending = [...dirtyNotesRef.current.entries()];
    await Promise.all(pending.map(([itemId, note]) => saveItemNote(itemId, note)));
  }, [saveItemNote]);

  async function saveMeeting(values: { title?: string; generalNotes?: string; status?: "Aktif" | "Tamamlandı" }) {
    if (!activeMeeting) return null;
    const detail = await requestJson<MeetingDetail>("/api/meetings", { method: "PATCH", body: JSON.stringify({ id: activeMeeting.meeting.id, ...values }) });
    setActiveMeeting((current) => current?.meeting.id === detail.meeting.id
      ? { ...detail, items: detail.items.map((item) => ({ ...item, note: dirtyNotesRef.current.get(item.id) ?? item.note })) }
      : current);
    setMeetings((current) => current.map((meeting) => meeting.id === detail.meeting.id ? detail.meeting : meeting));
    return detail;
  }

  async function finishMeeting() {
    try {
      await flushDirtyNotes();
      await saveMeeting({ status: "Tamamlandı" });
      setPresentationOpen(false);
      setSummaryOpen(true);
      toast.success("Toplantı tamamlandı ve notlar kaydedildi.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Toplantı tamamlanamadı.");
    }
  }

  async function openEmail(detail: MeetingDetail) {
    const text = meetingText(detail);
    const subject = `Toplantı Notu | ${detail.meeting.title}`;
    if (text.length > 6500) {
      await copyText(text);
      window.location.href = `mailto:?subject=${encodeURIComponent(subject)}`;
      toast.info("Not uzun olduğu için panoya kopyalandı. Açılan e-postaya yapıştırabilirsiniz.");
      return;
    }
    window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`;
  }

  async function shareMeeting(detail: MeetingDetail) {
    const text = meetingText(detail);
    try {
      if (navigator.share) {
        await navigator.share({ title: detail.meeting.title, text });
        return;
      }
      await copyText(text);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      toast.error("Toplantı notu paylaşılamadı.");
    }
  }

  return (
    <>
      {selectedTasks.length > 0 && <Button variant="ghost" size="sm" className="text-slate-500" onClick={onClearSelection}><X /> Seçimi Temizle</Button>}
      <Button variant="outline" size="sm" className="border-slate-200 bg-white" onClick={loadHistory} aria-label="Toplantı notları"><FileClock /><span className="hidden lg:inline">Toplantı Notları</span></Button>
      <Button size="sm" className="bg-[#2f5597] text-white hover:bg-[#24477f]" disabled={creating || selectedTasks.length === 0} onClick={openOrder}>
        {creating ? <Loader2 className="animate-spin" /> : <Presentation />}
        <span className="hidden sm:inline">Sunuma Çevir</span>
        {selectedTasks.length > 0 && <span className="grid min-w-5 place-items-center rounded-full bg-white/20 px-1.5 text-xs">{selectedTasks.length}</span>}
      </Button>

      <Dialog open={orderOpen} onOpenChange={setOrderOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader><DialogTitle>Sunum Sırasını Belirle</DialogTitle><DialogDescription>Hedefleri toplantıda göstermek istediğiniz sıraya taşıyın.</DialogDescription></DialogHeader>
          <div className="space-y-2">{orderedTaskIds.map((id, index) => {
            const task = selectedTasks.find((item) => item.id === id);
            if (!task) return null;
            return <div key={id} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3">
              <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-[#17365d] text-sm font-bold text-white">{index + 1}</span>
              <p className="min-w-0 flex-1 font-medium text-slate-900">{task.title}</p>
              <Button size="icon-sm" variant="outline" disabled={index === 0} onClick={() => moveSelected(index, -1)} aria-label="Yukarı taşı"><ArrowUp /></Button>
              <Button size="icon-sm" variant="outline" disabled={index === orderedTaskIds.length - 1} onClick={() => moveSelected(index, 1)} aria-label="Aşağı taşı"><ArrowDown /></Button>
            </div>;
          })}</div>
          <DialogFooter><Button variant="outline" onClick={() => setOrderOpen(false)}>Vazgeç</Button><Button className="bg-[#17365d]" disabled={creating} onClick={() => void createPresentation(orderedTaskIds)}>{creating ? <Loader2 className="animate-spin" /> : <Presentation />} Sunumu Hazırla</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <PresentationDialog open={presentationOpen} onOpenChange={(open) => { setPresentationOpen(open); if (!open) void flushDirtyNotes().catch((error) => toast.error(error instanceof Error ? error.message : "Toplantı notu kaydedilemedi.")); }} detail={activeMeeting} currentIndex={currentIndex} setCurrentIndex={setCurrentIndex} onDraftNote={updateDraftNote} onSaveItemNote={saveItemNote} onFlushNotes={flushDirtyNotes} onSaveTitle={(title) => saveMeeting({ title })} onSaveGeneral={async (notes) => { await saveMeeting({ generalNotes: notes }); }} onOpenSummary={() => { setPresentationOpen(false); setSummaryOpen(true); void flushDirtyNotes().catch((error) => toast.error(error instanceof Error ? error.message : "Toplantı notu kaydedilemedi.")); }} onFinish={finishMeeting} />

      <MeetingHistoryDialog open={historyOpen} onOpenChange={setHistoryOpen} meetings={meetings} loading={historyLoading || meetingLoading} onOpenPresentation={(id) => openMeeting(id, "presentation")} onOpenSummary={(id) => openMeeting(id, "summary")} />

      <MeetingSummaryDialog open={summaryOpen} onOpenChange={setSummaryOpen} detail={activeMeeting} onBackToPresentation={() => { setSummaryOpen(false); setPresentationOpen(true); }} onSaveGeneral={async (generalNotes) => { await saveMeeting({ generalNotes }); }} onCopy={(detail) => copyText(meetingText(detail))} onEmail={openEmail} onShare={shareMeeting} />
    </>
  );
});

function PresentationDialog({ open, onOpenChange, detail, currentIndex, setCurrentIndex, onDraftNote, onSaveItemNote, onFlushNotes, onSaveTitle, onSaveGeneral, onOpenSummary, onFinish }: { open: boolean; onOpenChange: (open: boolean) => void; detail: MeetingDetail | null; currentIndex: number; setCurrentIndex: (index: number) => void; onDraftNote: (itemId: string, note: string) => void; onSaveItemNote: (itemId: string, note: string) => Promise<void>; onFlushNotes: () => Promise<void>; onSaveTitle: (title: string) => Promise<MeetingDetail | null>; onSaveGeneral: (notes: string) => Promise<void>; onOpenSummary: () => void; onFinish: () => Promise<void> }) {
  const item = detail?.items[currentIndex] || null;
  const standalone = Boolean(detail && detail.items.length === 0);
  const [generalNotes, setGeneralNotes] = useState(detail?.meeting.generalNotes || "");
  const [savingNotes, setSavingNotes] = useState(false);
  const savedGeneralNotesRef = useRef(detail?.meeting.generalNotes || "");
  const generalWriteRef = useRef<Promise<void>>(Promise.resolve());
  const currentMeetingIdRef = useRef(detail?.meeting.id);
  const sidebarRef = useRef<HTMLElement | null>(null);
  const slidePaneRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    currentMeetingIdRef.current = detail?.meeting.id;
    setGeneralNotes(detail?.meeting.generalNotes || "");
    savedGeneralNotesRef.current = detail?.meeting.generalNotes || "";
    generalWriteRef.current = Promise.resolve();
  }, [detail?.meeting.id]);

  useEffect(() => {
    const sidebar = sidebarRef.current;
    const button = sidebar?.querySelector<HTMLButtonElement>(`[data-slide-index="${currentIndex}"]`);
    if (!sidebar || !button) return;
    const top = button.getBoundingClientRect().top - sidebar.getBoundingClientRect().top + sidebar.scrollTop;
    const bottom = top + button.offsetHeight;
    if (top < sidebar.scrollTop + 12) sidebar.scrollTop = Math.max(0, top - 12);
    else if (bottom > sidebar.scrollTop + sidebar.clientHeight - 12) sidebar.scrollTop = bottom - sidebar.clientHeight + 12;
  }, [currentIndex, detail?.meeting.id]);

  async function saveGeneralNotes() {
    if (!standalone || generalNotes === savedGeneralNotesRef.current) return;
    const draft = generalNotes;
    const meetingId = detail?.meeting.id;
    setSavingNotes(true);
    const write = generalWriteRef.current.catch(() => undefined).then(async () => {
      await onSaveGeneral(draft);
      if (currentMeetingIdRef.current === meetingId) savedGeneralNotesRef.current = draft;
    });
    generalWriteRef.current = write;
    try {
      await write;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Toplantı notu kaydedilemedi.");
      throw error;
    } finally {
      if (generalWriteRef.current === write) setSavingNotes(false);
    }
  }

  function goTo(index: number) {
    if (!detail || index === currentIndex || index < 0 || index >= detail.items.length) return;
    setCurrentIndex(index);
    if (slidePaneRef.current) slidePaneRef.current.scrollTop = 0;
    void onFlushNotes().catch((error) => toast.error(error instanceof Error ? error.message : "Toplantı notu kaydedilemedi."));
  }

  async function openSummary() {
    if (standalone) {
      try { await saveGeneralNotes(); } catch { return; }
    }
    onOpenSummary();
  }

  async function finish() {
    if (standalone) {
      try { await saveGeneralNotes(); } catch { return; }
    }
    await onFinish();
  }

  function close() {
    if (standalone) void saveGeneralNotes().catch(() => undefined);
    onOpenChange(false);
  }

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open, standalone, generalNotes, onOpenChange]);

  if (!open) return null;
  return (
    <>
      <div className="fixed inset-0 z-[59] bg-black/70" aria-hidden="true" />
      <div role="dialog" aria-modal="true" aria-label={standalone ? "Toplantı notu" : "Toplantı sunumu"} className="meeting-fullscreen-safe fixed inset-0 z-[60] h-dvh w-screen overflow-hidden bg-[#071425]">
        {detail && (item || standalone) ? (
          <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)]">
            <header className="flex min-h-16 flex-wrap items-center justify-between gap-2 border-b border-white/10 bg-[#0b1f38] px-3 py-3 text-white sm:px-6">
              <div className="min-w-0 flex-1"><Input key={detail.meeting.id} defaultValue={detail.meeting.title} onBlur={(event) => { const value = event.target.value.trim(); if (value && value !== detail.meeting.title) void onSaveTitle(value); }} className="h-9 max-w-xl border-white/10 bg-white/5 text-base font-semibold text-white shadow-none" aria-label="Toplantı başlığı" /><p className="mt-1 hidden text-xs text-slate-300 sm:block">{formatDate(detail.meeting.meetingDate)} · {standalone ? "Bağımsız toplantı notu" : `${detail.items.length} gündem maddesi`}</p></div>
              <div className="flex items-center gap-1.5 sm:gap-2"><Button size="sm" variant="outline" className="border-white/20 bg-transparent px-2 text-white hover:bg-white/10 hover:text-white" onClick={() => void openSummary()} aria-label="Toplantı özetini aç"><Clipboard /><span className="hidden sm:inline">Toplantı Özeti</span></Button>{detail.meeting.status !== "Tamamlandı" && <Button size="sm" className="bg-emerald-600 px-2 text-white hover:bg-emerald-700" onClick={() => void finish()}><CheckCircle2 /> <span className="hidden sm:inline">Toplantıyı Bitir</span></Button>}<Button size="icon-sm" variant="ghost" className="text-white hover:bg-white/10 hover:text-white" onClick={close} aria-label="Toplantıyı kapat"><X /></Button></div>
            </header>
            {standalone ? <div className="min-h-0 overflow-y-auto bg-slate-100 p-3 sm:p-6">
              <section className="mx-auto flex min-h-full max-w-3xl flex-col rounded-2xl bg-white p-4 shadow-sm sm:p-6">
                <h2 className="text-lg font-semibold text-[#17365d]">Genel toplantı notu</h2>
                <p className="mt-1 text-sm text-slate-500">Kararları, sorumluları ve sonraki adımları yazın.</p>
                <Textarea value={generalNotes} onChange={(event) => setGeneralNotes(event.target.value)} onBlur={() => { void saveGeneralNotes().catch(() => undefined); }} placeholder="Toplantı notlarını buraya yazın..." className="mt-4 min-h-[45vh] flex-1 resize-y border-slate-300 bg-slate-50 text-base leading-6" />
                <div className="mt-4 flex items-center justify-between gap-3"><span className="text-xs text-slate-500">{savingNotes ? "Kaydediliyor..." : "Yazmayı bitirdiğinizde kaydedilir"}</span><Button variant="outline" onClick={() => void saveGeneralNotes().catch(() => undefined)}><Save /> Kaydet</Button></div>
              </section>
            </div> : item ? <div className="flex min-h-0">
              <aside ref={sidebarRef} className="hidden h-full min-h-0 w-64 shrink-0 overflow-y-auto overscroll-contain border-r border-white/10 bg-[#091a2f] p-3 lg:block">
                <p className="px-2 pb-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Gündem</p>
                <div className="space-y-1">{detail.items.map((meetingItem, index) => <button key={meetingItem.id} type="button" data-slide-index={index} aria-current={currentIndex === index ? "step" : undefined} onClick={() => goTo(index)} className={`flex w-full items-start gap-3 rounded-lg px-3 py-3 text-left transition ${currentIndex === index ? "bg-white text-[#17365d]" : "text-slate-300 hover:bg-white/5"}`}><span className={`grid size-6 shrink-0 place-items-center rounded-md text-xs font-bold ${currentIndex === index ? "bg-[#17365d] text-white" : "bg-white/10"}`}>{index + 1}</span><span className="line-clamp-3 text-sm font-medium leading-5">{meetingItem.taskTitle}</span></button>)}</div>
              </aside>
              <div className="grid min-w-0 flex-1 grid-rows-[minmax(0,1fr)_auto]">
                <div ref={slidePaneRef} className="min-h-0 overflow-y-auto overscroll-contain p-3 sm:p-5 lg:p-7"><MeetingSlide item={item} /></div>
                <NoteEditor key={item.id} item={item} index={currentIndex} total={detail.items.length} onPrevious={() => void goTo(Math.max(0, currentIndex - 1))} onNext={() => void goTo(Math.min(detail.items.length - 1, currentIndex + 1))} onDraft={onDraftNote} onSave={onSaveItemNote} />
              </div>
            </div> : null}
          </div>
        ) : <div className="grid h-full place-items-center text-white"><Loader2 className="size-8 animate-spin" /></div>}
      </div>
    </>
  );
}

function MeetingSlide({ item }: { item: MeetingItemRecord }) {
  const { task, subtasks, history, documents, attachments } = item.snapshot;
  const completed = subtasks.filter((subtask) => subtask.status === "Tamamlandı").length;
  const currentDocument = documents.find((document) => document.isCurrent) || documents[0];
  const featuredImage = attachments.find((attachment) => attachment.isImage && attachment.isFeatured) || attachments.find((attachment) => attachment.isImage);
  return (
    <article className="mx-auto min-h-full max-w-6xl rounded-2xl bg-white px-5 py-6 shadow-2xl sm:px-8 sm:py-8 lg:px-12 lg:py-10">
      <div className="border-b-2 border-[#2f5597] pb-5">
        <div className="flex flex-wrap items-center gap-2"><Badge variant="outline" className={priorityTone(task.priority)}>{task.priority}</Badge><Badge variant="outline" className={statusTone(task.status)}>{task.status}</Badge><span className="text-sm text-slate-500">{task.category}</span></div>
        <h2 className="mt-4 max-w-5xl text-2xl font-bold leading-tight tracking-[-0.025em] text-[#17365d] sm:text-3xl lg:text-4xl">{task.title}</h2>
        <p className="mt-2 text-base text-slate-500">{task.owner || "Sorumlu belirlenmedi"}</p>
      </div>

      <div className="mt-6 grid gap-7 lg:grid-cols-[1.05fr_.95fr]">
        <div className="space-y-6">
          <SlideSection title="Sonraki net aksiyon"><p className="text-lg font-medium leading-7 text-slate-900">{task.nextAction || "Sonraki aksiyon belirlenmedi"}</p></SlideSection>
          <SlideSection title="Beklenen karar / onay"><p className="text-base leading-7 text-slate-700">{task.decision || "Karar beklenmiyor"}</p></SlideSection>
          {task.risk && <SlideSection title="Risk / bağımlılık" tone="red"><div className="flex items-start gap-2 text-base leading-7 text-red-800"><AlertTriangle className="mt-1 size-4 shrink-0" />{task.risk}</div></SlideSection>}
          <div className="flex flex-wrap gap-x-6 gap-y-2 border-t border-slate-200 pt-4 text-sm text-slate-500">{task.followUpDate && <span className="inline-flex items-center gap-2"><CalendarDays className="size-4" /> Başlangıç: {formatDate(task.followUpDate)}</span>}<span className="inline-flex items-center gap-2"><CalendarDays className="size-4" /> Bitiş: {formatDate(task.dueDate)}</span></div>
        </div>

        <div className="space-y-6">
          {featuredImage && <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
            {/* Authenticated project images are served from the app's private R2 route. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/api/task-attachments?id=${encodeURIComponent(featuredImage.id)}&inline=1`} alt={featuredImage.fileName} className="max-h-56 w-full object-contain" />
            <div className="flex items-center gap-2 border-t border-slate-200 bg-white px-3 py-2 text-xs text-slate-500"><ImageIcon className="size-3.5" /> {featuredImage.fileName}</div>
          </div>}
          <SlideSection title={`Alt iş paketleri${subtasks.length ? ` (${completed}/${subtasks.length} tamamlandı)` : ""}`}>
            {subtasks.length === 0 ? <p className="text-base text-slate-500">Alt iş tanımlanmadı.</p> : <div className="max-h-72 divide-y divide-slate-200 overflow-y-auto pr-2">{subtasks.map((subtask) => <div key={subtask.id} className="flex items-start justify-between gap-3 py-2.5"><div className="min-w-0"><p className="text-base font-medium leading-6 text-slate-800">{subtask.title}</p>{subtask.nextAction && <p className="mt-0.5 text-sm text-slate-500">{subtask.nextAction}</p>}</div><span className={`mt-0.5 shrink-0 rounded-full border px-2 py-1 text-xs font-medium ${statusTone(subtask.status)}`}>{subtask.status}</span></div>)}</div>}
          </SlideSection>
          {history.length > 0 && <SlideSection title="Son gelişmeler"><div className="space-y-3">{history.slice(0, 3).map((entry) => <div key={entry.id} className="border-l-2 border-slate-200 pl-3"><div className="flex items-center gap-2"><span className="text-xs font-semibold text-[#2f5597]">{entry.kind}</span><span className="text-xs text-slate-400">{formatDate(entry.eventDate)}</span></div><p className="mt-1 text-sm font-medium leading-5 text-slate-700">{entry.title}</p></div>)}</div></SlideSection>}
          {currentDocument && <div className="flex items-start gap-3 border-t border-slate-200 pt-4"><FileText className="mt-0.5 size-5 shrink-0 text-[#2f5597]" /><div><p className="text-sm font-semibold text-slate-800">Güncel doküman</p><p className="mt-1 text-sm text-slate-600">{currentDocument.documentName || currentDocument.title}{currentDocument.documentVersion ? ` · ${currentDocument.documentVersion}` : ""}</p></div></div>}
          {attachments.length > 0 && <div className="flex items-start gap-3 border-t border-slate-200 pt-4"><Paperclip className="mt-0.5 size-5 shrink-0 text-[#2f5597]" /><div><p className="text-sm font-semibold text-slate-800">Proje ekleri · {attachments.length}</p><p className="mt-1 line-clamp-2 text-sm text-slate-600">{attachments.slice(0, 4).map((attachment) => attachment.fileName).join(" · ")}{attachments.length > 4 ? ` · +${attachments.length - 4}` : ""}</p></div></div>}
        </div>
      </div>
    </article>
  );
}

function SlideSection({ title, tone = "blue", children }: { title: string; tone?: "blue" | "red"; children: React.ReactNode }) {
  return <section><h3 className={`mb-2 text-sm font-bold uppercase tracking-[0.12em] ${tone === "red" ? "text-red-700" : "text-[#2f5597]"}`}>{title}</h3>{children}</section>;
}

function NoteEditor({ item, index, total, onPrevious, onNext, onDraft, onSave }: { item: MeetingItemRecord; index: number; total: number; onPrevious: () => void; onNext: () => void; onDraft: (itemId: string, note: string) => void; onSave: (itemId: string, note: string) => Promise<void> }) {
  const [draft, setDraft] = useState(item.note);
  const [saveState, setSaveState] = useState<"Kaydedildi" | "Kaydediliyor" | "Hata">("Kaydedildi");
  const timerRef = useRef<number | null>(null);

  useEffect(() => () => { if (timerRef.current) window.clearTimeout(timerRef.current); }, []);

  async function persist(value: string) {
    try {
      await onSave(item.id, value);
      setSaveState("Kaydedildi");
    } catch (error) {
      setSaveState("Hata");
      toast.error(error instanceof Error ? error.message : "Toplantı notu kaydedilemedi.");
    }
  }

  function changeNote(value: string) {
    setDraft(value);
    onDraft(item.id, value);
    setSaveState("Kaydediliyor");
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => { void persist(value); }, 700);
  }

  function saveNow() {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    if (draft !== item.note) void persist(draft);
  }

  return (
    <section className="border-t border-slate-200 bg-white px-3 py-3 sm:px-5">
      <div className="mx-auto flex max-w-6xl flex-col gap-2">
        <div className="flex items-center justify-between gap-3"><div><h3 className="text-sm font-semibold text-[#17365d]">Toplantı notu · Bu hedef</h3><p className="hidden text-xs text-slate-500 sm:block">Kararları, yeni aksiyonları ve sorumluları buraya yazın.</p></div><div className="flex items-center gap-2"><span className={`hidden items-center gap-1 text-xs sm:inline-flex ${saveState === "Hata" ? "text-red-600" : "text-slate-500"}`}>{saveState === "Kaydedildi" ? <Check className="size-3.5" /> : saveState === "Kaydediliyor" ? <Loader2 className="size-3.5 animate-spin" /> : <AlertTriangle className="size-3.5" />}{saveState}</span><Button size="icon-sm" variant="outline" disabled={index === 0} onClick={onPrevious} aria-label="Önceki slayt"><ChevronLeft /></Button><span className="min-w-14 text-center text-sm font-semibold text-slate-600">{index + 1} / {total}</span><Button size="icon-sm" variant="outline" disabled={index === total - 1} onClick={onNext} aria-label="Sonraki slayt"><ChevronRight /></Button></div></div>
        <Textarea value={draft} onChange={(event) => changeNote(event.target.value)} onBlur={saveNow} placeholder="Toplantı sırasında alınan notlar..." className="min-h-20 resize-y border-slate-300 bg-slate-50 text-base leading-6" />
      </div>
    </section>
  );
}

function MeetingHistoryDialog({ open, onOpenChange, meetings, loading, onOpenPresentation, onOpenSummary }: { open: boolean; onOpenChange: (open: boolean) => void; meetings: MeetingRecord[]; loading: boolean; onOpenPresentation: (id: string) => void; onOpenSummary: (id: string) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="meeting-modal-safe max-h-[88vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader><DialogTitle>Toplantı Notları Geçmişi</DialogTitle><DialogDescription>Hazırlanan sunumlar ve toplantı sırasında kaydedilen notlar tarih sırasıyla saklanır.</DialogDescription></DialogHeader>
        {loading ? <div className="grid min-h-48 place-items-center text-slate-500"><Loader2 className="size-6 animate-spin" /></div> : meetings.length === 0 ? <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center"><FileClock className="mx-auto size-9 text-slate-400" /><p className="mt-3 text-sm text-slate-500">Henüz toplantı kaydı bulunmuyor.</p></div> : <div className="space-y-3">{meetings.map((meeting) => <article key={meeting.id} className="rounded-xl border border-slate-200 p-4"><div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center"><div><div className="flex flex-wrap items-center gap-2"><Badge variant="outline" className={meeting.status === "Tamamlandı" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-blue-200 bg-blue-50 text-blue-700"}>{meeting.status}</Badge><span className="text-xs text-slate-500">{formatDate(meeting.meetingDate)} · {meeting.selectedTaskCount ? `${meeting.selectedTaskCount} gündem` : "Bağımsız not"}</span></div><h3 className="mt-2 font-semibold text-slate-900">{meeting.title}</h3></div><div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={() => onOpenSummary(meeting.id)}><Clipboard /> Notları Gör</Button><Button size="sm" className="bg-[#17365d]" onClick={() => onOpenPresentation(meeting.id)}>{meeting.selectedTaskCount ? <Presentation /> : <FileText />}{meeting.selectedTaskCount ? "Sunumu Aç" : "Notu Aç"}</Button></div></div></article>)}</div>}
        <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Kapat</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MeetingSummaryDialog({ open, onOpenChange, detail, onBackToPresentation, onSaveGeneral, onCopy, onEmail, onShare }: { open: boolean; onOpenChange: (open: boolean) => void; detail: MeetingDetail | null; onBackToPresentation: () => void; onSaveGeneral: (notes: string) => Promise<void>; onCopy: (detail: MeetingDetail) => void; onEmail: (detail: MeetingDetail) => void; onShare: (detail: MeetingDetail) => void }) {
  const [generalNotes, setGeneralNotes] = useState(detail?.meeting.generalNotes || "");
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    setGeneralNotes(detail?.meeting.generalNotes || "");
  }, [detail?.meeting.id]);
  if (!detail) return null;
  const workingDetail = { ...detail, meeting: { ...detail.meeting, generalNotes } };

  async function saveGeneral() {
    setSaving(true);
    try {
      await onSaveGeneral(generalNotes);
      toast.success("Genel toplantı notu kaydedildi.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Not kaydedilemedi.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="meeting-summary-safe max-h-[92vh] gap-0 overflow-hidden p-0 sm:max-w-3xl">
        <div className="grid max-h-[92vh] min-h-0 grid-rows-[auto_minmax(0,1fr)_auto] sm:h-auto sm:max-h-[92vh] max-sm:h-full max-sm:max-h-none">
          <DialogHeader className="flex flex-row items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 text-left sm:px-6">
            <div className="min-w-0"><DialogTitle className="truncate">{detail.meeting.title}</DialogTitle><DialogDescription>{formatDate(detail.meeting.meetingDate)} · {detail.items.length ? `${detail.items.length} gündem maddesi` : "Bağımsız not"} · {detail.meeting.status}</DialogDescription></div>
            <Button size="icon-sm" variant="outline" className="shrink-0" onClick={() => onOpenChange(false)} aria-label="Toplantı özetini kapat"><X /></Button>
          </DialogHeader>
          <div className="min-h-0 space-y-6 overflow-y-auto overscroll-contain bg-slate-50 px-4 py-5 sm:px-6">
            {detail.items.length > 0 && <section className="space-y-3"><div className="flex items-center gap-2 text-sm font-semibold text-[#17365d]"><History className="size-4" /> Gündem notları</div>{detail.items.map((item, index) => <article key={item.id} className="rounded-xl border border-slate-200 bg-white p-4"><div className="flex items-start gap-3"><span className="grid size-7 shrink-0 place-items-center rounded-lg bg-[#17365d] text-xs font-bold text-white">{index + 1}</span><div className="min-w-0"><h3 className="font-semibold text-slate-900">{item.taskTitle}</h3><p className="mt-1 text-xs text-slate-500">{item.snapshot.task.status} · Sonraki adım: {item.snapshot.task.nextAction || "Belirlenmedi"}</p><p className={`mt-3 whitespace-pre-wrap text-sm leading-6 ${item.note.trim() ? "text-slate-700" : "italic text-slate-400"}`}>{item.note.trim() || "Bu gündem maddesi için toplantı notu girilmedi."}</p></div></div></article>)}</section>}
            <section className="space-y-2 rounded-xl border border-slate-200 bg-white p-4"><div className="flex items-center justify-between gap-2"><div><h3 className="text-sm font-semibold text-[#17365d]">Genel toplantı notu</h3><p className="text-xs text-slate-500">Ortak kararlar, toplantı sonrası işler veya katılımcı notları</p></div><Button size="sm" variant="outline" disabled={saving} onClick={() => void saveGeneral()}>{saving ? <Loader2 className="animate-spin" /> : <Save />} Kaydet</Button></div><Textarea value={generalNotes} onChange={(event) => setGeneralNotes(event.target.value)} onBlur={() => { if (generalNotes !== detail.meeting.generalNotes) void saveGeneral(); }} className="min-h-28 text-base leading-6" placeholder="Toplantının genel değerlendirmesi..." /></section>
            {detail.transcript.length > 0 && <details className="rounded-xl border border-slate-200 bg-white p-4"><summary className="cursor-pointer text-sm font-semibold text-slate-700">Önceki toplantıdan kalan metin ({detail.transcript.length})</summary><div className="mt-3 max-h-60 space-y-2 overflow-y-auto border-t border-slate-100 pt-3">{detail.transcript.map((entry) => <p key={entry.id} className="whitespace-pre-wrap text-sm leading-6 text-slate-600">{entry.text}</p>)}</div></details>}
          </div>
          <DialogFooter className="grid grid-cols-2 gap-2 border-t border-slate-200 bg-white px-4 py-3 sm:flex sm:flex-wrap sm:px-6"><Button variant="outline" onClick={() => onOpenChange(false)}>Kapat</Button><Button variant="outline" onClick={onBackToPresentation}>{detail.items.length ? <Presentation /> : <FileText />}{detail.items.length ? "Sunuma Dön" : "Notlara Dön"}</Button><Button variant="outline" onClick={() => onCopy(workingDetail)}><Clipboard /> Kopyala</Button><Button variant="outline" onClick={() => onShare(workingDetail)}><Share2 /> Paylaş</Button><Button className="col-span-2 bg-[#17365d] sm:col-span-1" onClick={() => onEmail(workingDetail)}><Mail /> E-posta Taslağı</Button></DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
