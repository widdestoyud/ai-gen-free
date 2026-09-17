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
  Stack,
  Switch,
  Text,
  TextInput,
  Textarea,
  Tooltip,
} from "@mantine/core";
import type { CustomerProfile } from "./customer-home";
import { useAccountSettings } from "@/hooks/use-account-settings";
import { UploadPolicyModal } from "@/components/upload-policy-modal";
import { TermsConditionsModal } from "@/components/terms-conditions-modal";
import { SpicyConsentModal } from "@/components/spicy-consent-modal";
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

function formatGenderDisplay(gender?: string | null): string {
  if (!gender) return "Belum diatur";
  const lower = gender.toLowerCase();
  if (lower === "male" || lower === "laki-laki" || lower === "pria") return "Laki-laki";
  if (lower === "female" || lower === "perempuan" || lower === "wanita") return "Perempuan";
  return gender;
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

export function AccountSettings({ profile: initialProfile }: { profile: CustomerProfile }) {
  const ctrl = useAccountSettings(initialProfile);
  const [viewUploadPolicyOpened, setViewUploadPolicyOpened] = useState(false);
  const [viewSpicyPolicyOpened, setViewSpicyPolicyOpened] = useState(false);

  return (
    <div className={classes.container}>
      {/* Alert Notifikasi Sukses / Gagal */}
      {ctrl.saveSuccessMessage ? (
        <Alert
          color="teal"
          title="Berhasil"
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
          title="Terjadi Kesalahan"
          withCloseButton
          onClose={ctrl.clearMessages}
          className={classes.alertBox}
        >
          {ctrl.saveErrorMessage}
        </Alert>
      ) : null}

      <div className={classes.cardWrapper}>
        <div className={classes.headerSection}>
          <Text className={classes.title}>Account Settings</Text>
          <Text className={classes.subTitle}>
            Kelola preferensi akun, identitas, nomor telepon, dan keamanan kata sandi Anda.
          </Text>
        </div>

        {/* 1. EMAIL (Read-Only) */}
        <div className={classes.rowItem}>
          <Text className={classes.rowLabel}>Email</Text>
          <Text className={classes.rowValue}>{ctrl.profile.email}</Text>
        </div>

        {/* 2. USER ID */}
        <div className={classes.rowItem}>
          <Text className={classes.rowLabel}>User ID</Text>
          <div className={classes.rowValueWrapper}>
            <Text className={classes.rowValue}>{ctrl.profile.id}</Text>
            <CopyButton value={ctrl.profile.id} timeout={2000}>
              {({ copied, copy }) => (
                <Tooltip label={copied ? "Tersalin" : "Salin User ID"} withArrow position="right">
                  <ActionIcon
                    variant="subtle"
                    size="sm"
                    color={copied ? "teal" : "gray"}
                    onClick={copy}
                    aria-label="Salin User ID"
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
          <Text className={classes.rowLabel}>Username</Text>
          {ctrl.editingField === "displayName" ? (
            <div className={classes.editFormWrapper}>
              <TextInput
                value={ctrl.editValues.displayName}
                onChange={(e) => ctrl.setFieldValue("displayName", e.currentTarget.value)}
                placeholder="Nama Pengguna / Username"
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
                  Simpan
                </Button>
                <Button
                  size="xs"
                  variant="subtle"
                  color="gray"
                  onClick={ctrl.cancelEdit}
                  disabled={ctrl.saving}
                >
                  Batal
                </Button>
              </Group>
            </div>
          ) : (
            <div className={classes.rowValueWrapper}>
              {ctrl.profile.displayName ? (
                <Text className={classes.rowValue}>{ctrl.profile.displayName}</Text>
              ) : (
                <Text className={classes.rowEmptyValue}>Belum diatur</Text>
              )}
              <Tooltip label="Ubah username" withArrow>
                <ActionIcon
                  variant="subtle"
                  size="sm"
                  onClick={() => ctrl.startEdit("displayName")}
                  className={classes.editButton}
                  aria-label="Ubah Username"
                >
                  <PencilIcon />
                </ActionIcon>
              </Tooltip>
            </div>
          )}
        </div>

        {/* 4. JENIS KELAMIN */}
        <div className={classes.rowItem}>
          <Text className={classes.rowLabel}>Jenis Kelamin</Text>
          {ctrl.editingField === "gender" ? (
            <div className={classes.editFormWrapper}>
              <Select
                value={ctrl.editValues.gender}
                onChange={(val) => ctrl.setFieldValue("gender", val ?? "")}
                placeholder="Pilih jenis kelamin"
                data={[
                  { value: "male", label: "Laki-laki" },
                  { value: "female", label: "Perempuan" },
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
                  Simpan
                </Button>
                <Button
                  size="xs"
                  variant="subtle"
                  color="gray"
                  onClick={ctrl.cancelEdit}
                  disabled={ctrl.saving}
                >
                  Batal
                </Button>
              </Group>
            </div>
          ) : (
            <div className={classes.rowValueWrapper}>
              {ctrl.profile.gender ? (
                <Text className={classes.rowValue}>{formatGenderDisplay(ctrl.profile.gender)}</Text>
              ) : (
                <Text className={classes.rowEmptyValue}>Belum diatur</Text>
              )}
              <Tooltip label="Ubah jenis kelamin" withArrow>
                <ActionIcon
                  variant="subtle"
                  size="sm"
                  onClick={() => ctrl.startEdit("gender")}
                  className={classes.editButton}
                  aria-label="Ubah Jenis Kelamin"
                >
                  <PencilIcon />
                </ActionIcon>
              </Tooltip>
            </div>
          )}
        </div>

        {/* 4.5 TANGGAL LAHIR */}
        <div className={classes.rowItem}>
          <Text className={classes.rowLabel}>Tanggal Lahir</Text>
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
                  Simpan
                </Button>
                <Button
                  size="xs"
                  variant="subtle"
                  color="gray"
                  onClick={ctrl.cancelEdit}
                  disabled={ctrl.saving}
                >
                  Batal
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
                      {calculateAge(ctrl.profile.dateOfBirth)} tahun
                    </Badge>
                  )}
                </Group>
              ) : (
                <Text className={classes.rowEmptyValue}>Belum diatur</Text>
              )}
              <Tooltip label="Ubah tanggal lahir" withArrow>
                <ActionIcon
                  variant="subtle"
                  size="sm"
                  onClick={() => ctrl.startEdit("dateOfBirth")}
                  className={classes.editButton}
                  aria-label="Ubah Tanggal Lahir"
                >
                  <PencilIcon />
                </ActionIcon>
              </Tooltip>
            </div>
          )}
        </div>

        {/* 5. NOMOR TELEPON */}
        <div className={classes.rowItem}>
          <Text className={classes.rowLabel}>Nomor Telepon</Text>
          {ctrl.editingField === "phoneNumber" ? (
            <div className={classes.editFormWrapper}>
              <TextInput
                value={ctrl.editValues.phoneNumber}
                onChange={(e) => ctrl.setFieldValue("phoneNumber", e.currentTarget.value)}
                placeholder="Contoh: 08123456789"
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
                  Simpan
                </Button>
                <Button
                  size="xs"
                  variant="subtle"
                  color="gray"
                  onClick={ctrl.cancelEdit}
                  disabled={ctrl.saving}
                >
                  Batal
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
                <Text className={classes.rowEmptyValue}>Belum diatur</Text>
              )}
              <Tooltip label="Ubah nomor telepon" withArrow>
                <ActionIcon
                  variant="subtle"
                  size="sm"
                  onClick={() => ctrl.startEdit("phoneNumber")}
                  className={classes.editButton}
                  aria-label="Ubah Nomor Telepon"
                >
                  <PencilIcon />
                </ActionIcon>
              </Tooltip>
            </div>
          )}
        </div>

        {/* 6. ALAMAT */}
        <div className={classes.rowItem}>
          <Text className={classes.rowLabel}>Alamat</Text>
          {ctrl.editingField === "address" ? (
            <div className={classes.editFormWrapper}>
              <Textarea
                value={ctrl.editValues.address}
                onChange={(e) => ctrl.setFieldValue("address", e.currentTarget.value)}
                placeholder="Alamat domisili lengkap"
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
                  Simpan
                </Button>
                <Button
                  size="xs"
                  variant="subtle"
                  color="gray"
                  onClick={ctrl.cancelEdit}
                  disabled={ctrl.saving}
                >
                  Batal
                </Button>
              </Group>
            </div>
          ) : (
            <div className={classes.rowValueWrapper}>
              {ctrl.profile.address ? (
                <Text className={classes.rowValue}>{ctrl.profile.address}</Text>
              ) : (
                <Text className={classes.rowEmptyValue}>Belum diatur</Text>
              )}
              <Tooltip label="Ubah alamat" withArrow>
                <ActionIcon
                  variant="subtle"
                  size="sm"
                  onClick={() => ctrl.startEdit("address")}
                  className={classes.editButton}
                  aria-label="Ubah Alamat"
                >
                  <PencilIcon />
                </ActionIcon>
              </Tooltip>
            </div>
          )}
        </div>

        {/* 7. PASSWORD (GANTI KATA SANDI) */}
        <div className={classes.rowItem}>
          <Text className={classes.rowLabel}>Password</Text>
          {ctrl.isChangingPassword ? (
            <div className={classes.editFormWrapper}>
              <PasswordInput
                label="Kata Sandi Lama"
                placeholder="Masukkan kata sandi saat ini"
                value={ctrl.passwordForm.currentPassword}
                onChange={(e) => ctrl.setPasswordFormField("currentPassword", e.currentTarget.value)}
                error={ctrl.passwordErrors.currentPassword}
                size="sm"
                autoFocus
                disabled={ctrl.passwordSaving}
              />
              <PasswordInput
                label="Kata Sandi Baru"
                placeholder="Minimal 8 karakter, 1 kapital & 1 angka"
                value={ctrl.passwordForm.newPassword}
                onChange={(e) => ctrl.setPasswordFormField("newPassword", e.currentTarget.value)}
                error={ctrl.passwordErrors.newPassword}
                size="sm"
                disabled={ctrl.passwordSaving}
              />
              <PasswordInput
                label="Konfirmasi Kata Sandi Baru"
                placeholder="Ulangi kata sandi baru"
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
                  Simpan Kata Sandi
                </Button>
                <Button
                  size="xs"
                  variant="subtle"
                  color="gray"
                  onClick={ctrl.cancelChangePassword}
                  disabled={ctrl.passwordSaving}
                >
                  Batal
                </Button>
              </Group>
            </div>
          ) : (
            <div className={classes.rowValueWrapper}>
              <Text className={classes.rowValue}>••••••••</Text>
              <Tooltip label="Ubah kata sandi" withArrow>
                <ActionIcon
                  variant="subtle"
                  size="sm"
                  onClick={ctrl.startChangePassword}
                  className={classes.editButton}
                  aria-label="Ubah Kata Sandi"
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
            <Text className={classes.rowLabel}>Kebijakan Upload</Text>
            <Tooltip label="Lihat klausul kebijakan upload" withArrow>
              <ActionIcon
                variant="subtle"
                size="xs"
                color="gray"
                onClick={() => setViewUploadPolicyOpened(true)}
                aria-label="Lihat klausul kebijakan upload"
              >
                <InfoIcon size={14} />
              </ActionIcon>
            </Tooltip>
          </Group>
          <div className={classes.rowValueWrapper}>
            {ctrl.profile.uploadPolicyAcceptedAt ? (
              <Group gap="xs">
                <Badge color="teal" variant="light" size="sm">
                  Disetujui
                </Badge>
                <Text size="xs" c="dimmed">
                  {formatDateDisplay(ctrl.profile.uploadPolicyAcceptedAt)}
                </Text>
              </Group>
            ) : (
              <Group gap="xs">
                <Badge color="yellow" variant="light" size="sm">
                  Belum Disetujui
                </Badge>
                <Button
                  size="compact-xs"
                  variant="light"
                  color="blue"
                  onClick={() => ctrl.setPolicyModalOpened(true)}
                >
                  Setujui Sekarang
                </Button>
              </Group>
            )}
          </div>
        </div>

        {/* 9. SYARAT & KETENTUAN */}
        <div className={classes.rowItem}>
          <Text className={classes.rowLabel}>Ketentuan Layanan</Text>
          <div className={classes.rowValueWrapper}>
            <Button
              size="compact-xs"
              variant="subtle"
              color="blue"
              onClick={() => ctrl.setTermsModalOpened(true)}
            >
              Lihat Syarat &amp; Ketentuan
            </Button>
          </div>
        </div>

        {/* 10. SPICY MODE */}
        <div className={classes.rowItem}>
          <Group justify="space-between" align="center" wrap="nowrap">
            <div>
              <Group gap={6} align="center" mb={2}>
                <Text className={classes.rowLabel}>Spicy Mode</Text>
                <Tooltip label="Lihat klausul Spicy Mode" withArrow>
                  <ActionIcon
                    variant="subtle"
                    size="xs"
                    color="gray"
                    onClick={() => setViewSpicyPolicyOpened(true)}
                    aria-label="Lihat klausul Spicy Mode"
                  >
                    <InfoIcon size={14} />
                  </ActionIcon>
                </Tooltip>
              </Group>
              <Text size="xs" c="dimmed">
                Buka akses ke model dan preset berorientasi dewasa. Memerlukan tanggal lahir (18+).
              </Text>
            </div>
            <Switch
              checked={!!ctrl.profile.spicyModeEnabled}
              onChange={(e) => ctrl.toggleSpicyMode(e.currentTarget.checked)}
              disabled={ctrl.spicySaving}
              size="md"
              color="red"
              aria-label="Toggle Spicy Mode"
            />
          </Group>
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
