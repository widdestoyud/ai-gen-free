"use client";

import { useState } from "react";
import {
  validateIndonesianPhoneNumber,
  validatePasswordFormat,
  type IndonesianPhoneInfo,
} from "@/lib/validation";
import { requestJson } from "@/lib/api";
import type { CustomerProfile } from "@/views/app/profile/components/customer-home";

export type EditableField = "displayName" | "phoneNumber" | "address" | "ktp";

function getFieldSuccessMessage(field: EditableField): string {
  switch (field) {
    case "displayName":
      return "Username berhasil diubah.";
    case "phoneNumber":
      return "Nomor telepon berhasil diubah.";
    case "address":
      return "Alamat berhasil diubah.";
    case "ktp":
      return "Nomor KTP berhasil diubah.";
    default:
      return "Profil berhasil diperbarui.";
  }
}

export interface PasswordFormState {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export interface AccountSettingsState {
  profile: CustomerProfile;
  editingField: EditableField | null;
  editValues: {
    displayName: string;
    phoneNumber: string;
    address: string;
    ktp: string;
  };
  validationErrors: Partial<Record<EditableField, string>>;
  phoneInfo: IndonesianPhoneInfo | null;
  saving: boolean;
  saveSuccessMessage: string;
  saveErrorMessage: string;

  // Change Password state
  isChangingPassword: boolean;
  passwordForm: PasswordFormState;
  passwordErrors: Partial<Record<keyof PasswordFormState, string>>;
  passwordSaving: boolean;

  startEdit: (field: EditableField) => void;
  cancelEdit: () => void;
  setFieldValue: (field: EditableField, value: string) => void;
  saveField: (field: EditableField) => Promise<boolean>;

  startChangePassword: () => void;
  cancelChangePassword: () => void;
  setPasswordFormField: (field: keyof PasswordFormState, value: string) => void;
  submitChangePassword: () => Promise<boolean>;

