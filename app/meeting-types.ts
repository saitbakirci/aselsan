export type MeetingStatus = "Aktif" | "Tamamlandı";
export type MeetingCaptureStatus = "Hazır" | "Dinleniyor" | "Duraklatıldı" | "Tamamlandı";
export type TranscriptClarity = "Net" | "Belirsiz";

export type MeetingTranscriptSegment = {
  id: string;
  meetingId: string;
  sequence: number;
  elapsedSeconds: number;
  capturedAt: string;
  text: string;
  confidencePct: number | null;
  clarity: TranscriptClarity;
  source: string;
  createdAt: string;
  updatedAt: string;
};

export type MeetingTaskSummary = {
  id: string;
  title: string;
  category: string;
  priority: string;
  status: string;
  dueDate: string | null;
  followUpDate: string | null;
  owner: string;
  nextAction: string;
  decision: string;
  risk: string;
};

export type MeetingMemorySummary = {
  id: string;
  taskId: string;
  kind: string;
  title: string;
  detail: string;
  eventDate: string;
  documentName: string | null;
  documentVersion: string | null;
  documentUrl: string | null;
  isCurrent: boolean;
};

export type MeetingAttachmentSummary = {
  id: string;
  taskId: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  isImage: boolean;
  isFeatured: boolean;
  createdAt: string;
};

export type MeetingTaskSnapshot = {
  task: MeetingTaskSummary;
  subtasks: MeetingTaskSummary[];
  history: MeetingMemorySummary[];
  documents: MeetingMemorySummary[];
  attachments: MeetingAttachmentSummary[];
};

export type MeetingItemRecord = {
  id: string;
  meetingId: string;
  taskId: string | null;
  sortOrder: number;
  taskTitle: string;
  snapshot: MeetingTaskSnapshot;
  note: string;
  createdAt: string;
  updatedAt: string;
};

export type MeetingRecord = {
  id: string;
  title: string;
  meetingDate: string;
  status: MeetingStatus;
  captureStatus: MeetingCaptureStatus;
  captureStartedAt: string | null;
  captureEndedAt: string | null;
  generalNotes: string;
  selectedTaskCount: number;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
};

export type MeetingDetail = {
  meeting: MeetingRecord;
  items: MeetingItemRecord[];
  transcript: MeetingTranscriptSegment[];
};
