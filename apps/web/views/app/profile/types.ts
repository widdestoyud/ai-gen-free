export type CustomerProfile = {
  id: string;
  email: string;
  displayName: string | null;
  phoneNumber: string | null;
  ktp: string | null;
  address: string | null;
  gender: string | null;
  authProvider?: "password" | "google";
  avatarUrl?: string | null;
  uploadPolicyAcceptedAt?: string | null;
  hasUploads?: boolean;
  dateOfBirth?: string | null;
  spicyModeAcceptedAt?: string | null;
  spicyModeEnabled?: boolean;
};
