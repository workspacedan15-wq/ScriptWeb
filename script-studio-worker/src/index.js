export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/ai" && request.method === "POST") {
      if (!env.GEMINI_API_KEY) {
        return Response.json({ error: "AI_NOT_CONFIGURED" }, { status: 503 });
      }
      let body;
      try {
        body = await request.json();
      } catch {
        return Response.json({ error: "Invalid JSON" }, { status: 400 });
      }
      const prompt = String(body?.prompt || "").trim().slice(0, 2000);
      if (!prompt) return Response.json({ error: "Prompt kosong" }, { status: 400 });

      const systemPrompt = `Kamu asisten penulisan skrip video affiliate berbahasa Indonesia. Pengguna hanya boleh memberi instruksi teks; jangan meminta atau menerima file gambar/video. Buat 3-6 adegan. Balas HANYA JSON valid berbentuk {"rows":[{"visual":"aksi talent yang dapat difilmkan","vo":"narasi voice over"}]}. Jangan membuat klaim spesifikasi/khasiat produk yang tidak diberikan pengguna. Jika fakta produk tidak tersedia, gunakan bahasa umum dan sarankan pengguna memverifikasi. Perintah pengguna: ${prompt}`;

      try {
        const resp = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" + encodeURIComponent(env.GEMINI_API_KEY), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: systemPrompt }] }],
            generationConfig: { responseMimeType: "application/json", temperature: 0.7 }
          })
        });
        if (!resp.ok) return Response.json({ error: "Gemini request failed" }, { status: 502 });
        const data = await resp.json();
        const output = data?.candidates?.[0]?.content?.parts?.map(p => p.text || "").join("") || "";
        const parsed = JSON.parse(output);
        if (!Array.isArray(parsed.rows)) throw new Error("Unexpected response");
        const rows = parsed.rows.slice(0, 8).map(r => ({
          visual: String(r.visual || "").slice(0, 1200),
          vo: String(r.vo || "").slice(0, 1800)
        }));
        return Response.json({ rows });
      } catch {
        return Response.json({ error: "Tidak bisa membuat draft AI" }, { status: 502 });
      }
    }

    return env.ASSETS.fetch(request);
  }
};
