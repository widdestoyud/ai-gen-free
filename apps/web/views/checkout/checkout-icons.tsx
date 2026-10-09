import React from "react";

export function SparkCoinIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" fill="currentColor" fillOpacity="0.2" />
    </svg>
  );
}

export function HexagonCoinIcon({ size = 14 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" fill="none" strokeWidth="2" />
      <circle cx="12" cy="12" r="3" fill="currentColor" />
    </svg>
  );
}

export function ArrowLeftIcon({ size = 16 }: { size?: number }) {
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
      aria-hidden="true"
    >
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="12 19 5 12 12 5" />
    </svg>
  );
}

export function CloseIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

export function DanaLogo({ active = false }: { active?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <svg width="20" height="20" viewBox="0 0 32 32" fill="none">
        <circle cx="16" cy="16" r="15" fill={active ? "#ffffff" : "#118eea"} />
        <path
          d="M10 16L14.5 20.5L22 13"
          stroke={active ? "#0081df" : "#ffffff"}
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span
        style={{
          color: "#ffffff",
          fontWeight: 800,
          fontSize: 16,
          letterSpacing: 0.5,
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
      >
        DANA
      </span>
    </div>
  );
}

export function ShopeePayLogo({ active = false }: { active?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <rect width="24" height="24" rx="4" fill={active ? "#ffffff" : "#ee4d2d"} />
        <path
          d="M7 9C7 6.23858 9.23858 4 12 4C14.7614 4 17 6.23858 17 9V10H7V9Z"
          stroke={active ? "#ee4d2d" : "#ffffff"}
          strokeWidth="1.8"
        />
        <rect x="5" y="9" width="14" height="11" rx="2" fill={active ? "#ee4d2d" : "#ffffff"} />
        <path
          d="M10 13.5C10 12.6716 10.6716 12 11.5 12H12.5C13.3284 12 14 12.6716 14 13.5C14 14.3284 13.3284 15 12.5 15H11.5C10.6716 15 10 15.6716 10 16.5C10 17.3284 10.6716 18 11.5 18H12.5C13.3284 18 14 17.3284 14 16.5"
          stroke={active ? "#ffffff" : "#ee4d2d"}
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
      <span
        style={{
          color: active ? "#ffffff" : "#ff9900",
          fontWeight: 700,
          fontSize: 13,
          letterSpacing: -0.2,
        }}
      >
        <span style={{ color: active ? "#ffffff" : "#ee4d2d" }}>S</span>Pay | SPayLater
      </span>
    </div>
  );
}

export function GopayLogo({ active = false }: { active?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="11" fill={active ? "#ffffff" : "#00aed6"} />
        <circle cx="12" cy="12" r="5" fill={active ? "#0081df" : "#ffffff"} />
      </svg>
      <span
        style={{
          color: active ? "#ffffff" : "#00aed6",
          fontWeight: 800,
          fontSize: 15,
          letterSpacing: -0.3,
        }}
      >
        gopay
      </span>
    </div>
  );
}

export function QrisLogo({ active = false }: { active?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="3" width="7" height="7" fill={active ? "#ffffff" : "currentColor"} />
        <rect x="14" y="3" width="7" height="7" fill={active ? "#ffffff" : "currentColor"} />
        <rect x="3" y="14" width="7" height="7" fill={active ? "#ffffff" : "currentColor"} />
        <rect x="14" y="14" width="3" height="3" fill={active ? "#ffffff" : "currentColor"} />
        <rect x="18" y="18" width="3" height="3" fill={active ? "#ffffff" : "currentColor"} />
      </svg>
      <span
        style={{
          color: active ? "#ffffff" : "#38bdf8",
          fontWeight: 800,
          fontSize: 14,
          letterSpacing: 0.5,
        }}
      >
        QRIS
      </span>
    </div>
  );
}

export function VirtualAccountLogo({ active = false }: { active?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="5" width="20" height="14" rx="2" />
        <line x1="2" y1="10" x2="22" y2="10" />
      </svg>
      <span
        style={{
          color: active ? "#ffffff" : "#cbd5e1",
          fontWeight: 700,
          fontSize: 13,
          letterSpacing: -0.2,
        }}
      >
        Virtual Account
      </span>
    </div>
  );
}

export function BankTransferLogo({ active = false }: { active?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M3 21h18" />
        <path d="M3 10h18" />
        <path d="M5 6l7-3 7 3" />
        <path d="M4 10v11" />
        <path d="M20 10v11" />
        <path d="M8 14v4" />
        <path d="M12 14v4" />
        <path d="M16 14v4" />
      </svg>
      <span
        style={{
          color: active ? "#ffffff" : "#cbd5e1",
          fontWeight: 700,
          fontSize: 13,
          letterSpacing: -0.2,
        }}
      >
        Transfer Manual
      </span>
    </div>
  );
}

export function OnlinePaymentLogo({ active = false, gateway = "online" }: { active?: boolean; gateway?: string }) {
  if (gateway === "dana") {
    return <DanaLogo active={active} />;
  }
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={active ? "#ffffff" : "#38bdf8"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="5" width="20" height="14" rx="2" />
        <line x1="2" y1="10" x2="22" y2="10" />
      </svg>
      <span
        style={{
          color: active ? "#ffffff" : "#38bdf8",
          fontWeight: 800,
          fontSize: 14,
          letterSpacing: -0.2,
        }}
      >
        {gateway === "midtrans"
          ? "Online (Midtrans)"
          : gateway === "xendit"
            ? "Online (Xendit)"
            : gateway === "doku"
              ? "Online (DOKU)"
              : gateway === "dana"
                ? "DANA"
                : "Pembayaran Online"}
      </span>
    </div>
  );
}
