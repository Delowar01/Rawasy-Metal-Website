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
import { cn } from "@/lib/utils";
import { Icon } from "../Icon";
import { FormIcon } from "./FormIcon";

/*
 * The quote form in the Modern Commerce design (Stage TM-2.2): everything from `type FieldName` to the privacy line is
 * the previous design's form code (src/components/contact/QuoteForm.tsx, retired in TM-2.6), unchanged — fields,
 * validation, file rules, focus handling, and the email, WhatsApp and copied text. Only the markup's classes, icons and
 * wrappers differ (styles: "Contact page" in system.css). e2e/commerce-contact.spec.ts holds its golden outputs.
 */

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
      <div className="qf-ready">
        <div className="qf-ready-head">
          <h3 ref={readyRef} tabIndex={-1} className="qf-ready-title">
            <span aria-hidden className="qf-ready-mark">
              <Icon name="check" size={18} />
            </span>
            {text.ready.title}
          </h3>
          <p className="qf-ready-body">{text.ready.body}</p>
          <div className="qf-actions">
            <a href={mailto} className="btn btn-primary">
              <span>{text.ready.email}</span>
              <Icon name="arrow" size={18} />
            </a>
            <a href={whatsappHref} target="_blank" rel="noopener noreferrer" className="btn btn-secondary">
              <span>{text.ready.whatsapp}</span>
              <Icon name="arrow-up-right" size={18} />
            </a>
            <button type="button" onClick={copyRequest} className="btn btn-secondary">
              <span>{copy === "copied" ? text.ready.copied : text.ready.copy}</span>
              {copy === "copied" ? <Icon name="check" size={18} /> : <FormIcon name="copy" size={18} />}
            </button>
          </div>
          {/* The button already shows "Copied"; only a failure needs visible text. */}
          <p aria-live="polite" className={copy === "failed" ? "qf-copy-failed" : "sr-only"}>
            {copy === "copied" ? text.ready.copied : copy === "failed" ? text.ready.copyFailed : ""}
          </p>
          <p className="qf-fallback">{text.ready.fallback}</p>
          {files.length > 0 && (
            <div className="qf-attach">
              <p className="qf-attach-title">{text.ready.attach}</p>
              <ul className="qf-attach-list">
                {files.map(({ key, file }) => (
                  <li key={key}>
                    <FormIcon name="file" size={16} />
                    <span className="min-w-0 truncate" dir="auto">
                      {file.name}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <div className="qf-ready-summary">
          <label htmlFor="quote-request" className="qf-label">
            {text.ready.preview}
          </label>
          <textarea id="quote-request" ref={summaryTextRef} readOnly value={request} rows={12} dir="auto" className="field qf-summary-text" />
          <button type="button" onClick={edit} className="qf-edit">
            <span className="qf-back">
              <Icon name="arrow" size={16} />
            </span>
            <span>{text.ready.edit}</span>
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
      className="qf"
    >
      <p id="quote-required" className="qf-required">
        {text.requiredNote}
      </p>
      <noscript>
        <p className="qf-noscript">{text.noscript}</p>
      </noscript>

      {summary.length > 0 && (
        <div ref={summaryRef} tabIndex={-1} className="qf-summary">
          <div role="alert">
            <p className="qf-summary-title">
              <FormIcon name="alert" size={18} />
              {text.errors.summary}
            </p>
            <ul className="qf-summary-list">
              {summary.map(([name, message]) => (
                <li key={name}>
                  <a
                    href={`#quote-${name}`}
                    onClick={(e) => {
                      e.preventDefault();
                      document.getElementById(`quote-${name}`)?.focus();
                    }}
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
          <input {...control("fullName")} type="text" autoComplete="name" maxLength={120} required className="field" />
        </Field>
        <Field name="company" text={text.fields.company}>
          <input {...control("company")} type="text" autoComplete="organization" maxLength={160} className="field" />
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
            className="field rtl:text-right"
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
            className="field rtl:text-right"
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
          <input {...control("requirement")} type="text" maxLength={300} className="field" />
        </Field>
        <Field name="location" text={text.fields.location}>
          <input {...control("location")} type="text" autoComplete="address-level2" maxLength={120} className="field" />
        </Field>
      </FieldGroup>

      <FieldGroup index="03" legend={text.groups.message}>
        <Field name="message" text={text.fields.message} error={errors.message} required className="sm:col-span-2">
          <textarea {...control("message")} rows={6} maxLength={4000} required className="field qf-textarea" />
        </Field>

        {/* The file picker needs JavaScript: hidden without it (the mailto fallback cannot carry files). */}
        <div className="qf-files sm:col-span-2" data-js-only>
          <label htmlFor="quote-files" className="qf-label">
            {text.fields.files.label}
          </label>
          <label
            className="qf-drop"
            data-drag={drag || undefined}
            onDragEnter={onDrag}
            onDragOver={onDrag}
            onDragLeave={onDrag}
            onDrop={onDrag}
          >
            <span className="qf-drop-icon">
              <FormIcon name="upload" size={22} />
            </span>
            <span className="qf-drop-text">
              <span className="qf-drop-choose">{text.files.choose}</span> {text.files.drop}
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
          </label>
          <p id="quote-files-note" className="qf-hint">
            {text.files.note}
          </p>
          {files.length > 0 && (
            <ul className="qf-file-list">
              {files.map(({ key, file }) => (
                <li key={key} className="qf-file">
                  <FormIcon name="file" size={18} />
                  <span className="qf-file-name" dir="auto">
                    {file.name}
                  </span>
                  <span className="qf-file-size">{formatSize(file.size)}</span>
                  <button
                    type="button"
                    onClick={() => removeFile(key)}
                    aria-label={`${text.files.remove}: ${file.name}`}
                    className="qf-file-remove"
                  >
                    <Icon name="close" size={16} />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div aria-live="polite">
            {fileNotices.map((notice) => (
              <p key={notice} className="qf-error">
                <FormIcon name="alert" size={16} />
                {notice}
              </p>
            ))}
          </div>
        </div>
      </FieldGroup>

      <div className="qf-foot">
        <p className="qf-privacy">
          {privacyBefore}
          <a href={privacyHref}>{text.privacy.link}</a>
          {privacyAfter}
        </p>
        <button type="submit" className="btn btn-primary btn-lg shrink-0">
          <span>{text.submit}</span>
          <Icon name="arrow" size={18} />
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
    <div className={cn("qf-field", className)}>
      <label htmlFor={`quote-${name}`} className="qf-label">
        {text.label}
        {required && (
          <span aria-hidden className="qf-req">
            {" *"}
          </span>
        )}
      </label>
      <div className="qf-control">{children}</div>
      {text.hint && (
        <p id={`quote-${name}-hint`} className="qf-hint">
          {text.hint}
        </p>
      )}
      {error && (
        <p id={`quote-${name}-error`} className="qf-error">
          <FormIcon name="alert" size={16} />
          {error}
        </p>
      )}
    </div>
  );
}

/** A numbered group of fields: a fieldset whose legend carries the step number and the group's name. */
function FieldGroup({ index, legend, children }: { index: string; legend: string; children: ReactNode }) {
  return (
    <fieldset className="qf-group">
      <legend className="qf-legend">
        <span aria-hidden className="qf-index">
          {index}
        </span>
        <span>{legend}</span>
      </legend>
      <div className="qf-grid">{children}</div>
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
    <div className="qf-select">
      <select {...props} className="field">
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <Icon name="chevron" size={16} className="qf-select-arrow" />
    </div>
  );
}
