# Catatan risiko hukum: penyedia platform generator (face swap, i2v, t2v)

**Status:** catatan kerja, bukan nasihat hukum.  
**Konteks:** user menyalahgunakan hasil generate (swap face / video) untuk keuntungan pribadi atau penyebaran hoax.  
**Yurisdiksi acuan:** Indonesia (UU ITE, UU Pornografi, KUHP/KUHAP baru, UU TPKS, UU PDP, UU Hak Cipta, PP 71/2019, Permenkominfo 5/2020).  
**Tanggal catatan:** 2026-09-04.

Disclaimer tidak memindahkan seluruh risiko ke user. Untuk generator on-demand (sistem yang **membuat** file, bukan sekadar hosting unggahan), posisi hukum lebih dekat ke produksi/fasilitasi daripada “hanya pisau.”

---

## 1. Peta siapa yang kena dulu

| Pihak | Posisi tipikal |
|---|---|
| User yang generate + sebar / jual | Tersangka utama (pembuat, penyebar, penipu) |
| User yang hanya generate, tidak sebar | Abu-abu; “membuat untuk diri sendiri” kadang dikecualikan di UU Pornografi, tapi face swap orang nyata + niat jahat tetap berisiko |
| Orang yang mengunggah/menjual hasil di medsos, Telegram, toko | Bisa turut serta / menyiarkan |
| **Penyedia platform** | Saksi + pemegang data; bisa naik jadi terperiksa/tersangka jika dianggap membuat, menyediakan, memfasilitasi, atau membiarkan |
| Pengurus / founder / beneficial owner | KUHP baru Pasal 45–49: korporasi **dan** pengurus/pemegang kendali bisa kena bersamaan |
| Provider GPU/API (Sirai, RunPod, dll.) | Bisa diminta data; bukan tameng bagi platform front-end |

ToS “bukan tanggung jawab kami jika disalahgunakan sebagai UGC” berguna untuk sengketa perdata antar user. Hampir tidak menutup:

- pidana kesusilaan / pornografi / NCII
- deepfake orang nyata
- hoax yang merugikan
- kewajiban PSE (take down, serahkan data, jangan fasilitasi konten dilarang)
- gugatan PMH korban ke platform

---

## 2. Skenario penyalahgunaan user

### 2.1 Keuntungan pribadi

Contoh yang paling sering menyeret platform karena jejak generate-nya jelas:

1. **AI influencer / konten berbayar** memakai wajah orang lain (selebriti, mantan, orang biasa) tanpa izin.
2. **Iklan / endorsement palsu:** wajah pejabat, dokter, influencer seolah merekomendasikan produk.
3. **Penipuan (CEO fraud, romance scam, pinjol, investasi):** video/i2v seolah orang itu yang bicara.
4. **Pemerasan:** ancam sebar hasil swap (revenge porn sintetis).
5. **Jual paket “swap wajah X”** di Telegram / marketplace.
6. **Pakai wajah korban untuk akun dating / prostitusi online.**

Pasal yang biasanya menempel ke **user** (dan bisa ditarik ke platform sebagai sarana):

- UU ITE Pasal 27 ayat (1) jo. 45 ayat (1): muatan kesusilaan — penjara s.d. 6 tahun dan/atau denda s.d. Rp1 miliar.
- UU ITE Pasal 27B: sebar informasi untuk menguntungkan diri sendiri secara melawan hukum (pemerasan/penipuan digital).
- UU ITE Pasal 35 jo. 51: manipulasi/penciptaan data agar dianggap otentik — penjara s.d. 12 tahun dan/atau denda s.d. Rp12 miliar. Ini pasal yang paling sering disebut untuk deepfake.
- KUHP baru / penipuan konvensional (dulu Pasal 378): tipu dengan video seolah asli.
- UU Pornografi Pasal 4, 7, 29, 30 / KUHP baru Pasal 407: membuat, menyediakan, memfasilitasi pornografi.
- UU TPKS Pasal 14: kekerasan seksual berbasis elektronik (ada perdebatan apakah “perekaman” mencakup sintetis; dalam praktik tetap dipakai sebagai ancaman laporan).
- UU Hak Cipta Pasal 12 jo. 115: pakai potret untuk reklame/komersial tanpa izin tertulis.
- UU PDP: wajah = data biometrik; pemrosesan tanpa dasar hukum sah.

