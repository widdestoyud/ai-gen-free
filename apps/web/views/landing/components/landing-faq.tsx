"use client";

import { Container, Accordion, Title, Text } from "@mantine/core";
import classes from "./landing.module.css";

const FAQS = [
  {
    q: "Apa itu satulabs.id dan fitur apa saja yang tersedia?",
    a: "satulabs.id adalah studio AI generatif terpadu yang memungkinkan kamu membuat gambar komersial beresolusi ultra-HD 4K, video sinematik dinamis 60fps dengan kontrol kamera halus, dan karakter digital berbicara dari prompt teks sederhana. Semua kebutuhan produksi visual tersedia dalam satu tempat tanpa perlu instalasi perangkat lunak tambahan.",
  },
  {
    q: "Bagaimana cara mulai menggunakan platform ini?",
    a: "Daftarkan akun dengan email kamu, verifikasi kode OTP singkat, lalu pilih paket sparks awal yang kamu butuhkan (mulai dari Rp 49.000). Saldo sparks langsung aktif dan bisa langsung digunakan untuk generate gambar atau video.",
  },
  {
    q: "Apakah ada biaya langganan bulanan otomatis (recurring billing)?",
    a: "Sama sekali tidak ada. Platform kami menerapkan sistem pay-as-you-go murni. Kamu hanya membeli saldo sparks saat kamu butuh, tanpa langganan kartu kredit otomatis atau tagihan tak terduga di akhir bulan.",
  },
  {
    q: "Metode pembayaran apa saja yang didukung?",
    a: "Kamu bisa membayar dengan sangat mudah menggunakan metode pembayaran lokal instan terlengkap: QRIS (GoPay, OVO, Dana, LinkAja, ShopeePay), transfer bank / Virtual Account (BCA, Mandiri, BRI, BNI), dan e-wallet.",
  },
  {
    q: "Apakah sparks saya bisa hangus jika tidak segera digunakan?",
    a: "Tidak. Sparks yang sudah kamu beli tersimpan aman di akunmu dan berlaku selamanya tanpa batas waktu kedaluwarsa.",
  },
  {
    q: "Bagaimana jika proses generasi gagal di tengah jalan?",
    a: "Saldo sparks-mu bergaransi aman 100%. Kami menerapkan sistem proteksi Hold-Capture-Release, di mana sparks hanya akan terpotong jika hasil karya sukses selesai dirender. Jika terjadi kendala sistem atau antrian GPU, sparks otomatis dikembalikan seutuhnya ke akunmu.",
  },
  {
    q: "Apakah hasil karya saya bersifat privat atau dipublikasikan?",
    a: "100% privat. Semua gambar dan video yang kamu buat tersimpan di Library privat akunmu selama 14 hari dan hanya bisa diakses serta diunduh oleh kamu sendiri. Karya kamu tidak dipajang di galeri publik.",
  },
];

export function LandingFaq() {
  return (
    <section className={classes.faqSection} id="faq">
      <Container size="md">
        <div className={classes.sectionHeader}>
          <span className={classes.sectionTag}>PERTANYAAN UMUM</span>
          <Title className={classes.sectionTitle} order={2}>
            Yang Sering Ditanyakan.
          </Title>
          <Text className={classes.sectionSubtitle}>
            Semua hal yang perlu kamu ketahui tentang sistem sparks, pembayaran, dan keamanan privasimu.
          </Text>
        </div>

        <Accordion
          variant="separated"
          radius="md"
          styles={{
            item: {
              backgroundColor: "rgba(17, 19, 28, 0.65)",
              border: "1px solid rgba(255, 255, 255, 0.08)",
              transition: "border-color 0.2s ease",
              "&[data-active]": {
                borderColor: "rgba(139, 92, 246, 0.4)",
                backgroundColor: "rgba(22, 25, 38, 0.8)",
              },
            },
            control: {
              color: "#ffffff",
              "&:hover": {
                backgroundColor: "transparent",
              },
            },
            panel: {
              color: "#94a3b8",
            },
          }}
        >
          {FAQS.map((faq) => (
            <Accordion.Item key={faq.q} value={faq.q} mb="xs">
              <Accordion.Control>
                <Text fw={600} size="sm">
                  {faq.q}
                </Text>
              </Accordion.Control>
              <Accordion.Panel>
                <Text size="sm" c="#94a3b8" lh={1.6}>
                  {faq.a}
                </Text>
              </Accordion.Panel>
            </Accordion.Item>
          ))}
        </Accordion>
      </Container>
    </section>
  );
}
