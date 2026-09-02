export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'POST');
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { mk, prodi, visi_cpl, topics } = req.body;

  if (!mk || !prodi || !topics || topics.length === 0) {
    return res.status(400).json({ error: 'Data tidak lengkap' });
  }

  // Ambil API Key dari Environment Variables Vercel
  const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
  if (!DEEPSEEK_API_KEY) {
    return res.status(500).json({ error: 'Server missing DeepSeek API key' });
  }

  // ============================================================
  // PROMPT SISTEM – SAMA SEPERTI SEBELUMNYA (ATURAN RPS)
  // ============================================================
  const systemPrompt = `
Anda adalah Asisten Ahli Kurikulum OBE yang sangat berpengalaman.

Tugas Anda: Hasilkan RPS (Rencana Pembelajaran Semester) yang **sangat komprehensif dan mendetail**, setebal 10–15 halaman jika dicetak, dalam format Markdown murni (tanpa pembungkus kode).

**Wajib mencakup 8 Komponen berikut dengan sangat rinci:**

1. **Deskripsi Singkat MK** (4–5 kalimat padat, mencakup objek, ruang lingkup, tujuan, dan relevansi).

2. **Profil Lulusan & CPL** (jika user memberi data, pakai; jika "LEWATKAN", generate sendiri 3 profil lulusan dan CPL Sikap, Pengetahuan, Keterampilan yang logis).

3. **CPMK** (5–7 capaian, level minimal C4-C6, **DILARANG** kata "Memahami" atau "Menjelaskan" di level C2. Gunakan kata kerja seperti Menganalisis, Mengevaluasi, Merumuskan, Mengkritisi, dll).

4. **Sub-CPMK** (WAJIB 13 capaian untuk Minggu 2–7 dan 9–15. Setiap Sub-CPMK harus memuat kata kerja Kognitif (C) dan Psikomotorik (P). Jika topik kurang dari 13, pecah menjadi subtopik atau sesi pengayaan. Jika lebih dari 13, gabungkan atau pilih 13 esensial).

5. **SAP (Satuan Acara Perkuliahan)** – Tabel dengan 16 baris (Minggu 1–16) dan **10 kolom**:
   | Minggu | Sub-CPMK | Materi | Metode | Pengalaman Belajar (Daring/Luring) | Media | Indikator (C+A+P) | Kriteria Afektif | Teknik | Bobot |
   - Aturan bobot: Minggu 1 = 0%, Minggu 8 (UTS) = 30%, Minggu 16 (UAS) = 40%, 13 minggu efektif (2–7 dan 9–15) total 30% (bagi proporsional 2–3% per minggu).
   - Isi tabel dengan **jelas dan padat**, jangan biarkan sel kosong.

6. **Rancangan Tugas Terstruktur** – 1 tugas besar (Proposal/KTI/Proyek) dengan deskripsi, langkah pengerjaan, luaran, dan batas waktu.

7. **Kriteria Penilaian** – Bobot akhir: Formatif 30%, UTS 30%, UAS 40%. Sertakan rubrik tugas besar dengan minimal 4 kriteria (Sistematika, Analisis, Sumber, Orisinalitas) dan skala nilai (misal 85-100, 70-84, dst).

8. **Daftar Referensi** – Minimal 10 referensi (kitab klasik, buku kontemporer, jurnal) yang relevan, tanpa bertanya ke user.

**Aturan mutlak:**
- Metode pembelajaran WAJIB menggunakan Student-Centered Learning (PBL, PJBL, Jigsaw, Card Sort, Mind Mapping, Studi Kasus, Simulasi, dll).
- Jika topik < 13, lakukan splitting dengan menambahkan sesi pengayaan, review, atau simulasi.
- Jika topik > 13, lakukan merging topik serumpun atau pilih 13 esensial.
- **Output hanya Markdown**, tanpa pembukaan/penutupan, tanpa komentar tambahan.
- **Panjang output:** Harus sangat detail dan komprehensif, setara dengan RPS yang siap pakai untuk dokumen akreditasi. Gunakan seluruh ruang yang tersedia.
`;

  // ============================================================
  // PROMPT USER – berisi data dari form
  // ============================================================
  const userPrompt = `
Nama Mata Kuliah: ${mk}
Program Studi: ${prodi}
Data Visi/CPL dari User: ${visi_cpl || "Tidak diisi"}
Daftar Pokok Bahasan (topik-topik perkuliahan):
${topics.map((t, i) => `${i+1}. ${t}`).join('\n')}

Instruksi: Hasilkan RPS OBE yang sangat lengkap dan detail sesuai panduan di atas. Gunakan daftar topik sebagai acuan untuk menyusun 13 pertemuan efektif. Jangan ragu untuk menambahkan subtopik atau sesi pengayaan jika diperlukan.
`;

  try {
    // ============================================================
    // PANGGIL DEEPSEEK API (model terbaik)
    // ============================================================
    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
      },
      body: JSON.stringify({
        model: 'deepseek-v4-pro',  // atau 'deepseek-v4-flash' jika lebih cepat
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.3,
        max_tokens: 8192  // output panjang & detail
      })
    });

    const data = await response.json();
    
    if (data.error) {
      console.error('DeepSeek Error:', data.error);
      return res.status(500).json({ error: data.error.message || 'Gagal memanggil DeepSeek' });
    }

    // Ambil teks hasil dari response DeepSeek
    const markdownResult = data.choices[0].message.content;
    return res.status(200).json({ markdown: markdownResult });

  } catch (error) {
    console.error('Server Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