### 2.2 Penyebaran hoax

Contoh:

1. Video pejabat “mengaku” korupsi, mundur, atau dukung pihak tertentu.
2. Fake news bencana, kerusuhan, SARA, atau fitnah pidana.
3. Deepfake untuk kampanye / black campaign.
4. Video “bukti” yang menyesatkan konsumen (produk, obat, investasi).

Pasal yang menempel ke **user**:

- UU ITE Pasal 27A jo. 45 ayat (4): serang kehormatan/nama baik — penjara s.d. 2 tahun dan/atau denda s.d. Rp400 juta (delik aduan; MK: korban orang perseorangan, bukan badan hukum).
- UU ITE Pasal 28 ayat (1): berita bohong merugikan konsumen dalam transaksi elektronik.
- UU ITE Pasal 28 ayat (2): ujaran kebencian SARA — penjara s.d. 6 tahun dan/atau denda s.d. Rp1 miliar.
- UU ITE Pasal 28 ayat (3) jo. 45A ayat (3): sebar pemberitahuan bohong yang menimbulkan kerusuhan. MK membatasi “kerusuhan” ke ruang fisik, bukan keributan di linimasa.
- UU ITE Pasal 35: seolah-olah otentik (inti deepfake hoax).
- Ketentuan pemilu / kampanye jika menyangkut peserta pemilu (jalur terpisah, sering diproses Bawaslu + pidana).
- KUHP baru tentang penghinaan, fitnah, pemalsuan.

---

## 3. Listing risiko hukum bagi penyedia platform

Diurut dari yang **paling mungkin terjadi** ke yang **paling berat**. Bukan dari yang paling sering menang di pengadilan.

### A. Risiko prosedural (hampir pasti jika kasus serius)

Platform akan dipanggil meski tidak dijadikan tersangka.

1. **Permintaan data penyidik / Komdigi**  
   Dasar: UU ITE (penyidikan), Permenkominfo 5/2020 Pasal 32–36.  
   Wajib serahkan identitas pengguna (subscriber information) dan traffic data untuk pidana dengan ancaman penjara paling singkat 2 tahun.  
   **Risiko jika menolak / lambat / data “sudah dihapus setelah tahu ada perkara”:** sanksi administratif PSE, dicurigai obstruction, Pasal 278 KUHP baru (menghilangkan alat bukti).

2. **Perintah take down / pemutusan akses**  
   Dasar: UU ITE Pasal 40, Permenkominfo 5/2020, PP 71/2019.  
   Gagal take down → denda administratif, **pemblokiran seluruh situs**.

3. **Penyitaan sistem / server / rekening**  
   KUHAP baru mengakui bukti elektronik dan penyitaan benda tidak berwujud. Rekening QRIS, bucket storage, dan laptop admin bisa ikut.

4. **Jadi saksi, lalu terperiksa, lalu tersangka**  
   Pola umum: korban lapor user → polisi minta log ke platform → jika fitur face swap tanpa consent dan ada pola penyalahgunaan, pemeriksaan bergeser ke operator.

### B. Risiko administratif (Komdigi / PSE)

5. **Tidak daftar PSE lingkup privat**  
   Portal/aplikung yang memproses data user di Indonesia pada prinsipnya wajib daftar. Tidak daftar = jalur pemblokiran paling gampang.

6. **Melanggar kewajiban PSE UGC (Permenkominfo 5/2020 Pasal 9–10)**  
   - Sistem tidak boleh **memuat** informasi dilarang.  
   - Sistem tidak boleh **memfasilitasi penyebarluasan** informasi dilarang.  
   - Wajib tata kelola, sarana lapor, take down.  
   Face swap + i2v on-demand tanpa filter consent lebih mudah ditafsir **memfasilitasi** ketimbang hosting biasa.

7. **Safe harbor UGC gagal**  
   Pengecualian tanggung jawab (sejauh diatur untuk PSE UGC) biasanya mensyaratkan: ada tata kelola, ada lapor, ada take down, **dan** beri identitas pengunggah ke aparat.  
   Generator yang **memproduksi** file bukan analog sempurna ke Twitter. Safe harbor hosting tidak otomatis melindungi pabrik konten.

8. **Sanksi berjenjang:** teguran tertulis → denda → penghentian sementara → pemutusan akses → dicoret dari daftar PSE.

