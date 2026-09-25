"use client";

import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ChangeEvent,
  type DragEvent,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  AlertIcon,
  ArrowIcon,
  ArrowUpRightIcon,
  CheckIcon,
  ChevronIcon,
  CloseIcon,
  CopyIcon,
  FileIcon,
  UploadIcon,
} from "@/components/ui/Icons";
import { FrameMarks } from "@/components/visual/TechnicalFrame";
import { cn } from "@/lib/utils";

type FieldName = "fullName" | "company" | "email" | "phone" | "service" | "projectType" | "requirement" | "location" | "message";
type Values = Record<FieldName, string>;
type FieldText = { label: string; hint?: string; placeholder?: string };
type Option = { value: string; label: string };

export interface QuoteFormText {
  requiredNote: string;
  groups: { details: string; project: string; message: string };
  noscript: string;
  fields: Record<FieldName | "files", FieldText>;
  services: Option[];
  projectTypes: Option[];
  files: {
    accept: string[];
    maxFiles: number;
    maxSizeMb: number;
    choose: string;
    drop: string;
    remove: string;
    note: string;
    units: { kb: string; mb: string };
  };
  submit: string;
  errors: {
    summary: string;
    fullName: string;
    email: string;
    emailInvalid: string;
    phone: string;
    phoneInvalid: string;
    service: string;
    message: string;
    messageShort: string;
    fileType: string;
    fileSize: string;
    fileCount: string;
  };
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
}

const EMPTY: Values = {
  fullName: "",
  company: "",
  email: "",
  phone: "",
  service: "",
  projectType: "",
  requirement: "",
  location: "",
  message: "",
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_CHARS = /^[\d\s+().\-٠-٩۰-۹]+$/;

/** Arabic-Indic and Persian digits count as digits too. */
const latinDigits = (s: string) =>
  s.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660)).replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0));

const extension = (name: string) => {
  const dot = name.lastIndexOf(".");
  return dot >= 0 ? name.slice(dot).toLowerCase() : "";
};

/** Keeps a file name (usually Latin) intact inside Arabic sentences. */
const isolate = (text: string) => `⁨${text}⁩`;

/** False during server rendering and hydration, true once the client has taken over. */
const noop = () => () => {};
function useEnhanced() {
  return useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
}

function validate(values: Values, errors: QuoteFormText["errors"]) {
  const out: Partial<Record<FieldName, string>> = {};
  if (values.fullName.trim().length < 2) out.fullName = errors.fullName;
  const email = values.email.trim();
  if (!email) out.email = errors.email;
  else if (!EMAIL.test(email)) out.email = errors.emailInvalid;
  const phone = values.phone.trim();
  const digits = latinDigits(phone).replace(/\D/g, "").length;
  if (!phone) out.phone = errors.phone;
  else if (!PHONE_CHARS.test(phone) || digits < 8 || digits > 15) out.phone = errors.phoneInvalid;
  if (!values.service) out.service = errors.service;
  const message = values.message.trim();
  if (!message) out.message = errors.message;
  else if (message.length < 20) out.message = errors.messageShort;
  return out;
}

/**
 * Quote request form. There is no delivery backend in this phase, so the form
 * validates in the browser, then prepares the request for the visitor to send
 * from their own email app or WhatsApp (or copy). Nothing is uploaded, sent or
 * stored by the website, and the UI never claims otherwise.
 *
 * Without JavaScript the form falls back to a plain mailto: submission with
 * native validation; the file picker (which needs JavaScript) is hidden.
 */
