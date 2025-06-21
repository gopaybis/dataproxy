// index.js
export default {
  async fetch(request, env) {
    if (request.method === "POST") {
      try {
        const { ip, port } = await request.json();
        const url = `https://apihealtcheck.vercel.app/api/v1?ip=${ip}&port=${port}`;
        const res = await fetch(url);
        const data = await res.json();

        if (data && typeof data === "object" && data.proxyip) {
          const country = data?.countryCode || "-";
          const org = data?.asOrganization || "-";
          const line = `${ip},${port},${country},${org}\n`;

          try {
            if (env.GITHUB_TOKEN) {
              console.log("💾 Menyimpan ke GitHub:", line.trim());
              await saveUniqueLineToGitHub(line, `${ip},${port}`, env.GITHUB_TOKEN);
            }
          } catch (err) {
            console.log("⚠️ GitHub Save Error:", err.message);
          }
        }

        return new Response(JSON.stringify(data), {
          headers: { "Content-Type": "application/json" }
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: true, message: err.message }), {
          headers: { "Content-Type": "application/json" }
        });
      }
    }

    // ===== Web UI response (HTML code) =====
    return new Response(`<!DOCTYPE html>
<!-- HTML dipangkas untuk ringkas -->
<body>
  <h2>🔥 Proxy Checker</h2>
  <!-- Textarea dan tombol -->
  <textarea id="input" rows="6" placeholder="Masukkan proxy manual, contoh: IP:PORT\\n..."></textarea>
  <button onclick="startCheck()">Mulai Cek</button>
  <!-- Hasil -->
  <table><thead><tr><th>No</th><th>IP</th><th>Port</th><th>Status</th><th>Country</th><th>Org</th><th>Protocol</th><th>Delay</th></tr></thead><tbody id="result"></tbody></table>
  <script>
    async function startCheck() {
      const lines = document.getElementById('input').value.trim().split('\\n');
      for (let i = 0; i < lines.length; i++) {
        const [ip, port] = lines[i].split(':');
        const res = await fetch(location.href, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ip, port })
        });
        const data = await res.json();
        const row = document.getElementById('result').insertRow();
        row.insertCell().textContent = i + 1;
        row.insertCell().textContent = ip;
        row.insertCell().textContent = port;
        const status = row.insertCell();
        status.textContent = data.proxyip ? 'Active' : 'Inactive';
        status.className = data.proxyip ? 'green' : 'red';
        row.insertCell().textContent = data.countryCode || '-';
        row.insertCell().textContent = data.asOrganization || '-';
        row.insertCell().textContent = data.httpProtocol || '-';
        row.insertCell().textContent = data.delay || '-';
      }
    }
  </script>
</body>`, {
      headers: { "Content-Type": "text/html" }
    });
  }
}

// Fungsi penyimpanan ke GitHub
async function saveUniqueLineToGitHub(line, ipPortKey, token) {
  const owner = "gopaybis";
  const repo = "Proxylist";
  const path = "data-proxy.txt";
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;

  let sha = null;
  let oldContent = "";

  const getRes = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github.v3+json"
    }
  });

  if (getRes.ok) {
    const json = await getRes.json();
    sha = json.sha;
    oldContent = atob(json.content.replace(/\\n/g, ""));
    if (oldContent.includes(ipPortKey)) {
      console.log("✅ Sudah ada, tidak disimpan ulang:", ipPortKey);
      return;
    }
  }

  const newContent = oldContent + line;
  const encodedContent = btoa(unescape(encodeURIComponent(newContent)));

  const putRes = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github.v3+json"
    },
    body: JSON.stringify({
      message: "Append new proxy (no duplicate)",
      content: encodedContent,
      sha
    })
  });

  if (putRes.ok) {
    console.log("✅ Berhasil disimpan ke GitHub:", ipPortKey);
  } else {
    const error = await putRes.json();
    console.log("❌ Gagal simpan GitHub:", error.message);
  }
}