  clearMessages: () => void;
}

export function useAccountSettings(initialProfile: CustomerProfile): AccountSettingsState {
  const [profile, setProfile] = useState<CustomerProfile>(initialProfile);
  const [editingField, setEditingField] = useState<EditableField | null>(null);
  const [editValues, setEditValues] = useState({
    displayName: initialProfile.displayName ?? "",
    phoneNumber: initialProfile.phoneNumber ?? "",
    address: initialProfile.address ?? "",
    ktp: initialProfile.ktp ?? "",
  });
  const [validationErrors, setValidationErrors] = useState<Partial<Record<EditableField, string>>>({});
  const [phoneInfo, setPhoneInfo] = useState<IndonesianPhoneInfo | null>(() => {
    return initialProfile.phoneNumber ? validateIndonesianPhoneNumber(initialProfile.phoneNumber) : null;
  });
  const [saving, setSaving] = useState(false);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState("");
  const [saveErrorMessage, setSaveErrorMessage] = useState("");

  // Change Password states
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordForm, setPasswordForm] = useState<PasswordFormState>({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [passwordErrors, setPasswordErrors] = useState<Partial<Record<keyof PasswordFormState, string>>>({});
  const [passwordSaving, setPasswordSaving] = useState(false);

  function clearMessages() {
    setSaveSuccessMessage("");
    setSaveErrorMessage("");
  }

  function startEdit(field: EditableField) {
    clearMessages();
    setEditingField(field);
    const currentValue = profile[field] ?? "";
    setEditValues((prev) => ({ ...prev, [field]: currentValue }));
    setValidationErrors((prev) => ({ ...prev, [field]: undefined }));

    if (field === "phoneNumber" && currentValue) {
      setPhoneInfo(validateIndonesianPhoneNumber(currentValue));
    }
  }

  function cancelEdit() {
    setEditingField(null);
    setValidationErrors({});
    if (profile.phoneNumber) {
      setPhoneInfo(validateIndonesianPhoneNumber(profile.phoneNumber));
    } else {
      setPhoneInfo(null);
    }
  }

  function validateField(field: EditableField, value: string): string | undefined {
    const trimmed = value.trim();

    if (field === "displayName") {
      if (trimmed.length > 50) {
        return "Nama tampilan maksimal 50 karakter.";
      }
      return undefined;
    }

    if (field === "phoneNumber") {
      if (!trimmed) {
        return undefined; // Boleh dikosongkan
      }
      const phoneValidation = validateIndonesianPhoneNumber(trimmed);
      setPhoneInfo(phoneValidation);
      if (!phoneValidation.valid) {
        return phoneValidation.error ?? "Nomor telepon tidak valid.";
      }
      return undefined;
    }

    if (field === "ktp") {
      if (!trimmed) return undefined;
      if (!/^\d{16}$/.test(trimmed)) {
        return "Nomor KTP harus terdiri dari 16 digit angka.";
      }
      return undefined;
    }

    if (field === "address") {
      if (trimmed.length > 255) {
        return "Alamat maksimal 255 karakter.";
      }
      return undefined;
    }

    return undefined;
  }

  function setFieldValue(field: EditableField, value: string) {
    setEditValues((prev) => ({ ...prev, [field]: value }));
    const error = validateField(field, value);
    setValidationErrors((prev) => ({ ...prev, [field]: error }));

    if (field === "phoneNumber") {
      if (value.trim()) {
        const info = validateIndonesianPhoneNumber(value.trim());
        setPhoneInfo(info);
      } else {
        setPhoneInfo(null);
      }
    }
  }

  async function saveField(field: EditableField): Promise<boolean> {
    clearMessages();
    const value = editValues[field];
    const error = validateField(field, value);
    if (error) {
      setValidationErrors((prev) => ({ ...prev, [field]: error }));
      return false;
    }

    setSaving(true);
    const body: Record<string, string> = {
      [field]: value.trim(),
    };

    const res = await requestJson<{ ok: boolean; user: CustomerProfile; message?: string }>(
      "/api/customer/profile",
      {
        method: "PATCH",
        body: JSON.stringify(body),
      }
    );

    setSaving(false);

    if (!res.ok) {
      setSaveErrorMessage(res.message ?? "Gagal memperbarui data profil.");
      return false;
    }

    if (res.data?.user) {
      setProfile((prev) => ({
        ...prev,
        ...res.data.user,
      }));
    } else {
      setProfile((prev) => ({
        ...prev,
        [field]: value.trim() || null,
      }));
    }

    setSaveSuccessMessage(getFieldSuccessMessage(field));
    setEditingField(null);
    setValidationErrors({});
    return true;
  }

  function startChangePassword() {
    clearMessages();
    setIsChangingPassword(true);
    setPasswordForm({
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    });
    setPasswordErrors({});
  }

  function cancelChangePassword() {
    setIsChangingPassword(false);
    setPasswordForm({
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    });
    setPasswordErrors({});
  }

  function setPasswordFormField(field: keyof PasswordFormState, value: string) {
    const updated = { ...passwordForm, [field]: value };
    setPasswordForm(updated);

    const errors: Partial<Record<keyof PasswordFormState, string>> = { ...passwordErrors };

    if (field === "currentPassword") {
      errors.currentPassword = value ? undefined : "Kata sandi lama wajib diisi.";
    }

    if (field === "newPassword") {
      const check = validatePasswordFormat(value);
      errors.newPassword = check.valid ? undefined : check.message;
      if (updated.confirmPassword && value !== updated.confirmPassword) {
        errors.confirmPassword = "Konfirmasi kata sandi tidak cocok.";
      } else if (updated.confirmPassword) {
        errors.confirmPassword = undefined;
      }
    }

    if (field === "confirmPassword") {
      if (!value) {
        errors.confirmPassword = "Konfirmasi kata sandi wajib diisi.";
      } else if (value !== updated.newPassword) {
        errors.confirmPassword = "Konfirmasi kata sandi tidak cocok.";
      } else {
        errors.confirmPassword = undefined;
      }
    }

    setPasswordErrors(errors);
  }

  async function submitChangePassword(): Promise<boolean> {
    clearMessages();

    // Validasi form
    const errors: Partial<Record<keyof PasswordFormState, string>> = {};
    if (!passwordForm.currentPassword) {
      errors.currentPassword = "Kata sandi lama wajib diisi.";
    }

    const newPassCheck = validatePasswordFormat(passwordForm.newPassword);
    if (!newPassCheck.valid) {
      errors.newPassword = newPassCheck.message;
    } else if (passwordForm.newPassword === passwordForm.currentPassword) {
      errors.newPassword = "Kata sandi baru tidak boleh sama dengan kata sandi lama.";
    }

    if (!passwordForm.confirmPassword) {
      errors.confirmPassword = "Konfirmasi kata sandi wajib diisi.";
    } else if (passwordForm.confirmPassword !== passwordForm.newPassword) {
      errors.confirmPassword = "Konfirmasi kata sandi tidak cocok.";
    }

    if (Object.keys(errors).some((k) => !!errors[k as keyof PasswordFormState])) {
      setPasswordErrors(errors);
      return false;
    }

    setPasswordSaving(true);
    const res = await requestJson<{ ok: boolean; message?: string }>("/api/customer/password-change", {
      method: "POST",
      body: JSON.stringify({
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      }),
    });
    setPasswordSaving(false);

    if (!res.ok) {
      setSaveErrorMessage(res.message ?? "Gagal mengubah kata sandi.");
      return false;
    }

    setSaveSuccessMessage(res.data?.message ?? "Kata sandi berhasil diubah.");
    cancelChangePassword();
    return true;
  }

  return {
    profile,
    editingField,
    editValues,
    validationErrors,
    phoneInfo,
    saving,
    saveSuccessMessage,
    saveErrorMessage,

    isChangingPassword,
    passwordForm,
    passwordErrors,
    passwordSaving,

    startEdit,
    cancelEdit,
    setFieldValue,
    saveField,

    startChangePassword,
    cancelChangePassword,
    setPasswordFormField,
    submitChangePassword,

    clearMessages,
  };
}