### C. Risiko pidana substansi (isi produk)

9. **Dianggap “membuat” atau “menyediakan” pornografi / konten kesusilaan**  
   UU Pornografi Pasal 4; KUHP baru Pasal 407.  
   Sistem yang menghasilkan video/gambar cabul on-demand, apalagi dipasarkan sebagai uncensored, mendekati unsur “membuat/menyediakan,” bukan hanya user yang klik.

10. **Dianggap “memfasilitasi” perbuatan Pasal 4**  
    UU Pornografi Pasal 7: dilarang mendanai atau memfasilitasi.  
    Menjual kredit generate untuk face swap seksual adalah fakta yang sulit dibela sebagai netral.

11. **Kesusilaan ITE (Pasal 27 ayat 1)**  
    Jika hasil disimpan, di-share via tautan platform, atau di-explore, platform “membuat dapat diakses.”  
    Jika hasil hanya diunduh user, argumen akses lebih lemah, tetapi produksi tetap ada.

12. **Deepfake otentik palsu (UU ITE Pasal 35)**  
    Pasal ini menarget perbuatan membuat data seolah asli.  
    Risiko platform naik jika: tidak ada watermark/label AI, tidak ada pencegahan wajah orang nyata, atau fitur dipromosikan untuk meniru orang tertentu.

13. **NCII / kekerasan seksual berbasis elektronik**  
    UU TPKS Pasal 14 + UU ITE kesusilaan.  
    Face swap tubuh telanjang ke wajah orang nyata adalah skenario paling beracun. Komdigi sudah menekan PSE yang tidak mencegah pornografi dari foto warga.

14. **Anak / apparent minor**  
    Pornografi anak (UU Pornografi Pasal 4 ayat 1 huruf f) dan perlindungan anak.  
    Tidak ada ruang “user yang salah unggah.” Fail-closed. Satu kejadian bisa menutup bisnis dan membuka pidana berat.

### D. Risiko pidana ikut serta, membiarkan, korporasi

15. **Penyertaan / pembantuan**  
    Jika terbukti platform tahu pola penyalahgunaan (laporan berulang, channel Telegram jualan hasil, user power yang jelas abuse) lalu tetap menyediakan fitur yang sama.

16. **Korporasi membiarkan tindak pidana**  
    KUHP baru Pasal 48 huruf e: korporasi dapat bertanggung jawab jika **membiarkan** terjadinya tindak pidana.  
    Ini pasal yang paling relevan untuk “kami tahu user pakai face swap untuk scam/hoax, kami tidak bertindak.”

17. **Pidana pengurus, pemberi perintah, pemegang kendali, beneficial owner**  
    KUHP baru Pasal 49. PT tidak menahan peluru di founder.

18. **Pidana korporasi UU ITE**  
    Jika delik Pasal 27–37 dilakukan oleh korporasi, pidana pokok dapat ditambah (rezim ITE: tambahan dua pertiga pada beberapa ketentuan).

19. **Menghilangkan / tidak mengamankan bukti**  
    KUHP baru Pasal 278. Bukan karena “tidak pernah arsip hasil” secara kebijakan lama, melainkan hapus log/file **setelah** ada perkara, laporan, atau permintaan resmi.

### E. Risiko perdata

20. **Gugatan PMH (KUHPer Pasal 1365)**  
    Korban (wajah dipakai, reputasi rusak, kerugian usaha, trauma) menggugat platform karena memfasilitasi, tidak ada consent gate, lambat take down, atau lalai.  
    Ganti rugi materiil + immateriil.

21. **Tanggung jawab atas orang yang dipekerjakan / sistem yang dikendalikan (Pasal 1367 analogi / kelalaian)**  
    Lebih lemah dari 1365, tetap dipakai dalam somasi.

22. **Hak atas potret (UU Hak Cipta Pasal 12)**  
    User pakai wajah orang untuk konten komersial. Platform yang menyediakan tools + (jika ada) gallery/publikasi bisa ditarik sebagai pihak yang mengumumkan/mendistribusikan.  
    Catatan: rumusan Pasal 12 menempel ke “potret yang dibuatnya” untuk reklame; deepfake AI masih diuji di pengadilan, tapi somasi selebriti/brand tidak menunggu yurisprudensi sempurna.

