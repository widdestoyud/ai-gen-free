export interface EmailPort {
  sendOtp(email: string, code: string): Promise<void>;
}
