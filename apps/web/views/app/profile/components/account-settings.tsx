"use client";

import { useState } from "react";
import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  CopyButton,
  Group,
  PasswordInput,
  Select,
  Skeleton,
  Stack,
  Switch,
  Text,
  TextInput,
  Textarea,
  Tooltip,
} from "@mantine/core";
import type { CustomerProfile } from "../types";
import { useAccountSettings } from "@/hooks/use-account-settings";
import { UploadPolicyModal } from "@/components/upload-policy-modal";
import { TermsConditionsModal } from "@/components/terms-conditions-modal";
import { SpicyConsentModal } from "@/components/spicy-consent-modal";
import { GoogleGIcon } from "@/components/google-auth-button";
import { useI18n } from "@/lib/i18n";
import Link from "next/link";
import classes from "./account-settings.module.css";

function calculateAge(dobStr?: string | null): number | null {
  if (!dobStr) return null;
  const dob = new Date(dobStr);
  if (isNaN(dob.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) {
    age--;
  }
  return age;
}

const MONTH_NAMES_SHORT = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

function formatDateDisplay(dateStr?: string | null): string {
  if (!dateStr) return "-";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const day = d.getDate();
    const month = MONTH_NAMES_SHORT[d.getMonth()] || "";
    const year = d.getFullYear();
    return `${day} ${month} ${year}`;
  } catch {
    return dateStr;
  }
}

function PencilIcon({ size = 15 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
      <path d="m15 5 4 4" />
    </svg>
  );
}

function CopyIcon({ size = 15 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
      <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
    </svg>
  );
}

