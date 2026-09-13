"use client";

import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  CopyButton,
  Group,
  PasswordInput,
  Stack,
  Text,
  TextInput,
  Textarea,
  Tooltip,
} from "@mantine/core";
import type { CustomerProfile } from "./customer-home";
import { useAccountSettings } from "@/hooks/use-account-settings";
import classes from "./account-settings.module.css";

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

        {/* 4. NOMOR TELEPON */}
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

        {/* 5. ALAMAT */}
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

        {/* 6. PASSWORD (GANTI KATA SANDI) */}
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
      </div>
    </div>
  );
}
