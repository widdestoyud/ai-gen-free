"use client";

import { Container, Accordion, Title, Text, Stack } from "@mantine/core";
import classes from "./landing.module.css";

const FAQS = [
  {
    q: "Bagaimana cara mulai menggunakan studio ini?",
    a: "Daftarkan akun menggunakan email, pilih paket poin yang kamu butuhkan (mulai Rp 49.000), dan saldo poin langsung aktif di akunmu untuk langsung membuat gambar atau video.",
  },
  {
    q: "Apakah ada biaya langganan bulanan otomatis?",
    a: "Tidak ada. Platform ini menerapkan sistem pay-as-you-go murni. Kamu hanya membayar saat melakukan pembelian poin, tanpa tagihan otomatis berkala atau auto-debet kartu kredit.",
  },
  {
    q: "Apakah saya memerlukan kartu kredit?",
    a: "Tidak. Seluruh transaksi didukung metode pembayaran lokal instan terlengkap: e-wallet, transfer bank / Virtual Account, dan metode pembayaran instan lainnya.",
  },
  {
    q: "Apakah poin saya bisa hangus jika tidak segera digunakan?",
    a: "Tidak. Poin yang telah kamu beli tersimpan aman di akunmu dan dapat digunakan kapan saja tanpa batas waktu kedaluwarsa.",
  },
  {
    q: "Bagaimana jika proses generasi gagal di tengah jalan?",
    a: "Poinmu bergaransi aman 100%. Melalui sistem proteksi Hold-Capture-Release, poin hanya dipotong saat hasil berhasil selesai dirender. Jika terjadi kendala antrian atau sistem, poin otomatis dikembalikan seutuhnya ke saldo akunmu.",
  },
  {
    q: "Apakah hasil karya saya bersifat privat?",
    a: "Ya. Seluruh media yang kamu hasilkan tersimpan secara privat di Library akunmu selama 14 hari dan hanya dapat diakses serta diunduh olehmu sendiri, bukan konsumsi publik.",
  },
];

export function LandingFaq() {
  return (
    <section className={classes.faqSection} id="faq">
      <Container size="md">
        <Stack align="center" ta="center" mb={48}>
          <Text size="xs" fw={800} c="blue.4" tt="uppercase" lts={1}>
            PERTANYAAN UMUM
          </Text>
          <Title order={2} fz={{ base: "1.8rem", sm: "2.6rem" }} fw={900}>
            Yang sering <span className={classes.heroTitleHighlight}>ditanyakan.</span>
          </Title>
          <Text c="dimmed" maw={500} fz="md">
            Informasi lengkap seputar sistem poin, pembayaran, dan privasi karyamu.
          </Text>
        </Stack>

        <Accordion variant="separated" radius="md">
          {FAQS.map((faq) => (
            <Accordion.Item key={faq.q} value={faq.q} mb="xs">
              <Accordion.Control>
                <Text fw={600} size="sm">
                  {faq.q}
                </Text>
              </Accordion.Control>
              <Accordion.Panel>
                <Text size="sm" c="dimmed" lh={1.6}>
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
