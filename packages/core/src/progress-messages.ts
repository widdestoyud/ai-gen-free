export type ProgressStageKey = "10" | "30" | "50" | "80" | "100";

export const PROGRESS_MESSAGES: Record<ProgressStageKey, string[]> = {
  // Stage 1: >= 10% dan < 30% (Inisialisasi, pemahaman prompt, dan rancangan awal)
  "10": [
    "Membaca dan membedah imajinasi dari setiap kata di prompt Anda...",
    "Menyiapkan kanvas digital dan kuas neural di cluster GPU...",
    "AI sedang merajut konsep dasar visual sesuai permintaan Anda...",
    "Mencocokkan gaya artistik terbaik untuk mewujudkan ide Anda...",
    "Menggali jutaan referensi estetika untuk inspirasi visual yang presisi...",
    "Menginisialisasi tensor dan memetakan persepsi spasial...",
    "Membuat sketsa kasar komposisi dan tata letak utama...",
    "Menghubungkan simpul-simpul neural untuk membangun fondasi visual...",
    "Menafsirkan suasana dan nuansa emosional dari prompt Anda...",
    "Menata panggung visual dan perspektif kamera digital...",
    "Memilih palet warna dasar yang paling harmonis untuk kreasi ini...",
    "Merancang proporsi anatomi dan latar belakang secara terukur...",
    "Menentukan fokus utama objek agar tampil memukau...",
    "AI sedang berkonsentrasi penuh menerjemahkan ide brilian Anda...",
    "Langkah awal terbentuk, fondasi karya seni Anda mulai terlihat...",
    "Menyaring jutaan pola piksel demi komposisi yang seimbang...",
    "Membangun geometri awal dan kontur bentuk...",
    "Menyelaraskan rasio aspek dan sudut pandang karya...",
    "Mengaktifkan jutaan neuron sintetis untuk karya spesial Anda...",
    "Fondasi visual siap, sebentar lagi detail magis akan mulai terukir...",
  ],

  // Stage 2: >= 30% dan < 50% (Pembentukan bentuk, volume, dan pencahayaan)
  "30": [
    "Mulai menyusun bentuk-bentuk utama dan volume objek...",
    "Menambahkan dimensi 3D agar objek terasa nyata dan berkarakter...",
    "Mengatur arah cahaya dan memproyeksikan bayangan dramatis...",
    "Menyuntikkan kontras warna agar elemen visual tampak hidup...",
    "Menyempurnakan siluet objek utama agar menonjol elegan...",
    "Membangun kedalaman ruang dan efek optik yang sinematis...",
    "Mengukir detail-detail penting pada karakter dan latar suasana...",
    "Menata gradasi warna langit dan pencahayaan latar...",
    "AI sedang memahat lekuk dan tekstur dasar dengan sangat cermat...",
    "Menyelaraskan atmosfer ruang agar terasa nyata dan menyatu...",
    "Karakter visual mulai tampak jelas dan semakin menawan...",
    "Menghitung dispersi cahaya dan pantulan permukaan objek...",
    "Membentuk ketajaman kontur dan transisi bayangan lembut...",
    "Perjalanan berlanjut mulus, visual Anda mulai terbentuk nyata...",
    "Menambahkan efek ambient light untuk suasana yang mendalam...",
    "Merangkai elemen-elemen latar belakang agar mendukung objek utama...",
    "Menjaga keharmonisan komposisi dari sudut ke sudut...",
    "Melaraskan temperatur warna: hangat, sejuk, dan memikat...",
    "Visual makin solid, detail menakjubkan segera dihadirkan...",
    "AI semakin memahami visi Anda, bentuk visual kian mempesona...",
  ],

  // Stage 3: >= 50% dan < 80% (Rendering detail halus, tekstur, dan kedalaman)
  "50": [
    "Mengukir tekstur halus dan detail mikro pada permukaan objek...",
    "Menghidupkan kilau mata, refleksi cahaya, dan ekspresi alami...",
    "Menajamkan setiap helai rambut, serat kain, dan partikel visual...",
    "Menyelaraskan bayangan mikro (ambient occlusion) agar tampak realistis...",
    "Memoles transisi warna agar gradasinya selembut lukisan master...",
    "Menambahkan detail latar belakang: debu cahaya, kabut, dan kedalaman...",
    "Karya seni Anda makin mendekati bentuk visual yang mengagumkan...",
    "Menghaluskan rendering piksel demi kejernihan resolusi terbaik...",
    "Merapikan pencahayaan spekular dan pantulan dinamis...",
    "Menyuntikkan jiwa seni pada setiap elemen komposisi...",
    "Detail rumit berhasil ditaklukkan, hasilnya tampak semakin hidup...",
    "Menyeimbangkan saturasi dan tonalitas warna secara presisi...",
    "Memoles efek kedalaman bidang (depth of field) yang sinematis...",
    "Setiap goresan digital kini berpadu dalam keharmonisan sempurna...",
    "Sedikit lagi, karya seni Anda hampir selesai diracik!",
    "Merapikan tepi-tepi objek agar berbaur alami dengan lingkungan...",
    "Memperkaya nuansa visual agar memiliki daya tarik luar biasa...",
    "Menghilangkan noise digital dan menyempurnakan kejernihan...",
    "Visual terlihat luar biasa, AI sedang melakukan sapuan detail magis...",
    "Hampir rampung! Detail terbaik sedang dituangkan ke kanvas Anda...",
  ],

  // Stage 4: >= 80% dan < 100% (Polishing, sentuhan akhir, dan color grading)
  "80": [
    "Sentuhan artistik terakhir: memberikan sentuhan akhir berkelas...",
    "Color grading sinematis sedang diterapkan untuk estetika maksimal...",
    "Memastikan ketajaman kontras dan kehangatan visual seimbang...",
    "Memoles highlight cahaya terakhir pada objek utama...",
    "AI sedang memeriksa kesempurnaan setiap sudut karya Anda...",
    "Mengoptimalkan resolusi dan kejernihan berkas visual...",
    "Memberikan efek lens bloom dan pantulan estetik yang menawan...",
    "Karya seni Anda sudah 90% matang, bersiaplah terkesima!",
    "Finishing touch sedang berlangsung, detik-detik menuju masterpiece...",
    "Memastikan tidak ada detail penting yang terlewatkan...",
    "Mengunci keindahan warna dan kedalaman visual karya Anda...",
    "Penyempurnaan mikro terakhir sebelum siap diperlihatkan...",
    "Karya ini terasa istimewa, sebentar lagi siap Anda nikmati...",
    "Menyelaraskan kontras final untuk tampilan yang tajam dan memikat...",
    "Polishing tingkat tinggi hampir selesai, tinggal hitungan detik...",
    "Menyematkan keajaiban visual terakhir pada karya Anda...",
    "Kualitas ultra-detail sedang dikunci ke dalam berkas...",
    "Semua elemen menyatu dengan begitu indah dan rapi...",
    "Sedikit polesan magis lagi dan karya Anda selesai...",
    "Hasil visual sudah sempurna, bersiap untuk langkah finalisasi!",
  ],

  // Stage 5: 100% (Menunggu finalisasi, penyimpanan cloud, dan penyiapan output)
  "100": [
    "Selesai di-render! Sedang mengompres dan mengoptimalkan berkas...",
    "Menyimpan karya Anda dengan aman ke dalam cloud storage...",
    "Menghasilkan pratinjau berkualitas tinggi untuk Anda...",
    "Mengamankan tautan berkas beresolusi penuh...",
    "Sedikit lagi! Berkas sedang ditransfer dari server GPU...",
    "Menyelesaikan verifikasi berkas dan metadata gambar...",
    "Hampir tiba di layar Anda, bersiaplah melihat hasilnya!",
    "Mengunduh output karya seni dari pipeline pemrosesan...",
    "Menyiapkan tampilan terbaik untuk karya terbaru Anda...",
    "Menyegarkan galeri kreasi pribadi Anda...",
    "Sentuhan penutup selesai, karya Anda sedang dibuka...",
    "Menyimpan ke riwayat karya agar Anda bisa mengunduhnya kapan saja...",
    "Memverifikasi integritas piksel sebelum disajikan...",
    "Mengunggah hasil akhir dengan resolusi prima...",
    "Karya Anda telah lahir! Menyiapkan kanvas tampilan...",
    "Tinggal sepersekian detik lagi untuk membuka hasil karya...",
    "Finishing cloud storage selesai, memuat visual ke layar...",
    "Menghilangkan tirai penutup, karya Anda siap dinikmati!",
    "Semua proses tuntas dengan sempurna! Menampilkan output...",
    "Taraa! Karya seni impian Anda siap disaksikan!",
  ],
};

export function getProgressStageKey(progressPct: number): ProgressStageKey {
  if (progressPct >= 100) return "100";
  if (progressPct >= 80) return "80";
  if (progressPct >= 50) return "50";
  if (progressPct >= 30) return "30";
  return "10";
}

export function getProgressMessage(progressPct: number, index = 0): string {
  const stage = getProgressStageKey(progressPct);
  const list = PROGRESS_MESSAGES[stage];
  const safeIdx = Math.abs(index) % list.length;
  return list[safeIdx];
}
