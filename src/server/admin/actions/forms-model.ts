/**
 * What the forms and enquiry screens (A7) and their client components share: the actions' answers and the form models.
 * Types and plain data only (client components may import nothing else from the server).
 */

export interface IssueModel {
  path: string;
  message: string;
}

export type FormsActionState =
  | { status: "idle" }
  | { status: "ok"; message: string; lockVersion?: number }
  | { status: "error"; message: string; issues: IssueModel[]; stale?: true; stepUp?: true };

export type ExportState =
  | { status: "idle" }
  | { status: "ok"; message: string; filename: string; csv: string }
  | { status: "error"; message: string; stepUp?: true };

export type LocaleKey = "en" | "ar";

export interface CopyModel {
  requiredNote: string;
  groups: { details: string; project: string; message: string };
  noscript: string;
  submit: string;
  serviceOther: string;
  files: { choose: string; drop: string; remove: string; note: string; units: { kb: string; mb: string } };
  errors: { summary: string; fileType: string; fileSize: string; fileCount: string };
  ready: {
    title: string;
    body: string;
    email: string;
    whatsapp: string;
    copy: string;
    copied: string;
    copyFailed: string;
    attach: string;
    filesLine: string;
    fallback: string;
    edit: string;
    subject: string;
    preview: string;
  };
  privacy: { text: string; link: string };
  consent: { label: string; error: string };
}

export interface FieldTextsModel {
  label: string;
  placeholder: string;
  hint: string;
  optionLabels: Record<string, string>;
  errorRequired: string;
  errorInvalid: string;
}

export interface FieldModelView {
  id: string;
  key: string;
  type: string;
  group: "details" | "project" | "message";
  isRequired: boolean;
  requiredLocked: boolean;
  bounds: { floor: number; ceiling: number } | null;
  minLength: number | null;
  maxLength: number | null;
  options: string[] | null;
  texts: Record<LocaleKey, FieldTextsModel>;
}

export interface FormSettingsModel {
  isEnabled: boolean;
  deliveryMode: "handoff" | "store" | "store_and_notify";
  notificationEmails: string[];
  retentionDays: number | null;
  honeypotEnabled: boolean;
  minFillSeconds: number;
  consentMode: "notice" | "checkbox";
  acceptFiles: boolean;
  maxFiles: number;
  maxFileMb: number;
  acceptedExtensions: string[];
}

export interface FormEditorModel {
  id: string;
  key: string;
  lockVersion: number;
  settings: FormSettingsModel;
  copy: Record<LocaleKey, CopyModel>;
  status: Record<LocaleKey, "draft" | "complete" | "needs_review" | null>;
  fields: FieldModelView[];
  /** What the viewer may change (decided again by the server). */
  can: { edit: boolean; ownerSettings: boolean; retention: boolean };
  limits: { minFill: [number, number]; maxFiles: [number, number]; maxFileMb: [number, number]; retention: [number, number]; emails: number; extensions: string[] };
}

export interface TransitionModel {
  to: "new" | "open" | "answered" | "closed";
  label: string;
  noteRequired: boolean;
}
