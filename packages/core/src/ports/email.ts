export interface EmailPort {
  sendOtp(email: string, code: string): Promise<void>;
  sendVerificationEmail(email: string, token: string, verifyUrl?: string): Promise<void>;
  sendPasswordResetEmail(email: string, token: string, resetUrl?: string): Promise<void>;
}

