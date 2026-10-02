"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Clock3, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { formatEffort } from "@/lib/task-planning";

type TimeEntry = { id: string; taskId: string; workDate: string; minutes: number; note: string; createdAt: string };

function localDateKey() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("tr-TR", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(year, month - 1, day));
}

async function requestJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...options, headers: { "Content-Type": "application/json", ...(options?.headers || {}) } });
  const payload = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(payload.error || "İşlem tamamlanamadı.");
  return payload;
}

export function TaskTimePanel({ taskId, estimatedMinutes, onChanged }: { taskId: string; estimatedMinutes: number; onChanged: () => void }) {
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [workDate, setWorkDate] = useState(localDateKey());
  const [hours, setHours] = useState("0");
  const [minutes, setMinutes] = useState("30");
  const [note, setNote] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const payload = await requestJson<{ entries: TimeEntry[] }>(`/api/task-time?taskId=${encodeURIComponent(taskId)}`);
      setEntries(payload.entries);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Süre geçmişi yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const actual = useMemo(() => entries.reduce((sum, entry) => sum + entry.minutes, 0), [entries]);
  const percent = estimatedMinutes > 0 ? Math.min(100, Math.round(actual / estimatedMinutes * 100)) : 0;

  async function save() {
    const total = Math.max(0, Number(hours) || 0) * 60 + Math.max(0, Number(minutes) || 0);
    if (total < 1) { toast.error("En az 1 dakikalık süre girin."); return; }
    setSaving(true);
    try {
      const payload = await requestJson<{ entry: TimeEntry }>("/api/task-time", { method: "POST", body: JSON.stringify({ taskId, workDate, minutes: total, note }) });
      setEntries((current) => [payload.entry, ...current]);
      setHours("0"); setMinutes("30"); setNote("");
      onChanged();
      toast.success("Çalışma süresi kaydedildi.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Süre kaydedilemedi.");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    try {
      await requestJson<{ deleted: boolean }>("/api/task-time", { method: "DELETE", body: JSON.stringify({ id }) });
      setEntries((current) => current.filter((entry) => entry.id !== id));
      onChanged();
      toast.success("Süre kaydı silindi.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Süre kaydı silinemedi.");
    }
  }

  return <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
    <div className="flex items-center justify-between gap-3"><div><h3 className="flex items-center gap-2 font-semibold text-slate-950"><Clock3 className="size-4 text-[#2f5597]" /> Zaman ve Efor</h3><p className="mt-1 text-sm text-slate-500">Tahmin ile gün gün gerçekleşen çalışma süresini karşılaştırın.</p></div><Button size="sm" className="bg-[#17365d]" onClick={() => setExpanded((current) => !current)}><Plus /> Süre Gir</Button></div>
    <div className="mt-4 grid grid-cols-3 gap-2 text-center"><Metric label="Tahmin" value={formatEffort(estimatedMinutes)} /><Metric label="Gerçekleşen" value={loading ? "…" : formatEffort(actual)} /><Metric label="Kalan" value={loading ? "…" : formatEffort(Math.max(0, estimatedMinutes - actual))} /></div>
    <div className="mt-3 flex items-center gap-3"><Progress value={percent} className="flex-1" /><span className="text-sm font-bold text-[#17365d]">%{percent}</span></div>
    {expanded && <div className="mt-4 grid gap-3 rounded-xl bg-slate-50 p-3 sm:grid-cols-4"><div className="space-y-2 sm:col-span-2"><Label>Çalışma günü</Label><Input type="date" value={workDate} onChange={(event) => setWorkDate(event.target.value)} /></div><div className="space-y-2"><Label>Saat</Label><Input type="number" min="0" max="24" value={hours} onChange={(event) => setHours(event.target.value)} /></div><div className="space-y-2"><Label>Dakika</Label><Input type="number" min="0" max="59" value={minutes} onChange={(event) => setMinutes(event.target.value)} /></div><div className="space-y-2 sm:col-span-4"><Label>Ne yapıldı?</Label><Textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Yapılan çalışmayı kısa biçimde yazın." /></div><Button className="bg-[#17365d] sm:col-span-4" disabled={saving} onClick={save}>{saving ? <Loader2 className="animate-spin" /> : <Plus />} Kaydet</Button></div>}
    {!loading && entries.length > 0 && <div className="mt-4 divide-y divide-slate-100 border-t border-slate-100">{entries.slice(0, 8).map((entry) => <div key={entry.id} className="flex items-start justify-between gap-3 py-3"><div><p className="text-sm font-semibold text-slate-800">{formatDate(entry.workDate)} · {formatEffort(entry.minutes)}</p><p className="mt-1 text-sm text-slate-500">{entry.note || "Açıklama girilmedi"}</p></div><Button size="icon-sm" variant="ghost" className="text-red-600" onClick={() => remove(entry.id)}><Trash2 /></Button></div>)}</div>}
  </section>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">{label}</p><p className="mt-1 text-sm font-bold text-[#17365d]">{value}</p></div>;
}