function CheckIcon({ size = 15 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function InfoIcon({ size = 15 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4" />
      <path d="M12 8h.01" />
    </svg>
  );
}

function getOperatorColor(operator?: string): string {
  if (!operator) return "gray";
  if (operator.includes("Telkomsel")) return "red";
  if (operator.includes("Indosat")) return "yellow";
  if (operator.includes("XL")) return "blue";
  if (operator.includes("Smartfren")) return "pink";
  return "teal";
}

export function AccountSettings({ profile: initialProfile }: { profile?: CustomerProfile | null }) {
  const t = useI18n("profile");
  const ctrl = useAccountSettings(initialProfile);
  const [viewUploadPolicyOpened, setViewUploadPolicyOpened] = useState(false);
  const [viewSpicyPolicyOpened, setViewSpicyPolicyOpened] = useState(false);

  const formatGenderDisplay = (gender?: string | null): string => {
    if (!gender) return t("not_set");
    const lower = gender.toLowerCase();
    if (lower === "male" || lower === "laki-laki" || lower === "pria") return t("gender_male");
    if (lower === "female" || lower === "perempuan" || lower === "wanita") return t("gender_female");
    return gender;
  };

  if (ctrl.isLoading) {
    return (
      <div className={classes.container}>
        <div className={classes.cardWrapper}>
          <div className={classes.headerSection}>
            <Skeleton height={24} width={200} radius="xs" mb={8} />
            <Skeleton height={14} width="60%" radius="xs" />
          </div>
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className={classes.rowItem}>
              <Skeleton height={14} width={120} radius="xs" />
              <Skeleton height={20} width="40%" radius="xs" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={classes.container}>
      {/* Alert Notifikasi Sukses / Gagal */}
      {ctrl.saveSuccessMessage ? (
        <Alert
          color="teal"
          title={t("alert_success_title")}
          withCloseButton
          onClose={ctrl.clearMessages}
          className={classes.alertBox}
        >
          {ctrl.saveSuccessMessage}
        </Alert>
      ) : null}

      {ctrl.saveErrorMessage ? (
        <Alert
          color="red"
          title={t("alert_error_title")}
          withCloseButton
          onClose={ctrl.clearMessages}
          className={classes.alertBox}
        >
          {ctrl.saveErrorMessage}
        </Alert>
      ) : null}

      <div className={classes.cardWrapper}>
        <div className={classes.headerSection}>
          <Text className={classes.title}>{t("title")}</Text>
          <Text className={classes.subTitle}>
            {t("subtitle")}
          </Text>
        </div>

        {/* 1. EMAIL (Read-Only) */}
        <div className={classes.rowItem}>
          <Text className={classes.rowLabel}>{t("label_email")}</Text>
          <Text className={classes.rowValue}>{ctrl.profile.email}</Text>
        </div>

        {/* 2. USER ID */}
        <div className={classes.rowItem}>
          <Text className={classes.rowLabel}>{t("label_user_id")}</Text>
          <div className={classes.rowValueWrapper}>
            <Text className={classes.rowValue}>{ctrl.profile.id}</Text>
            <CopyButton value={ctrl.profile.id} timeout={2000}>
              {({ copied, copy }) => (
                <Tooltip label={copied ? t("tooltip_copied") : t("tooltip_copy_id")} withArrow position="right">
                  <ActionIcon
                    variant="subtle"
                    size="sm"
                    color={copied ? "teal" : "gray"}
                    onClick={copy}
                    aria-label={t("aria_copy_id")}
                  >
                    {copied ? <CheckIcon size={14} /> : <CopyIcon size={14} />}
                  </ActionIcon>
                </Tooltip>
              )}
            </CopyButton>
          </div>
        </div>

        {/* 3. USERNAME / NAMA LENGKAP */}
        <div className={classes.rowItem}>
          <Text className={classes.rowLabel}>{t("label_username")}</Text>
          {ctrl.editingField === "displayName" ? (
            <div className={classes.editFormWrapper}>
              <TextInput
                value={ctrl.editValues.displayName}
                onChange={(e) => ctrl.setFieldValue("displayName", e.currentTarget.value)}
                placeholder={t("placeholder_username")}
                error={ctrl.validationErrors.displayName}
                size="sm"
                maxLength={50}
                autoFocus
                disabled={ctrl.saving}
              />
              <Group gap="xs" mt={4}>
                <Button
                  size="xs"
                  color="blue"
                  onClick={() => ctrl.saveField("displayName")}
                  loading={ctrl.saving}
                >
                  {t("btn_save")}
                </Button>
                <Button
                  size="xs"
                  variant="subtle"
                  color="gray"
                  onClick={ctrl.cancelEdit}
                  disabled={ctrl.saving}
                >
                  {t("btn_cancel")}
                </Button>
              </Group>
            </div>
          ) : (
            <div className={classes.rowValueWrapper}>
              {ctrl.profile.displayName ? (
                <Text className={classes.rowValue}>{ctrl.profile.displayName}</Text>
              ) : (
                <Text className={classes.rowEmptyValue}>{t("not_set")}</Text>
              )}
              <Tooltip label={t("tooltip_edit_username")} withArrow>
                <ActionIcon
                  variant="subtle"
                  size="sm"
                  onClick={() => ctrl.startEdit("displayName")}
                  className={classes.editButton}
                  aria-label={t("aria_edit_username")}
                >
                  <PencilIcon />
                </ActionIcon>
              </Tooltip>
            </div>
          )}
        </div>

        {/* 4. JENIS KELAMIN */}
        <div className={classes.rowItem}>
          <Text className={classes.rowLabel}>{t("label_gender")}</Text>
          {ctrl.editingField === "gender" ? (
            <div className={classes.editFormWrapper}>
              <Select
                value={ctrl.editValues.gender}
                onChange={(val) => ctrl.setFieldValue("gender", val ?? "")}
                placeholder={t("placeholder_gender")}
                data={[
                  { value: "male", label: t("gender_male") },
                  { value: "female", label: t("gender_female") },
                ]}
                error={ctrl.validationErrors.gender}
                size="sm"
                disabled={ctrl.saving}
                clearable
              />
              <Group gap="xs" mt={4}>
                <Button
                  size="xs"
                  color="blue"
                  onClick={() => ctrl.saveField("gender")}
                  loading={ctrl.saving}
                >
                  {t("btn_save")}
                </Button>
                <Button
                  size="xs"
                  variant="subtle"
                  color="gray"
                  onClick={ctrl.cancelEdit}
                  disabled={ctrl.saving}
                >
                  {t("btn_cancel")}
                </Button>
              </Group>
            </div>
          ) : (
            <div className={classes.rowValueWrapper}>
              {ctrl.profile.gender ? (
                <Text className={classes.rowValue}>{formatGenderDisplay(ctrl.profile.gender)}</Text>
              ) : (
                <Text className={classes.rowEmptyValue}>{t("not_set")}</Text>
              )}
              <Tooltip label={t("tooltip_edit_gender")} withArrow>
                <ActionIcon
                  variant="subtle"
                  size="sm"
                  onClick={() => ctrl.startEdit("gender")}
                  className={classes.editButton}
                  aria-label={t("aria_edit_gender")}
                >
                  <PencilIcon />
                </ActionIcon>
              </Tooltip>
            </div>
          )}
        </div>

        {/* 4.5 TANGGAL LAHIR */}
        <div className={classes.rowItem} id="profile-row-dateOfBirth">
          <Text className={classes.rowLabel}>{t("label_dob")}</Text>
          {ctrl.editingField === "dateOfBirth" ? (
            <div className={classes.editFormWrapper}>
              <TextInput
                type="date"
                value={ctrl.editValues.dateOfBirth}
                onChange={(e) => ctrl.setFieldValue("dateOfBirth", e.currentTarget.value)}
                error={ctrl.validationErrors.dateOfBirth}
                size="sm"
                max={new Date().toISOString().slice(0, 10)}
                autoFocus
                disabled={ctrl.saving}
              />
              <Group gap="xs" mt={4}>
                <Button
                  size="xs"
                  color="blue"
                  onClick={() => ctrl.saveField("dateOfBirth")}
                  loading={ctrl.saving}
                >
                  {t("btn_save")}
                </Button>
                <Button
                  size="xs"
                  variant="subtle"
                  color="gray"
                  onClick={ctrl.cancelEdit}
                  disabled={ctrl.saving}
                >
                  {t("btn_cancel")}
                </Button>
              </Group>
            </div>
          ) : (
            <div className={classes.rowValueWrapper}>
              {ctrl.profile.dateOfBirth ? (
                <Group gap="xs" align="center">
                  <Text className={classes.rowValue}>{formatDateDisplay(ctrl.profile.dateOfBirth)}</Text>
                  {calculateAge(ctrl.profile.dateOfBirth) !== null && (
                    <Badge
                      size="xs"
                      variant="light"
                      color={(calculateAge(ctrl.profile.dateOfBirth) ?? 0) >= 18 ? "teal" : "red"}
                    >
                      {t("age_years", { age: calculateAge(ctrl.profile.dateOfBirth) ?? 0 })}
                    </Badge>
                  )}
                </Group>
              ) : (
                <Text className={classes.rowEmptyValue}>{t("not_set")}</Text>
              )}
              <Tooltip label={t("tooltip_edit_dob")} withArrow>
                <ActionIcon
                  variant="subtle"
                  size="sm"
                  onClick={() => ctrl.startEdit("dateOfBirth")}
                  className={classes.editButton}
                  aria-label={t("aria_edit_dob")}
                >
                  <PencilIcon />
                </ActionIcon>
              </Tooltip>
            </div>
          )}
        </div>

        {/* 5. NOMOR TELEPON */}
        <div className={classes.rowItem}>
          <Text className={classes.rowLabel}>{t("label_phone")}</Text>
          {ctrl.editingField === "phoneNumber" ? (
            <div className={classes.editFormWrapper}>
              <TextInput
                value={ctrl.editValues.phoneNumber}
                onChange={(e) => ctrl.setFieldValue("phoneNumber", e.currentTarget.value)}
                placeholder={t("placeholder_phone")}
                error={ctrl.validationErrors.phoneNumber}
                size="sm"
                autoFocus
                disabled={ctrl.saving}
              />

              {/* Real-time Operator Detection Badge */}
              {ctrl.phoneInfo && ctrl.phoneInfo.operator ? (
                <div className={classes.operatorBadgeGroup}>
                  <Badge
                    size="sm"
                    variant="filled"
                    color={getOperatorColor(ctrl.phoneInfo.operator)}
                  >
                    {ctrl.phoneInfo.operator}
                  </Badge>
                  {ctrl.phoneInfo.brand ? (
                    <Badge size="sm" variant="light" color="gray">
                      {ctrl.phoneInfo.brand}
                    </Badge>
                  ) : null}
                </div>
              ) : null}

              <Group gap="xs" mt={4}>
                <Button
                  size="xs"
                  color="blue"
                  onClick={() => ctrl.saveField("phoneNumber")}
                  loading={ctrl.saving}
                >
                  {t("btn_save")}
                </Button>
                <Button
                  size="xs"
                  variant="subtle"
                  color="gray"
                  onClick={ctrl.cancelEdit}
                  disabled={ctrl.saving}
                >
                  {t("btn_cancel")}
                </Button>
              </Group>
            </div>
          ) : (
            <div className={classes.rowValueWrapper}>
              {ctrl.profile.phoneNumber ? (
                <Group gap="xs" align="center">
                  <Text className={classes.rowValue}>{ctrl.profile.phoneNumber}</Text>
                  {ctrl.phoneInfo?.operator ? (
                    <Badge
                      size="xs"
                      variant="light"
                      color={getOperatorColor(ctrl.phoneInfo.operator)}
                    >
                      {ctrl.phoneInfo.operator}
                    </Badge>
                  ) : null}
                </Group>
              ) : (
                <Text className={classes.rowEmptyValue}>{t("not_set")}</Text>
              )}
              <Tooltip label={t("tooltip_edit_phone")} withArrow>
                <ActionIcon
                  variant="subtle"
                  size="sm"
                  onClick={() => ctrl.startEdit("phoneNumber")}
                  className={classes.editButton}
                  aria-label={t("aria_edit_phone")}
                >
                  <PencilIcon />
                </ActionIcon>
              </Tooltip>
            </div>
          )}
        </div>

        {/* 6. ALAMAT */}
        <div className={classes.rowItem}>
          <Text className={classes.rowLabel}>{t("label_address")}</Text>
          {ctrl.editingField === "address" ? (
            <div className={classes.editFormWrapper}>
              <Textarea
                value={ctrl.editValues.address}
                onChange={(e) => ctrl.setFieldValue("address", e.currentTarget.value)}
                placeholder={t("placeholder_address")}
                error={ctrl.validationErrors.address}
                size="sm"
                rows={3}
                maxLength={255}
                autoFocus
                disabled={ctrl.saving}
              />
              <Group gap="xs" mt={4}>
                <Button
                  size="xs"
                  color="blue"
                  onClick={() => ctrl.saveField("address")}
                  loading={ctrl.saving}
                >
                  {t("btn_save")}
                </Button>
                <Button
                  size="xs"
                  variant="subtle"
                  color="gray"
                  onClick={ctrl.cancelEdit}
                  disabled={ctrl.saving}
                >
                  {t("btn_cancel")}
                </Button>
              </Group>
            </div>
          ) : (
            <div className={classes.rowValueWrapper}>
              {ctrl.profile.address ? (
                <Text className={classes.rowValue}>{ctrl.profile.address}</Text>
              ) : (
                <Text className={classes.rowEmptyValue}>{t("not_set")}</Text>
              )}
              <Tooltip label={t("tooltip_edit_address")} withArrow>
                <ActionIcon
                  variant="subtle"
                  size="sm"
                  onClick={() => ctrl.startEdit("address")}
                  className={classes.editButton}
                  aria-label={t("aria_edit_address")}
                >
                  <PencilIcon />
                </ActionIcon>
              </Tooltip>
            </div>
          )}
        </div>

        {/* 7. PASSWORD (GANTI KATA SANDI / STATUS GOOGLE) */}
        <div className={classes.rowItem}>
          <Text className={classes.rowLabel}>{t("label_password")}</Text>
          {ctrl.profile.authProvider === "google" ? (
            <div className={classes.rowValueWrapper}>
              <Group gap="xs" align="center">
                <Badge
                  size="md"
                  variant="light"
                  color="blue"
                  leftSection={<GoogleGIcon size={14} />}
                  styles={{
                    root: {
                      textTransform: "none",
                      fontWeight: 500,
                      paddingLeft: 8,
                      paddingRight: 10,
                    },
                  }}
                >
                  {t("google_connected")}
                </Badge>
              </Group>
            </div>
          ) : ctrl.isChangingPassword ? (
            <div className={classes.editFormWrapper}>
              <PasswordInput
                label={t("label_current_password")}
                placeholder={t("placeholder_current_password")}
                value={ctrl.passwordForm.currentPassword}
                onChange={(e) => ctrl.setPasswordFormField("currentPassword", e.currentTarget.value)}
                error={ctrl.passwordErrors.currentPassword}
                size="sm"
                autoFocus
                disabled={ctrl.passwordSaving}
              />
              <PasswordInput
                label={t("label_new_password")}
                placeholder={t("placeholder_new_password")}
                value={ctrl.passwordForm.newPassword}
                onChange={(e) => ctrl.setPasswordFormField("newPassword", e.currentTarget.value)}
                error={ctrl.passwordErrors.newPassword}
                size="sm"
                disabled={ctrl.passwordSaving}
              />
              <PasswordInput
                label={t("label_confirm_new_password")}
                placeholder={t("placeholder_confirm_new_password")}
                value={ctrl.passwordForm.confirmPassword}
                onChange={(e) => ctrl.setPasswordFormField("confirmPassword", e.currentTarget.value)}
                error={ctrl.passwordErrors.confirmPassword}
                size="sm"
                disabled={ctrl.passwordSaving}
              />
              <Group gap="xs" mt={4}>
                <Button
                  size="xs"
                  color="blue"
                  onClick={ctrl.submitChangePassword}
                  loading={ctrl.passwordSaving}
                >
                  {t("btn_save_password")}
                </Button>
                <Button
                  size="xs"
                  variant="subtle"
                  color="gray"
                  onClick={ctrl.cancelChangePassword}
                  disabled={ctrl.passwordSaving}
                >
                  {t("btn_cancel")}
                </Button>
              </Group>
            </div>
          ) : (
            <div className={classes.rowValueWrapper}>
              <Text className={classes.rowValue}>••••••••</Text>
              <Tooltip label={t("tooltip_edit_password")} withArrow>
                <ActionIcon
                  variant="subtle"
                  size="sm"
                  onClick={ctrl.startChangePassword}
                  className={classes.editButton}
                  aria-label={t("aria_edit_password")}
                >
                  <PencilIcon />
                </ActionIcon>
              </Tooltip>
            </div>
          )}
        </div>

        {/* 8. KEBIJAKAN UNGGAH MEDIA */}
        <div className={classes.rowItem}>
          <Group gap={6} align="center" mb={4}>
            <Text className={classes.rowLabel}>{t("label_upload_policy")}</Text>
            <Tooltip label={t("tooltip_upload_policy")} withArrow>
              <ActionIcon
                variant="subtle"
                size="xs"
                color="gray"
                onClick={() => setViewUploadPolicyOpened(true)}
                aria-label={t("aria_upload_policy")}
              >
                <InfoIcon size={14} />
              </ActionIcon>
            </Tooltip>
          </Group>
          <div className={classes.rowValueWrapper}>
            {ctrl.profile.uploadPolicyAcceptedAt ? (
              <Group gap="xs">
                <Badge color="teal" variant="light" size="sm">
                  {t("badge_agreed")}
                </Badge>
                <Text size="xs" c="dimmed">
                  {formatDateDisplay(ctrl.profile.uploadPolicyAcceptedAt)}
                </Text>
              </Group>
            ) : (
              <Group gap="xs">
                <Badge color="yellow" variant="light" size="sm">
                  {t("badge_not_agreed")}
                </Badge>
                <Button
                  size="compact-xs"
                  variant="light"
                  color="blue"
                  onClick={() => ctrl.setPolicyModalOpened(true)}
                >
                  {t("btn_agree_now")}
                </Button>
              </Group>
            )}
          </div>
        </div>

        {/* 9. SYARAT & KETENTUAN */}
        <div className={classes.rowItem}>
          <Text className={classes.rowLabel}>{t("label_terms")}</Text>
          <div className={classes.rowValueWrapper}>
            <Group gap="xs">
              <Button
                component={Link}
                href="/terms"
                size="compact-xs"
                variant="gradient"
                gradient={{ from: "#3b82f6", to: "#8b5cf6", deg: 135 }}
                rightSection={
                  <svg
                    width={12}
                    height={12}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                    <polyline points="15 3 21 3 21 9" />
                    <line x1="10" y1="14" x2="21" y2="3" />
                  </svg>
                }
              >
                {t("btn_open_terms")}
              </Button>
              <Button
                size="compact-xs"
                variant="subtle"
                color="gray"
                onClick={() => ctrl.setTermsModalOpened(true)}
              >
                {t("btn_preview_terms")}
              </Button>
            </Group>
          </div>
        </div>

        {/* 10. SPICY MODE */}
        <div className={classes.rowItem}>
          <Group justify="space-between" align="center" wrap="nowrap">
            <div>
              <Group gap={6} align="center" mb={2}>
                <Text className={classes.rowLabel}>{t("label_spicy_mode")}</Text>
                <Tooltip label={t("tooltip_spicy_policy")} withArrow>
                  <ActionIcon
                    variant="subtle"
                    size="xs"
                    color="gray"
                    onClick={() => setViewSpicyPolicyOpened(true)}
                    aria-label={t("aria_spicy_policy")}
                  >
                    <InfoIcon size={14} />
                  </ActionIcon>
                </Tooltip>
              </Group>
              <Text size="xs" c="dimmed">
                {t("spicy_desc")}
              </Text>
            </div>
            <Switch
              checked={!!ctrl.profile.spicyModeEnabled}
              onChange={(e) => ctrl.toggleSpicyMode(e.currentTarget.checked)}
              disabled={ctrl.spicySaving}
              size="md"
              color="red"
              aria-label={t("aria_toggle_spicy")}
            />
          </Group>

          {ctrl.spicyError ? (
            <Alert
              color="red"
              variant="light"
              mt="xs"
              withCloseButton
              onClose={() => ctrl.clearMessages()}
              title={t("spicy_warning_title")}
            >
              <Group justify="space-between" align="center" wrap="wrap" gap="xs">
                <Text size="xs" style={{ flex: 1 }}>{ctrl.spicyError}</Text>
                {!ctrl.profile.dateOfBirth ? (
                  <Button
                    size="compact-xs"
                    color="red"
                    variant="filled"
                    onClick={() => {
                      ctrl.startEdit("dateOfBirth");
                      const el = document.getElementById("profile-row-dateOfBirth");
                      if (el) {
                        el.scrollIntoView({ behavior: "smooth", block: "center" });
                      }
                    }}
                  >
                    {t("btn_fill_dob")}
                  </Button>
                ) : null}
              </Group>
            </Alert>
          ) : null}
        </div>
      </div>

      <UploadPolicyModal
        opened={ctrl.policyModalOpened}
        onClose={() => ctrl.setPolicyModalOpened(false)}
        onAccept={ctrl.acceptUploadPolicy}
        loading={ctrl.policySaving}
        error={ctrl.policyError}
      />

      <UploadPolicyModal
        opened={viewUploadPolicyOpened}
        onClose={() => setViewUploadPolicyOpened(false)}
        readOnly
      />

      <TermsConditionsModal
        opened={ctrl.termsModalOpened}
        onClose={() => ctrl.setTermsModalOpened(false)}
      />

      <SpicyConsentModal
        opened={ctrl.spicyConsentModalOpened}
        onClose={() => ctrl.setSpicyConsentModalOpened(false)}
        onConfirm={ctrl.confirmSpicyConsent}
        loading={ctrl.spicySaving}
        error={ctrl.spicyError}
      />

      <SpicyConsentModal
        opened={viewSpicyPolicyOpened}
        onClose={() => setViewSpicyPolicyOpened(false)}
        readOnly
      />
    </div>
  );
}
