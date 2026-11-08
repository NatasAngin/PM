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


function allowedUserStateChange(before, after) {
  if (!before || !after || after.version !== before.version || !Array.isArray(before.assets) || !Array.isArray(after.assets) || !Array.isArray(before.history) || !Array.isArray(after.history)) return false;
  const clean = x => ({...x, demo:undefined, assets:x.assets, history:x.history.map(h=>{const c={...h};delete c.photos;return c;})});\n  before=clean(before); after=clean(after);\n  const strip = (x, keys) => Object.fromEntries(Object.entries(x).filter(([k]) => !keys.includes(k)));
  if (JSON.stringify(strip(before,["assets","history"])) !== JSON.stringify(strip(after,["assets","history"]))) return false;
  if (JSON.stringify(before.history) === JSON.stringify(after.history) && after.assets.length >= before.assets.length) {
    if (JSON.stringify(after.assets.slice(0,before.assets.length)) === JSON.stringify(before.assets)) return true;
    if (after.assets.length === before.assets.length) {
      let changed=0;
      for(let i=0;i<before.assets.length;i++) if(JSON.stringify(before.assets[i])!==JSON.stringify(after.assets[i])) {
        changed++;
        if(after.assets[i]?.id!==before.assets[i]?.id) return false;
      }
      return changed===1;
    }
  }
  if(after.history.length!==before.history.length+1 || after.assets.length!==before.assets.length || JSON.stringify(after.history.slice(0,-1))!==JSON.stringify(before.history)) return false;
  const h=after.history.at(-1), asset=before.assets.find(a=>a.id===h.assetId);
  if(!asset || h.code!==asset.code || h.name!==asset.name || h.scheduled!==asset.due) return false;
  let changed=0;
  for(let i=0;i<before.assets.length;i++) {
    const old=before.assets[i], next=after.assets[i];
    if(old.id!==next.id) return false;
    if(JSON.stringify(old)!==JSON.stringify(next)) {
      changed++;
      if(old.id!==asset.id || next.due!==h.next || next.condition!==h.condition) return false;
    }
  }
  return changed===1;
}

