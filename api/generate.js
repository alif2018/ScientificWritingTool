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
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  if (!GEMINI_API_KEY) {
    return res.status(500).json({ error: 'Server missing Gemini API key' });
  }

  // ---- PROMPT SISTEM (ATURAN RPS) ----
  const systemPrompt = `
Anda adalah Asisten Ahli Kurikulum OBE. 
Tugas: Generate RPS lengkap dalam format Markdown dengan 8 Komponen:
1. Deskripsi Singkat MK (Generate sendiri dari topik)
2. Profil Lulusan & CPL (jika user isi "LEWATKAN", generate sendiri)
3. CPMK (5-7 capaian, level minimal C4-C6, DILARANG kata "Memahami")
4. Sub-CPMK (WAJIB 13 capaian untuk Minggu 2-7 dan 9-15)
5. SAP (Tabel 16 minggu, 10 kolom, bobot total 100%. Minggu 1=0%, Minggu 8=30%, Minggu 16=40%, 13 minggu efektif total 30%)
6. Rancangan Tugas Terstruktur (1 tugas besar)
7. Kriteria Penilaian (Formatif 30%, UTS 30%, UAS 40% + Rubrik)
8. Daftar Referensi (minimal 8, generate sendiri)

Aturan mutlak:
- Metode Pembelajaran WAJIB SCL (PBL, PJBL, Jigsaw, Card Sort, Mind Mapping, Studi Kasus, Simulasi).
- Jika topik < 13, pecah menjadi subtopik/sesi pengayaan. Jika > 13, gabungkan serumpun atau pilih 13 esensial.
- Jangan tanyakan hal lain ke user. Langsung berikan output Markdown.
`;

  // ---- PROMPT USER ----
  const userPrompt = `
Nama Mata Kuliah: ${mk}
Program Studi: ${prodi}
Data Visi/CPL dari User: ${visi_cpl || "Tidak diisi"}
Daftar Pokok Bahasan:
${topics.map((t, i) => `${i+1}. ${t}`).join('\n')}

Instruksi: Segera hasilkan RPS OBE lengkap dalam 1 blok markdown. Patuhi semua aturan di atas.
`;

  try {
    // ===== PANGGIL API GEMINI =====
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: {
            parts: [{ text: systemPrompt }]
          },
          contents: [
            {
              parts: [{ text: userPrompt }]
            }
          ],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 4000
          }
        })
      }
    );

    const data = await response.json();
    
    if (data.error) {
      console.error('Gemini Error:', data.error);
      return res.status(500).json({ error: data.error.message || 'Gagal memanggil Gemini' });
    }

    // Ambil teks hasil dari response Gemini
    const markdownResult = data.candidates[0].content.parts[0].text;
    return res.status(200).json({ markdown: markdownResult });

  } catch (error) {
    console.error('Server Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