23. **UU PDP**  
    Wajah = data pribadi spesifik (biometrik).  
    Platform adalah pengendali/prosesor. Dasar pemrosesan harus sah. “User upload dan ToS” rapuh jika data itu milik **orang ketiga** (korban), bukan milik user.  
    Risiko: perintah hapus, denda administratif (s.d. 2% pendapatan tahunan pada rezim UU PDP), gugatan subjek data.

24. **Sengketa pembayaran / konsumen**  
    User klaim “saya bayar, hasil saya dipakai bukti kejahatan, saya minta refund + ancam lapor.”  
    Terpisah dari pidana, tapi menyedot waktu dan rekening.

### F. Risiko turunan bisnis yang berujung hukum

25. **Pembekuan rekening / QRIS / PSP**  
    Bank dan payment gateway menolak merchant konten dewasa / fraud. Satu laporan deepfake scam yang lolos lewat pembayaranmu cukup untuk freeze.

26. **Pemutusan cloud, domain, CDN**  
    ToS AWS/GCP/provider GPU: abuse, NCII, fraud. Bukan pidana negara, tapi mematikan operasi dan bisa diikuti permintaan data ke provider.

27. **Tidak masuk iklan legal, App Store, partner resmi**  
    Bukan delik, tetapi mendorong operasi ke kanal informal (WA, Telegram) yang justru memperburuk citra “memfasilitasi.”

28. **Reputasi + tekanan Komdigi seperti kasus AI yang generate dari foto warga**  
    Jalur administratif + pidana user + pemeriksaan PSE berjalan paralel. Tidak perlu vonis untuk situs diblokir.

---

## 4. Kapan risiko platform naik dari “saksi” ke “tersangka / tergugat”

Faktor pemberat (urut pengaruh):

1. Face swap orang nyata adalah **fitur resmi**, bukan penyalahgunaan tersembunyi.
2. Tidak ada alur consent / “ini wajah saya” / larangan selebriti.
3. Konten uncensored dijual sebagai nilai jual.
4. Ada gallery publik, share link permanen, atau explore.
5. Tidak ada tombol lapor, atau laporan tidak ditindak dalam waktu singkat (Permen 5/2020: take down punya tenggat; praktik Komdigi ketat).
6. Pola penyalahgunaan sudah diketahui (CS, grup Telegram, berita) lalu fitur dibiarkan — Pasal 48 huruf e “membiarkan.”
7. Monetisasi langsung: kredit khusus “swap + video” tanpa kontrol.
8. Tidak daftar PSE / tidak punya narahubung resmi.
9. Menolak atau mengulur data aparat.
10. Menghapus log setelah kasus ramai.
11. Tidak ada label/watermark bahwa konten sintetis (memperkuat Pasal 35: seolah otentik).
12. Korban anak, pejabat, atau kasus viral nasional.

Faktor yang **tidak** cukup sebagai pembelaan:

- ToS “user bertanggung jawab”
- User sudah OTP dan isi tanggal lahir 21+
- “Kami tidak menyimpan hasil, hanya prompt”
- “User yang sebar di luar platform”
- “Kami cuma wrapper API Sirai/RunPod”

---

## 5. Matriks cepat: perbuatan user → pasal user → jalur ke platform

| Perbuatan user | Pasal yang sering dipakai ke user | Bagaimana platform terseret |
|---|---|---|
| Swap wajah ke tubuh/video seksual, sebar | ITE 27(1), UU Pornografi 4/7, TPKS 14, ITE 35 | Fasilitasi produksi; simpan/akses file; gagal cegah foto orang nyata |
| Swap wajah untuk jualan konten / AI influencer | Hak Cipta 12, PDP, PMH 1365, ITE 35 | Tools komersial tanpa consent gate; jika di-host, ikut “pengumuman” |
| Video palsu orang bayar utang / transfer | Penipuan, ITE 27B, ITE 35 | Sarana pemalsuan otentik; log generate jadi barang bukti |
| Deepfake pejabat / hoax politik | ITE 27A, 28(2)/(3), 35, aturan pemilu | Take down lambat; tidak ada deteksi tokoh publik; memfasilitasi seolah otentik |
| Fitnah dengan video “pengakuan” | ITE 27A, KUHP penghinaan | Korban gugat PMH + minta identitas pelaku ke platform |
| Pemerasan “saya punya video kamu” | ITE 27B, TPKS, kesusilaan | File berasal dari job di platform; permintaan data + somasi |
| Jual jasa swap di luar, generate di dalam | Pornografi / penipuan / ITE 35 | Pola akun, volume job, pembayaran kredit |

