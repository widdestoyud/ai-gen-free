import type { PublicPackage } from "./server-api";

export interface PricingPlanItem {
  id: string;
  name: string;
  label: string;
  badgeText?: string | null;
  price: string;
  originalPrice?: string | null;
  amountIdr: number;
  originalAmountIdr?: number | null;
  points: number;
  description: string;
  popular: boolean;
  perks: string[];
}

export const DEFAULT_PRICING_PLANS: PricingPlanItem[] = [
  {
    id: "starter",
    name: "Starter Pack",
    label: "Starter",
    badgeText: "Starter",
    price: "Rp 49.000",
    originalPrice: null,
    amountIdr: 49_000,
    originalAmountIdr: null,
    points: 500,
    description: "Pilihan praktis untuk kebutuhan mendesak dan eksplorasi instan.",
    popular: false,
    perks: [
      "500 poin langsung aktif",
      "Akses studio gambar hingga 50 image",
      "Akses generator video sinematik hingga 10 video",
      "Media penyimpanan private",
      "Poin berlaku selamanya",
    ],
  },
  {
    id: "pro",
    name: "Creator Pro",
    label: "Paling Populer",
    badgeText: "Paling Populer",
    price: "Rp 149.000",
    originalPrice: null,
    amountIdr: 149_000,
    originalAmountIdr: null,
    points: 1750,
    description: "Nilai terbaik untuk kebutuhan rutin, konten sosmed, dan visual jualan.",
    popular: true,
    perks: [
      "1.750 poin langsung aktif",
      "Akses studio gambar hingga 80 image",
      "Akses generator video sinematik hingga 30 video",
      "Media penyimpanan private",
      "Poin berlaku selamanya",
    ],
  },
  {
    id: "power",
    name: "Power Studio",
    label: "Hemat Maksimal",
    badgeText: "Hemat Maksimal",
    price: "Rp 299.000",
    originalPrice: null,
    amountIdr: 299_000,
    originalAmountIdr: null,
    points: 4500,
    description: "Kapasitas besar untuk agensi, desainer, dan volume produksi intensif.",
    popular: false,
    perks: [
      "4.500 poin langsung aktif",
      "Akses studio gambar hingga 500 image",
      "Akses generator video sinematik hingga 90 video",
      "Media penyimpanan private",
      "Poin berlaku selamanya",
    ],
  },
];

export function getPackageEstimation(pkg: {
  id?: string;
  name?: string;
  points?: number | string;
  amountIdr?: number;
}): { imageEst: number; videoEst: number; imageText: string; videoText: string } {
  const name = (pkg.name || "").toLowerCase();
  const id = (pkg.id || "").toLowerCase();
  const points = typeof pkg.points === "number" ? pkg.points : Number(pkg.points) || 0;
  const amount = Number(pkg.amountIdr) || 0;

  let imageEst = 50;
  let videoEst = 10;

  if (
    name.includes("studio") ||
    name.includes("power") ||
    id.includes("studio") ||
    id.includes("power") ||
    points >= 3000 ||
    amount >= 200000
  ) {
    imageEst = 500;
    videoEst = 90;
  } else if (
    name.includes("creator") ||
    name.includes("pro") ||
    id.includes("pro") ||
    (points >= 1000 && points < 3000) ||
    (amount >= 90000 && amount < 200000)
  ) {
    imageEst = 80;
    videoEst = 30;
  } else {
    imageEst = 50;
    videoEst = 10;
  }

  return {
    imageEst,
    videoEst,
    imageText: `Akses studio gambar hingga ${imageEst} image`,
    videoText: `Akses generator video sinematik hingga ${videoEst} video`,
  };
}

export function buildPlanFromPackage(
  pkg: PublicPackage | { id: string; name?: string; label?: string; badgeText?: string | null; description?: string | null; amountIdr: number; originalAmountIdr?: number | null; points: number; sortOrder?: number },
  idx = 0,
  total = 3,
): PricingPlanItem {
  const isPopular = Boolean(
    pkg.badgeText?.toLowerCase().includes("populer") ||
      pkg.badgeText?.toLowerCase().includes("laris") ||
      pkg.badgeText?.toLowerCase().includes("best") ||
      pkg.badgeText?.toLowerCase().includes("favorit") ||
      (total === 3 && idx === 1) ||
      pkg.sortOrder === 2,
  );

  const est = getPackageEstimation(pkg);

  const perks = [
    `${pkg.points.toLocaleString("id-ID")} poin langsung aktif`,
    est.imageText,
    est.videoText,
    "Media penyimpanan private",
    "Poin berlaku selamanya",
  ];

  return {
    id: pkg.id,
    name: pkg.name || pkg.label || "Paket Poin",
    label: pkg.badgeText || (isPopular ? "Paling Populer" : "Starter"),
    badgeText: pkg.badgeText || null,
    price: `Rp ${pkg.amountIdr.toLocaleString("id-ID")}`,
    originalPrice: pkg.originalAmountIdr ? `Rp ${pkg.originalAmountIdr.toLocaleString("id-ID")}` : null,
    amountIdr: pkg.amountIdr,
    originalAmountIdr: pkg.originalAmountIdr ?? null,
    points: pkg.points,
    description: pkg.description || "Pilihan praktis untuk eksplorasi dan kebutuhan visual.",
    popular: isPopular,
    perks,
  };
}
