const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }
});

async function readState(env) {
  const row = await env.DB.prepare("SELECT payload FROM pm_state WHERE id = 1").first();
  if (!row) return null;
  const state = JSON.parse(row.payload);
  const { results = [] } = await env.DB.prepare(
    "SELECT history_id, photo_index, name, data FROM pm_photos ORDER BY history_id, photo_index"
  ).all();
  const byHistory = new Map();
  for (const p of results) {
    if (!byHistory.has(p.history_id)) byHistory.set(p.history_id, []);
    byHistory.get(p.history_id).push({ name: p.name, data: p.data });
  }
  for (const h of state.history || []) h.photos = byHistory.get(h.id) || [];
  return state;
}

async function saveState(request, env) {
  const declaredLength = Number(request.headers.get("content-length") || 0);
  if (declaredLength > 35 * 1024 * 1024) return json({ error: "Payload melebihi 35 MB." }, 413);

  let state;
  try { state = await request.json(); }
  catch { return json({ error: "Body JSON tidak valid." }, 400); }

  if (!state || state.version !== 1 || !Array.isArray(state.assets) ||
      !Array.isArray(state.history) || state.assets.length > 10000 ||
      state.history.length > 50000) {
    return json({ error: "Struktur data Preventive Maintenance tidak valid." }, 400);
  }

  const photos = [];
  const photoKeys = new Set();
  for (const h of state.history) {
    const items = Array.isArray(h.photos) ? h.photos : [];
    if (items.length > 5) return json({ error: "Maksimal 5 foto per riwayat pekerjaan." }, 400);
    h.photos = [];
    for (let i = 0; i < items.length; i++) {
      const p = items[i];
      if (!p || typeof p.name !== "string" || p.name.length > 150 ||
          typeof p.data !== "string" || p.data.length > 450000 ||
          !/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(p.data)) {
        return json({ error: "Format atau ukuran foto tidak valid." }, 400);
      }
      const key = `${h.id}:${i}`;
      photoKeys.add(key);
      photos.push({ historyId: String(h.id), index: i, name: p.name, data: p.data });
    }
  }

  const payload = JSON.stringify(state);
  if (new TextEncoder().encode(payload).length > 1_800_000) {
    return json({ error: "Data teks melebihi batas aman 1,8 MB. Ekspor cadangan dan arsipkan riwayat lama." }, 413);
  }

  // Automatic daily snapshot: preserve the previous state and its photos before overwrite.
  const lastBackup = await env.DB.prepare(
    "SELECT created_at FROM pm_backups ORDER BY created_at DESC LIMIT 1"
  ).first();
  const shouldBackup = !lastBackup ||
    (Date.now() - Date.parse(lastBackup.created_at.replace(" ", "T") + "Z")) >= 24 * 60 * 60 * 1000;

  if (shouldBackup) {
    const previous = await env.DB.prepare("SELECT payload FROM pm_state WHERE id = 1").first();
    if (previous) {
      const backupId = crypto.randomUUID();
      await env.DB.prepare(
        "INSERT INTO pm_backups (id, payload, created_at) VALUES (?, ?, CURRENT_TIMESTAMP)"
      ).bind(backupId, previous.payload).run();

      const { results: previousPhotos = [] } = await env.DB.prepare(
        "SELECT history_id, photo_index, name, data FROM pm_photos"
      ).all();
      for (let i = 0; i < previousPhotos.length; i += 50) {
        const batch = previousPhotos.slice(i, i + 50).map(p => env.DB.prepare(
          "INSERT INTO pm_backup_photos (backup_id, history_id, photo_index, name, data) VALUES (?, ?, ?, ?, ?)"
        ).bind(backupId, p.history_id, p.photo_index, p.name, p.data));
        await env.DB.batch(batch);
      }

      // Keep the 30 most recent daily snapshots.
      const { results: expired = [] } = await env.DB.prepare(
        "SELECT id FROM pm_backups ORDER BY created_at DESC LIMIT -1 OFFSET 30"
      ).all();
      for (const old of expired) {
        await env.DB.prepare("DELETE FROM pm_backup_photos WHERE backup_id = ?").bind(old.id).run();
        await env.DB.prepare("DELETE FROM pm_backups WHERE id = ?").bind(old.id).run();
      }
    }
  }

  await env.DB.prepare(
    "INSERT INTO pm_state (id, payload, updated_at) VALUES (1, ?, CURRENT_TIMESTAMP) " +
    "ON CONFLICT(id) DO UPDATE SET payload = excluded.payload, updated_at = CURRENT_TIMESTAMP"
  ).bind(payload).run();

  const { results: current = [] } = await env.DB.prepare(
    "SELECT history_id, photo_index, name, data FROM pm_photos"
  ).all();
  const currentMap = new Map(current.map(p => [`${p.history_id}:${p.photo_index}`, p]));
  const statements = [];

  for (const old of current) {
    if (!photoKeys.has(`${old.history_id}:${old.photo_index}`)) {
      statements.push(env.DB.prepare(
        "DELETE FROM pm_photos WHERE history_id = ? AND photo_index = ?"
      ).bind(old.history_id, old.photo_index));
    }
  }
  for (const p of photos) {
    const old = currentMap.get(`${p.historyId}:${p.index}`);
    if (!old || old.name !== p.name || old.data !== p.data) {
      statements.push(env.DB.prepare(
        "INSERT INTO pm_photos (history_id, photo_index, name, data) VALUES (?, ?, ?, ?) " +
        "ON CONFLICT(history_id, photo_index) DO UPDATE SET name = excluded.name, data = excluded.data"
      ).bind(p.historyId, p.index, p.name, p.data));
    }
  }

  for (let i = 0; i < statements.length; i += 50) {
    await env.DB.batch(statements.slice(i, i + 50));
  }
  return json({ ok: true, updatedAt: new Date().toISOString(), photoCount: photos.length });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/health") {
      try {
        await env.DB.prepare("SELECT 1").first();
        return json({ ok: true, service: "BAI Preventive Maintenance", database: "connected" });
      } catch (error) {
        return json({ ok: false, error: "D1 belum terhubung." }, 503);
      }
    }
    if (url.pathname === "/api/state") {
      if (request.method === "GET") {
        try { return json({ state: await readState(env) }); }
        catch (error) { return json({ error: "Gagal membaca database D1." }, 500); }
      }
      if (request.method === "PUT") return saveState(request, env);
      return json({ error: "Method tidak didukung." }, 405);
    }
    return env.ASSETS.fetch(request);
  }
};