---

## 6. Risiko yang sering diremehkan

1. **Kamu menghasilkan file, user yang menyebarkan.** Hukum Indonesia menindak pembuatan **dan** penyebaran. Generator on-demand ada di sisi pembuatan.
2. **Hoax tidak harus “viral kerusuhan.”** Pasal 35 (seolah otentik) dan 27A (nama baik) lebih gampang dipakai daripada Pasal 28 ayat (3).
3. **Keuntungan pribadi user = jejak pembayaran di luar + kredit di dalam.** Polisi akan cocokkan. Platform terlihat sebagai pabrik pesanan.
4. **Wajah orang ketiga bukan data user.** Dasar PDP “consent user” tidak menutup pemrosesan biometrik korban.
5. **API luar negeri tidak memindahkan yurisdiksi.** Front-end, bayar QRIS, user Indonesia, akibat di Indonesia: Komdigi dan polisi tetap ke kamu.
6. **Satu kasus anak meniadakan seluruh argumen “kebijakan longgar yang bermoral.”**
7. **Tidak menyimpan hasil ≠ tidak ada bukti.** HP user, Telegram, provider GPU, hash, prompt, foto input tetap ada. Yang hilang hanya kemampuanmu membuktikan atau men-take down salinan sendiri.

---

## 7. Kontrol yang menurunkan (bukan menghilangkan) risiko platform

Ini mitigasi operasional, bukan surat bebas perkara.

1. Daftar PSE; tunjuk narahubung 24/7 untuk Komdigi dan aparat.
2. Face swap orang nyata: default mati, atau hanya “wajah milik sendiri” + pernyataan + liveness. Selebriti/pejabat: blok.
3. Larang penggunaan komersial atas likeness orang lain di ToS **dan** di produk (deteksi, bukan hanya teks).
4. Label/watermark sintetis yang sulit dihapus pada output, terutama video.
5. Sarana lapor korban, take down cepat, legal hold (jangan hapus log setelah lapor).
6. Simpan: akun, prompt, hash input/output, ID job provider, IP, waktu, versi kebijakan. Buffer file singkat + freeze jika ada laporan.
7. Classifier apparent minor: fail closed, simpan, review, laporkan.
8. Rate limit + review akun volume tinggi (ciri jasa swap berbayar).
9. Jangan explore publik untuk hasil yang melibatkan wajah foto user.
10. SOP tertulis “membiarkan”: laporan ke-N atas modus yang sama wajib mematikan fitur atau menaikkan kontrol. Ini jawaban langsung ke KUHP Pasal 48 huruf e.
11. Pisahkan badan hukum, rekening, dan merek SFW vs mature.
12. Asuransi siber/liability hampir pasti menolak NCII/porn; jangan dihitung sebagai mitigasi.

---

## 8. Ringkas untuk keputusan produk

**User** yang menukar wajah orang lalu menjual atau menyebarkan hoax: terpapar pidana ITE (kesusilaan, nama baik, hoax, data seolah otentik), pornografi, penipuan, TPKS, PDP, hak potret.

**Platform** tidak otomatis dipidana karena perbuatan user. Platform otomatis masuk orbit perkara sebagai pemegang data. Platform **naik jadi target** jika:

- fitur itu sendiri adalah mesin face swap/video orang nyata,
- ada fasilitasi atau pembiaran,
- gagal kewajiban PSE (daftar, lapor, take down, serahkan data),
- atau hasilnya di-host/disebar lewat sistem sendiri.

Risiko paling berat untuk penyedia, berurutan:

1. Pemblokiran PSE / rekening (cepat, tanpa vonis).
2. Pemeriksaan pengurus + permintaan data.
3. Gugatan PMH + PDP oleh korban.
4. Pidana fasilitasi pornografi / kesusilaan / Pasal 35 jika produk memang diarahkan ke itu.
5. Pidana korporasi “membiarkan” setelah pola penyalahgunaan terlihat.
6. Pornografi anak — zero tolerance.

Kalau produk tetap ingin longgar: longgar hanya untuk **karakter fiksi dewasa**. Face swap dan i2v atas orang nyata adalah pusat risiko hukum, bukan fitur sampingan.
