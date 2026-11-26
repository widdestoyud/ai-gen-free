"use client";

import { useRef, useState, type ChangeEvent, type DragEvent, type KeyboardEvent } from "react";
import { Badge, Button, Group, Loader, Text, TextInput } from "@mantine/core";
import { ErrorAlert } from "@/components/error-alert";
import { requestJson } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import type { TemplateAssetValue } from "../types";
import classes from "./template-image-picker.module.css";

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const ALLOWED_EXT_RE = /\.(jpe?g|png|webp)$/i;

function UploadIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  );
}

export type TemplateImagePickerProps = {
  value: TemplateAssetValue | null;
  onChange: (value: TemplateAssetValue | null) => void;
  label: string;
  required?: boolean;
  disabled?: boolean;
  error?: string | null;
};

export function TemplateImagePicker({
  value,
  onChange,
  label,
  required = false,
  disabled = false,
  error,
}: TemplateImagePickerProps) {
  const t = useI18n("admin");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [localError, setLocalError] = useState("");
  const [errorCode, setErrorCode] = useState<string | undefined>(undefined);
  const [errorTxId, setErrorTxId] = useState<string | undefined>(undefined);

  const isLocked = disabled || uploading;

  const clearError = () => {
    setLocalError("");
    setErrorCode(undefined);
    setErrorTxId(undefined);
  };

  const uploadFile = async (file: File) => {
    const validType =
      ALLOWED_TYPES.has(file.type.toLowerCase()) ||
      (!file.type && ALLOWED_EXT_RE.test(file.name));
    if (!validType) {
      setLocalError(t("templates.error_file_type"));
      setErrorCode(undefined);
      setErrorTxId(undefined);
      return;
    }
    if (file.size <= 0 || file.size > MAX_FILE_BYTES) {
      setLocalError(t("templates.error_file_size"));
      setErrorCode(undefined);
      setErrorTxId(undefined);
      return;
    }

    clearError();
    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);

    const res = await requestJson<TemplateAssetValue>("/api/admin/templates/assets", {
      method: "POST",
      body: formData,
    });
    setUploading(false);

    if (!res.ok) {
      setLocalError(res.message || t("templates.error_asset_upload"));
      setErrorCode(res.code);
      setErrorTxId(res.transaction_id);
      return;
    }

    onChange(res.data);
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.currentTarget.files?.[0];
    e.currentTarget.value = "";
    if (!file || isLocked) return;
    void uploadFile(file);
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isLocked) {
      setDragging(true);
    }
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(false);
    if (isLocked) return;
    const file = e.dataTransfer.files?.[0];
    if (file) {
      void uploadFile(file);
    }
  };

  const handleDropzoneClick = () => {
    if (isLocked) return;
    fileInputRef.current?.click();
  };

  const handleDropzoneKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleDropzoneClick();
    }
  };

  const handleFetchUrl = async () => {
    const trimmed = urlInput.trim();
    if (!trimmed || !/^https?:\/\//i.test(trimmed)) {
      setLocalError(t("templates.error_url_invalid"));
      setErrorCode(undefined);
      setErrorTxId(undefined);
      return;
    }

    clearError();
    setUploading(true);
    const res = await requestJson<TemplateAssetValue>("/api/admin/templates/assets", {
      method: "POST",
      body: JSON.stringify({ sourceUrl: trimmed }),
    });
    setUploading(false);

    if (!res.ok) {
      setLocalError(res.message || t("templates.error_asset_upload"));
      setErrorCode(res.code);
      setErrorTxId(res.transaction_id);
      return;
    }

    setUrlInput("");
    onChange(res.data);
  };

  const displayError = localError || error || "";

  return (
    <div className={classes.wrapper}>
      <div className={classes.labelRow}>
        <Text component="label" className={classes.label}>
          {label}
          {required ? <span className={classes.requiredMark}>*</span> : null}
        </Text>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className={classes.hiddenInput}
        disabled={isLocked}
        onChange={handleFileChange}
      />

      {value ? (
        <div className={classes.previewCard}>
          <div className={classes.previewInfo}>
            <div className={classes.previewThumbWrap}>
              <img src={value.url} alt={label} className={classes.previewImg} />
            </div>
            <div className={classes.previewMeta}>
              <Group gap="xs">
                <Badge size="xs" variant="light" color="blue">
                  {value.width} × {value.height} px
                </Badge>
                {uploading ? <Loader size="xs" /> : null}
              </Group>
              <Text size="xs" c="dimmed" className={classes.keyText} title={value.key}>
                {value.key}
              </Text>
            </div>
          </div>

          <Group gap="xs">
            <Button
              type="button"
              size="xs"
              variant="light"
              disabled={isLocked}
              loading={uploading}
              onClick={handleDropzoneClick}
            >
              {t("templates.btn_replace_image")}
            </Button>
            <Button
              type="button"
              size="xs"
              variant="subtle"
              color="red"
              disabled={isLocked}
              onClick={() => {
                clearError();
                onChange(null);
              }}
            >
              {t("templates.btn_remove_image")}
            </Button>
          </Group>
        </div>
      ) : (
        <>
          <div
            role="button"
            tabIndex={isLocked ? -1 : 0}
            aria-label={label}
            aria-disabled={isLocked}
            className={`${classes.dropzone} ${dragging ? classes.dropzoneDragging : ""} ${
              isLocked ? classes.dropzoneDisabled : ""
            }`}
            onClick={handleDropzoneClick}
            onKeyDown={handleDropzoneKeyDown}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            {uploading ? (
              <Group gap="xs">
                <Loader size="sm" />
                <Text size="xs" c="dimmed">
                  {t("templates.uploading_asset")}
                </Text>
              </Group>
            ) : (
              <>
                <span className={classes.dropzoneIcon}>
                  <UploadIcon />
                </span>
                <Text size="xs" fw={500}>
                  {t("templates.dropzone_hint")}
                </Text>
                <Text size="xs" c="dimmed">
                  {t("templates.dropzone_formats")}
                </Text>
              </>
            )}
          </div>

          <div className={classes.urlRow}>
            <TextInput
              size="xs"
              className={classes.urlInput}
              label={t("templates.paste_url_label")}
              placeholder={t("templates.paste_url_placeholder")}
              value={urlInput}
              disabled={isLocked}
              onChange={(e) => setUrlInput(e.currentTarget.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void handleFetchUrl();
                }
              }}
            />
            <Button
              type="button"
              size="xs"
              variant="light"
              disabled={isLocked || !urlInput.trim()}
              loading={uploading}
              onClick={() => void handleFetchUrl()}
            >
              {t("templates.btn_fetch_url")}
            </Button>
          </div>
        </>
      )}

      <ErrorAlert message={displayError} code={errorCode} transactionId={errorTxId} />
    </div>
  );
}