export function QuoteForm({
  text,
  email,
  whatsapp,
  privacyHref,
}: {
  text: QuoteFormText;
  /** RAWASY's email address. */
  email: string;
  /** wa.me link for RAWASY's WhatsApp number, without a message. */
  whatsapp: string;
  privacyHref: string;
}) {
  const enhanced = useEnhanced();
  const [values, setValues] = useState<Values>(EMPTY);
  const [files, setFiles] = useState<{ key: string; file: File }[]>([]);
  const [fileNotices, setFileNotices] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState(false);
  /** Errors as of the last submit attempt, for the summary; inline messages stay live. */
  const [summary, setSummary] = useState<[FieldName, string][]>([]);
  const [attempt, setAttempt] = useState(0);
  const [stage, setStage] = useState<"form" | "ready">("form");
  const [copy, setCopy] = useState<"idle" | "copied" | "failed">("idle");
  const [drag, setDrag] = useState(false);

  const summaryRef = useRef<HTMLDivElement>(null);
  const readyRef = useRef<HTMLHeadingElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const summaryTextRef = useRef<HTMLTextAreaElement>(null);
  const dragDepth = useRef(0);
  const returnFocus = useRef(false);

  const errors = submitted ? validate(values, text.errors) : {};

  // Move focus to the error summary after a failed attempt, or to the prepared request.
  useEffect(() => {
    if (attempt === 0) return;
    if (stage === "ready") readyRef.current?.focus();
    else summaryRef.current?.focus();
  }, [attempt, stage]);

  useEffect(() => {
    if (stage === "form" && returnFocus.current) {
      returnFocus.current = false;
      document.getElementById("quote-fullName")?.focus();
    }
  }, [stage]);

  useEffect(() => {
    if (copy === "idle") return;
    const t = window.setTimeout(() => setCopy("idle"), 4000);
    return () => window.clearTimeout(t);
  }, [copy]);

  const set = (name: FieldName) => (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setValues((v) => ({ ...v, [name]: e.target.value }));

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    const { accept, maxFiles, maxSizeMb } = text.files;
    const notices: string[] = [];
    const next = [...files];
    for (const file of Array.from(list)) {
      if (!accept.includes(extension(file.name))) {
        notices.push(text.errors.fileType.replace("{name}", isolate(file.name)));
      } else if (file.size > maxSizeMb * 1024 * 1024) {
        notices.push(text.errors.fileSize.replace("{name}", isolate(file.name)));
      } else if (!next.some((f) => f.file.name === file.name && f.file.size === file.size)) {
        if (next.length >= maxFiles) {
          notices.push(text.errors.fileCount);
          break;
        }
        next.push({ key: `${file.name}:${file.size}:${file.lastModified}`, file });
      }
    }
    setFiles(next);
    setFileNotices(notices);
  };

  const removeFile = (key: string) => {
    setFiles((list) => list.filter((f) => f.key !== key));
    setFileNotices([]);
    fileInputRef.current?.focus();
  };

  const onDrag = (e: DragEvent<HTMLElement>) => {
    e.preventDefault();
    if (e.type === "dragenter") dragDepth.current += 1;
    if (e.type === "dragleave") dragDepth.current -= 1;
    if (e.type === "drop") dragDepth.current = 0;
    setDrag(dragDepth.current > 0 && e.type !== "drop");
    if (e.type === "drop") addFiles(e.dataTransfer.files);
  };

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const found = validate(values, text.errors);
    const list = (Object.keys(EMPTY) as FieldName[]).filter((name) => found[name]).map((name): [FieldName, string] => [name, found[name]!]);
    setSubmitted(true);
    setSummary(list);
    setAttempt((n) => n + 1);
    if (list.length === 0) {
      setCopy("idle");
      setStage("ready");
    }
  };

  const edit = () => {
    returnFocus.current = true;
    setStage("form");
  };

  // The prepared request, in the page language.
  const labelOf = (options: Option[], value: string) => options.find((o) => o.value === value)?.label ?? "";
  const service = labelOf(text.services, values.service);
  const row = (name: FieldName, value: string) => (value.trim() ? `${text.fields[name].label}: ${value.trim()}` : null);
  const request = [
    text.ready.subject,
    "",
    row("fullName", values.fullName),
    row("company", values.company),
    row("email", values.email),
    row("phone", values.phone),
    row("service", service),
    row("projectType", labelOf(text.projectTypes, values.projectType)),
    row("requirement", values.requirement),
    row("location", values.location),
    "",
    `${text.fields.message.label}:`,
    values.message.trim(),
    ...(files.length ? ["", `${text.ready.filesLine}: ${files.map((f) => f.file.name).join(", ")}`] : []),
  ]
    .filter((line): line is string => line !== null)
    .join("\n");
  const subject = [text.ready.subject, service, values.company.trim() || values.fullName.trim()].filter(Boolean).join(" — ");
  const mailto = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(request.replace(/\n/g, "\r\n"))}`;
  const whatsappHref = `${whatsapp}?text=${encodeURIComponent(request)}`;

  const copyRequest = async () => {
    try {
      await navigator.clipboard.writeText(request);
      setCopy("copied");
    } catch {
      setCopy("failed");
      summaryTextRef.current?.select();
    }
  };

  const formatSize = (bytes: number) =>
    bytes < 1024 * 1024
      ? `${Math.max(1, Math.round(bytes / 1024))} ${text.files.units.kb}`
      : `${(bytes / 1024 / 1024).toFixed(1)} ${text.files.units.mb}`;

  const describedBy = (name: FieldName) =>
    [text.fields[name].hint && `quote-${name}-hint`, errors[name] && `quote-${name}-error`].filter(Boolean).join(" ") || undefined;

  const control = (name: FieldName) => ({
    id: `quote-${name}`,
    name,
    value: values[name],
    onChange: set(name),
    "aria-invalid": errors[name] ? true : undefined,
    "aria-describedby": describedBy(name),
  });

  const [privacyBefore, privacyAfter = ""] = text.privacy.text.split("{link}");

  if (stage === "ready") {
    return (
      <div>
        <div className="border-b border-line pb-8">
          <h3 ref={readyRef} tabIndex={-1} className="t-h3 flex items-center gap-4 text-ink outline-none">
            <span aria-hidden className="grid size-9 shrink-0 place-items-center bg-accent text-[#17191a]">
              <CheckIcon size={18} />
            </span>
            {text.ready.title}
          </h3>
          <p className="t-body mt-3 max-w-[34rem]">{text.ready.body}</p>
          <div className="mt-7 flex flex-wrap gap-3">
            <a href={mailto} className="btn">
              <span className="btn-face" aria-hidden />
              <span>{text.ready.email}</span>
              <span className="btn-icon">
                <ArrowIcon size={18} className="rtl:-scale-x-100" />
              </span>
            </a>
            <a href={whatsappHref} target="_blank" rel="noopener noreferrer" className="btn btn-outline">
              <span className="btn-face" aria-hidden />
              <span>{text.ready.whatsapp}</span>
              <span className="btn-icon">
                <ArrowUpRightIcon size={18} className="rtl:-scale-x-100" />
              </span>
            </a>
            <button type="button" onClick={copyRequest} className="btn btn-outline">
              <span className="btn-face" aria-hidden />
              <span>{copy === "copied" ? text.ready.copied : text.ready.copy}</span>
              <span className="btn-icon">{copy === "copied" ? <CheckIcon size={18} /> : <CopyIcon size={18} />}</span>
            </button>
          </div>
          {/* The button already shows "Copied"; only a failure needs visible text. */}
          <p aria-live="polite" className={copy === "failed" ? "mt-4 text-[0.9rem] font-medium text-accent-ink" : "sr-only"}>
            {copy === "copied" ? text.ready.copied : copy === "failed" ? text.ready.copyFailed : ""}
          </p>
          <p className="mt-4 text-[0.9rem] text-ink-2">{text.ready.fallback}</p>
          {files.length > 0 && (
            <div className="mt-6 border-t border-line pt-5">
              <p className="text-[0.95rem] font-medium text-ink">{text.ready.attach}</p>
              <ul className="mt-3 grid gap-2">
                {files.map(({ key, file }) => (
                  <li key={key} className="flex items-center gap-3 text-[0.95rem] text-ink-2">
                    <FileIcon size={16} className="shrink-0 text-ink-3" />
                    <span className="min-w-0 truncate" dir="auto">
                      {file.name}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <div className="pt-8">
          <label htmlFor="quote-request" className="t-label text-ink-2">
            {text.ready.preview}
          </label>
          <textarea
            id="quote-request"
            ref={summaryTextRef}
            readOnly
            value={request}
            rows={12}
            dir="auto"
            className="form-control mt-3 text-[0.92rem] leading-relaxed"
          />
          <button type="button" onClick={edit} className="mt-6 inline-flex items-center gap-2.5 text-[0.95rem] font-medium text-ink">
            <ArrowIcon size={16} className="-scale-x-100 rtl:scale-x-100" />
            <span className="link-line">{text.ready.edit}</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <form
      noValidate={enhanced}
      onSubmit={onSubmit}
      action={`mailto:${email}?subject=${encodeURIComponent(text.ready.subject)}`}
      method="post"
      encType="text/plain"
      aria-describedby="quote-required"
      className="grid gap-8"
    >
      <p id="quote-required" className="text-[0.9rem] text-ink-3">
        {text.requiredNote}
      </p>
      <noscript>
        <p className="border-s-2 border-accent bg-accent-soft px-4 py-3 text-[0.95rem] text-ink-2">{text.noscript}</p>
      </noscript>

      {summary.length > 0 && (
        <div ref={summaryRef} tabIndex={-1} className="border border-line-strong border-s-[3px] border-s-accent bg-accent-soft p-5 outline-none focus-visible:outline-2 focus-visible:outline-offset-2 sm:p-6">
          <div role="alert">
            <p className="flex items-center gap-2.5 font-medium text-ink">
              <AlertIcon size={18} className="shrink-0 text-accent-ink" />
              {text.errors.summary}
            </p>
            <ul className="mt-3 grid gap-1.5 ps-7">
              {summary.map(([name, message]) => (
                <li key={name}>
                  <a
                    href={`#quote-${name}`}
                    onClick={(e) => {
                      e.preventDefault();
                      document.getElementById(`quote-${name}`)?.focus();
                    }}
                    className="link-line text-[0.95rem] text-ink-2 hover:text-ink"
                  >
                    {message}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <FieldGroup index="01" legend={text.groups.details}>
        <Field name="fullName" text={text.fields.fullName} error={errors.fullName} required>
          <input {...control("fullName")} type="text" autoComplete="name" maxLength={120} required className="form-control" />
        </Field>
        <Field name="company" text={text.fields.company}>
          <input {...control("company")} type="text" autoComplete="organization" maxLength={160} className="form-control" />
        </Field>
        <Field name="email" text={text.fields.email} error={errors.email} required>
          <input
            {...control("email")}
            type="email"
            inputMode="email"
            autoComplete="email"
            maxLength={254}
            required
            dir="ltr"
            placeholder={text.fields.email.placeholder}
            className="form-control rtl:text-right"
          />
        </Field>
        <Field name="phone" text={text.fields.phone} error={errors.phone} required>
          <input
            {...control("phone")}
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            maxLength={30}
            required
            dir="ltr"
            placeholder={text.fields.phone.placeholder}
            className="form-control rtl:text-right"
          />
        </Field>
      </FieldGroup>

      <FieldGroup index="02" legend={text.groups.project}>
        <Field name="service" text={text.fields.service} error={errors.service} required>
          <Select {...control("service")} required placeholder={text.fields.service.placeholder} options={text.services} />
        </Field>
        <Field name="projectType" text={text.fields.projectType}>
          <Select {...control("projectType")} placeholder={text.fields.projectType.placeholder} options={text.projectTypes} />
        </Field>
        <Field name="requirement" text={text.fields.requirement}>
          <input {...control("requirement")} type="text" maxLength={300} className="form-control" />
        </Field>
        <Field name="location" text={text.fields.location}>
          <input {...control("location")} type="text" autoComplete="address-level2" maxLength={120} className="form-control" />
        </Field>
      </FieldGroup>

      <FieldGroup index="03" legend={text.groups.message}>
        <Field name="message" text={text.fields.message} error={errors.message} required className="sm:col-span-2">
          <textarea {...control("message")} rows={6} maxLength={4000} required className="form-control" />
        </Field>

        <div className="js-only grid content-start gap-2 sm:col-span-2">
          <label htmlFor="quote-files" className="text-[0.95rem] font-semibold text-ink">
            {text.fields.files.label}
          </label>
          <label
            className="dropzone tf-host relative flex cursor-pointer flex-col items-center gap-3 px-6 py-8 text-center"
            data-drag={drag || undefined}
            onDragEnter={onDrag}
            onDragOver={onDrag}
            onDragLeave={onDrag}
            onDrop={onDrag}
          >
            <UploadIcon size={24} className="text-accent-ink" />
            <span className="text-[0.95rem] text-ink-2">
              <span className="link-line font-medium text-ink">{text.files.choose}</span> {text.files.drop}
            </span>
            <input
              ref={fileInputRef}
              id="quote-files"
              type="file"
              multiple
              accept={text.files.accept.join(",")}
              aria-describedby="quote-files-note"
              onChange={(e) => {
                addFiles(e.target.files);
                e.target.value = "";
              }}
              className="sr-only"
            />
            <FrameMarks lines={false} />
          </label>
          <p id="quote-files-note" className="text-[0.85rem] leading-snug text-ink-2">
            {text.files.note}
          </p>
          {files.length > 0 && (
            <ul className="mt-1 grid gap-2">
              {files.map(({ key, file }) => (
                <li key={key} className="flex items-center gap-3 border border-line bg-elevated py-2 pe-2 ps-4">
                  <FileIcon size={18} className="shrink-0 text-ink-3" />
                  <span className="min-w-0 flex-1 truncate text-[0.95rem] text-ink" dir="auto">
                    {file.name}
                  </span>
                  <span className="shrink-0 text-xs tabular-nums text-ink-2">{formatSize(file.size)}</span>
                  <button
                    type="button"
                    onClick={() => removeFile(key)}
                    aria-label={`${text.files.remove}: ${file.name}`}
                    className="grid size-9 shrink-0 place-items-center text-ink-3 transition-colors hover:text-ink"
                  >
                    <CloseIcon size={16} />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div aria-live="polite">
            {fileNotices.map((notice) => (
              <p key={notice} className="mt-1 flex items-start gap-2 text-[0.9rem] font-medium text-accent-ink">
                <AlertIcon size={16} className="mt-0.5 shrink-0" />
                {notice}
              </p>
            ))}
          </div>
        </div>
      </FieldGroup>

      <div className="rule-double flex flex-col gap-5 pt-8 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-[26rem] text-[0.9rem] text-ink-3">
          {privacyBefore}
          <a href={privacyHref} className="link-line text-ink-2 hover:text-ink">
            {text.privacy.link}
          </a>
          {privacyAfter}
        </p>
        <button type="submit" className="btn shrink-0">
          <span className="btn-face" aria-hidden />
          <span>{text.submit}</span>
          <span className="btn-icon">
            <ArrowIcon size={18} className="rtl:-scale-x-100" />
          </span>
        </button>
      </div>
    </form>
  );
}

function Field({
  name,
  text,
  error,
  required,
  className,
  children,
}: {
  name: FieldName;
  text: FieldText;
  error?: string;
  required?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("grid content-start gap-2", className)}>
      <label htmlFor={`quote-${name}`} className="text-[0.95rem] font-semibold text-ink">
        {text.label}
        {required && (
          <span aria-hidden className="text-accent-ink">
            {" *"}
          </span>
        )}
      </label>
      <div className="field-edge">{children}</div>
      {text.hint && (
        <p id={`quote-${name}-hint`} className="text-[0.85rem] leading-snug text-ink-2">
          {text.hint}
        </p>
      )}
      {error && (
        <p id={`quote-${name}-error`} className="flex items-start gap-2 text-[0.9rem] font-medium text-accent-ink">
          <AlertIcon size={16} className="mt-0.5 shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
}

/** A numbered group of fields as its own panel: a header bar, then the fields on a recessed plate. */
function FieldGroup({ index, legend, children }: { index: string; legend: string; children: ReactNode }) {
  return (
    <fieldset className="form-group min-w-0" data-tone="eng">
      <legend className="form-group-legend">
        <span aria-hidden className="form-group-index t-num">
          {index}
        </span>
        <span className="font-display text-[1.05rem] font-semibold text-ink">{legend}</span>
      </legend>
      <div className="form-group-body grid gap-x-6 gap-y-7 sm:grid-cols-2">{children}</div>
    </fieldset>
  );
}

function Select({
  options,
  placeholder,
  ...props
}: {
  id: string;
  name: string;
  value: string;
  onChange: (e: ChangeEvent<HTMLSelectElement>) => void;
  required?: boolean;
  placeholder?: string;
  options: Option[];
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
}) {
  return (
    <div className="relative">
      <select {...props} className="form-control">
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronIcon size={16} aria-hidden className="pointer-events-none absolute end-4 top-1/2 -translate-y-1/2 rotate-90 text-ink-3" />
    </div>
  );
}