async function saveState(request, env, actor) {
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

  if (actor?.role === "user") {
    const previous = await env.DB.prepare("SELECT payload FROM pm_state WHERE id=1").first();
    if (!previous || !allowedUserStateChange(JSON.parse(previous.payload), state)) return json({error:"Akun User hanya dapat menambah/mengedit aset dan mencatat hasil maintenance. Perubahan ini ditolak server."},403);
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


const AUTH_ITERATIONS = 100000;
const cookieName = "bai_pm_session";
const bytesToHex = bytes => Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2,"0")).join("");
const randomHex = n => bytesToHex(crypto.getRandomValues(new Uint8Array(n)));
async function digest(value) {
  return bytesToHex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
}
async function passwordHash(password, salt) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  return bytesToHex(await crypto.subtle.deriveBits({name:"PBKDF2", salt:new Uint8Array(salt.match(/../g).map(x=>parseInt(x,16))), iterations:AUTH_ITERATIONS, hash:"SHA-256"}, key, 256));
}
function cookie(request) {
  return (request.headers.get("Cookie") || "").split(";").map(x=>x.trim()).find(x=>x.startsWith(cookieName+"="))?.slice(cookieName.length+1) || "";
}
function sessionCookie(token, maxAge=60*60*24*7) {
  return cookieName+"="+token+"; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age="+maxAge;
}
async function currentActor(request, env) {
  const token = cookie(request);
  if (!token) return null;
  const row = await env.DB.prepare("SELECT a.id,a.username,a.display_name,a.role,a.active,a.version,s.account_version,s.expires_at FROM auth_sessions s JOIN auth_accounts a ON a.id=s.account_id WHERE s.token_hash=?").bind(await digest(token)).first();
  if (!row || !row.active || row.expires_at <= new Date().toISOString() || row.version !== row.account_version) return null;
  return {id:row.id,username:row.username,name:row.display_name,role:row.role,active:!!row.active,version:row.version};
}
async function issueSession(actor, env) {
  const token=randomHex(32), expires=new Date(Date.now()+7*86400000).toISOString();
  await env.DB.prepare("INSERT INTO auth_sessions(token_hash,account_id,account_version,expires_at) VALUES(?,?,?,?)").bind(await digest(token),actor.id,actor.version,expires).run();
  return token;
}
async function authApi(request, env, url) {
  const path=url.pathname, method=request.method;
  if(path==="/api/auth/setup" && method==="POST"){
    const count=await env.DB.prepare("SELECT COUNT(*) AS n FROM auth_accounts").first();
    if(count.n) return json({error:"Setup sudah dilakukan."},409);
    let body; try{body=await request.json()}catch{return json({error:"JSON tidak valid."},400)}
    const username=String(body.username||"").trim().toLowerCase(), name=String(body.name||"").trim(), password=String(body.password||"");
    if(!/^[a-z0-9._-]{3,40}$/.test(username)||!name||name.length>80||password.length<10||password.length>128) return json({error:"Nama, username, atau password tidak memenuhi ketentuan."},400);
    const salt=randomHex(16), hash=await passwordHash(password,salt), id=crypto.randomUUID();
    await env.DB.prepare("INSERT INTO auth_accounts(id,username,display_name,role,active,salt,password_hash) VALUES(?,?,?,'Super Admin',1,?,?)").bind(id,username,name,salt,hash).run();
    const actor={id,username,name,role:"Super Admin",active:true,version:1}, token=await issueSession(actor,env);
    return new Response(JSON.stringify({ok:true,actor}),{headers:{"Content-Type":"application/json","Cache-Control":"no-store","Set-Cookie":sessionCookie(token)}});
  }
  if(path==="/api/auth/login" && method==="POST"){
    let body; try{body=await request.json()}catch{return json({error:"JSON tidak valid."},400)}
    const username=String(body.username||"").trim().toLowerCase(), password=String(body.password||"");
    const a=await env.DB.prepare("SELECT * FROM auth_accounts WHERE username=? COLLATE NOCASE").bind(username).first();
    if(!a||!a.active||await passwordHash(password,a.salt)!==a.password_hash) return json({error:"Username atau password tidak sesuai."},401);
    const actor={id:a.id,username:a.username,name:a.display_name,role:a.role,active:true,version:a.version}, token=await issueSession(actor,env);
    return new Response(JSON.stringify({ok:true,actor}),{headers:{"Content-Type":"application/json","Cache-Control":"no-store","Set-Cookie":sessionCookie(token)}});
  }
  if(path==="/api/auth/logout" && method==="POST"){
    const token=cookie(request); if(token) await env.DB.prepare("DELETE FROM auth_sessions WHERE token_hash=?").bind(await digest(token)).run();
    return new Response(JSON.stringify({ok:true}),{headers:{"Content-Type":"application/json","Set-Cookie":sessionCookie("",0)}});
  }
  if(path==="/api/auth/me" && method==="GET"){
    const actor=await currentActor(request,env);
    if(actor)return json({actor});
    const count=await env.DB.prepare("SELECT COUNT(*) AS n FROM auth_accounts").first();
    return json({actor:null,setupRequired:!count.n});
  }
  const actor=await currentActor(request,env);
  if(!actor)return json({error:"Sesi tidak valid. Silakan login kembali."},401);
  if(path==="/api/auth/accounts" && method==="GET"){
    if(actor.role==="user")return json({error:"Akses ditolak."},403);
    const {results=[]}=await env.DB.prepare("SELECT id,username,display_name AS name,role,active,created_at FROM auth_accounts ORDER BY created_at").all();
    return json({accounts:results});
  }
  if(path==="/api/auth/accounts" && method==="POST"){
    let b;try{b=await request.json()}catch{return json({error:"JSON tidak valid."},400)}
    const role=String(b.role||""),username=String(b.username||"").trim().toLowerCase(),name=String(b.name||"").trim(),password=String(b.password||"");
    if(!(role==="user"&&(actor.role==="Super Admin"||actor.role==="administrator")||role==="administrator"&&actor.role==="Super Admin"))return json({error:"Tidak memiliki hak membuat role tersebut."},403);
    if(!/^[a-z0-9._-]{3,40}$/.test(username)||!name||name.length>80||password.length<10||password.length>128)return json({error:"Data akun tidak valid."},400);
    const salt=randomHex(16),hash=await passwordHash(password,salt);
    try{await env.DB.prepare("INSERT INTO auth_accounts(id,username,display_name,role,active,salt,password_hash) VALUES(?,?,?,?,1,?,?)").bind(crypto.randomUUID(),username,name,role,salt,hash).run()}
    catch{return json({error:"Username sudah digunakan."},409)}
    return json({ok:true});
  }
  if(path.startsWith("/api/auth/accounts/") && method==="PATCH"){
    const id=path.split("/").pop(), target=await env.DB.prepare("SELECT * FROM auth_accounts WHERE id=?").bind(id).first();
    if(!target||target.role==="Super Admin"||!(actor.role==="Super Admin"||actor.role==="administrator"&&target.role==="user"))return json({error:"Tidak dapat mengelola akun ini."},403);
    let b;try{b=await request.json()}catch{return json({error:"JSON tidak valid."},400)}
    if(b.active!==undefined)await env.DB.prepare("UPDATE auth_accounts SET active=?,version=version+1 WHERE id=?").bind(b.active?1:0,id).run();
    if(b.password){if(b.password.length<10||b.password.length>128)return json({error:"Password harus 10–128 karakter."},400);const salt=randomHex(16),hash=await passwordHash(b.password,salt);await env.DB.prepare("UPDATE auth_accounts SET salt=?,password_hash=?,version=version+1 WHERE id=?").bind(salt,hash,id).run()}
    return json({ok:true});
  }
  if(path==="/api/auth/password" && method==="POST"){
    let b;try{b=await request.json()}catch{return json({error:"JSON tidak valid."},400)}
    const row=await env.DB.prepare("SELECT salt,password_hash FROM auth_accounts WHERE id=?").bind(actor.id).first();
    if(!row||await passwordHash(String(b.old||""),row.salt)!==row.password_hash)return json({error:"Password saat ini tidak sesuai."},400);
    const next=String(b.next||"");if(next.length<10||next.length>128)return json({error:"Password baru harus 10–128 karakter."},400);
    const salt=randomHex(16),hash=await passwordHash(next,salt);
    await env.DB.prepare("UPDATE auth_accounts SET salt=?,password_hash=?,version=version+1 WHERE id=?").bind(salt,hash,actor.id).run();
    await env.DB.prepare("DELETE FROM auth_sessions WHERE account_id=?").bind(actor.id).run();
    return new Response(JSON.stringify({ok:true}),{headers:{"Content-Type":"application/json","Set-Cookie":sessionCookie("",0)}});
  }
  return json({error:"Endpoint autentikasi tidak ditemukan."},404);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/auth/")) return authApi(request, env, url);
    if (url.pathname === "/api/health") {
      try { await env.DB.prepare("SELECT 1").first(); return json({ok:true,service:"BAI Preventive Maintenance",database:"connected"}); }
      catch { return json({ok:false,error:"D1 belum terhubung."},503); }
    }
    if (url.pathname === "/api/state") {
      const actor = await currentActor(request, env);
      if (!actor) return json({error:"Silakan login terlebih dahulu."},401);
      if (request.method === "GET") {
        try { return json({state:await readState(env),actor}); }
        catch { return json({error:"Gagal membaca database D1."},500); }
      }
      if (request.method === "PUT") return saveState(request, env, actor);
      return json({error:"Method tidak didukung."},405);
    }
    return env.ASSETS.fetch(request);
  }
};
