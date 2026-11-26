(()=>{'use strict';
const $=id=>document.getElementById(id);
const statuses=['Baru dicatat','Menunggu inspeksi','Dalam inspeksi','Menunggu material','Dalam perbaikan','Menunggu verifikasi','Selesai','Tidak layak pakai'];
const activeStatuses=statuses.slice(0,6);
let active=false,selectedCase=null;
const style=document.createElement('style');
style.textContent=`
#damageSection{display:none;margin:0 0 24px;animation:baiFadeUp .4s ease both}
#damageSection .damage-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px;margin:18px 0}
#damageSection .damage-kpi,#damageSection .damage-panel{background:linear-gradient(145deg,rgba(27,32,72,.88),rgba(15,27,54,.9));border:1px solid rgba(153,157,255,.2);border-radius:12px;padding:17px;box-shadow:0 12px 30px #01051830}
#damageSection .damage-kpi small{display:block;color:#aeb8dc;font-size:11px}
#damageSection .damage-kpi b{display:block;font-size:27px;color:#f2efff;margin-top:7px}
#damageSection .damage-tools{display:flex;gap:10px;flex-wrap:wrap;margin:18px 0}
#damageSection .damage-tools input,#damageSection .damage-tools select{flex:1;min-width:180px}
#damageSection .damage-table{overflow:auto}
#damageSection table{width:100%;min-width:980px;table-layout:fixed;white-space:normal}
#damageSection th,#damageSection td{padding:13px 12px;vertical-align:middle}
#damageSection td{overflow-wrap:anywhere;line-height:1.5}
#damageSection td:nth-child(1){width:19%}#damageSection td:nth-child(2){width:17%}#damageSection td:nth-child(3){width:13%}#damageSection td:nth-child(4){width:18%}#damageSection td:nth-child(5){width:15%}#damageSection td:nth-child(6){width:18%}
.damage-pill{display:inline-flex;align-items:center;border-radius:30px;padding:5px 9px;font-size:10px;font-weight:700;border:1px solid transparent;white-space:nowrap}
.damage-pill.critical{background:#7b283e55;color:#ffb5c5;border-color:#e56d8a55}
.damage-pill.high{background:#79532455;color:#ffd69b;border-color:#d5a14e55}
.damage-pill.medium{background:#315e7955;color:#b6e3ff;border-color:#68b7e655}
.damage-pill.low{background:#24654e55;color:#a5f1cd;border-color:#59d49b55}
.damage-pill.done{background:#24654e55;color:#a5f1cd;border-color:#59d49b55}
.damage-pill.open{background:#4b3b8055;color:#d4c5ff;border-color:#9d88ff55}
.damage-action{white-space:nowrap}
#damageDialog,#damageDetailDialog{width:min(760px,95vw);max-height:88vh;overflow:auto;background:linear-gradient(145deg,#171d43,#101a36);color:#eef0ff;border:1px solid rgba(164,153,255,.34)}
#damageDialog label,#damageDetailDialog label{color:#c3cbed}
#damageDialog input,#damageDialog select,#damageDialog textarea,#damageDetailDialog input,#damageDetailDialog select,#damageDetailDialog textarea{width:100%;background:rgba(12,19,47,.9);color:#eef0ff;border:1px solid rgba(153,164,255,.24)}
#damageDialog .formactions,#damageDetailDialog .formactions{justify-content:flex-end;gap:10px}
.damage-timeline{border-left:2px solid rgba(157,139,255,.35);margin:16px 0 8px 8px;padding-left:18px}
.damage-event{position:relative;padding:0 0 18px}
.damage-event:before{content:"";position:absolute;left:-24px;top:4px;width:9px;height:9px;border-radius:50%;background:#a28aff;box-shadow:0 0 12px #9b82ff}
.damage-event b{color:#f0efff;font-size:12px}.damage-event small{display:block;color:#9eabd0;margin:4px 0}
.damage-event p{color:#c2c9e7;line-height:1.55}
.damage-warning{padding:12px 14px;border:1px solid #d5a14e66;background:#79532433;color:#ffe0ae;border-radius:9px;font-size:12px;line-height:1.55;margin:12px 0}
.damage-empty{text-align:center;padding:35px;color:#aab5d9}
@media(max-width:760px){#damageSection .damage-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}#damageSection .damage-kpi{padding:13px}#damageSection .damage-kpi b{font-size:23px}.damage-tools input,.damage-tools select{flex-basis:100%}}
`;
document.head.append(style);
const section=document.createElement('section');section.id='damageSection';
section.innerHTML=`
 <div class="cardhead"><div><div class="eyebrow">INCIDENT RESPONSE • ASSET RECOVERY</div><h2>Damage & Recovery Tracking</h2><p>Lacak material terdampak dari pencatatan hingga verifikasi akhir.</p></div><button class="primary" id="damageAdd">＋ Catat material terdampak</button></div>
 <div class="damage-warning">Material yang diduga terdampak kebakaran harus diberi identitas dan diamankan sesuai prosedur area. Status "Selesai" pada aplikasi bukan izin operasi; peralatan hanya boleh digunakan kembali setelah dinyatakan aman oleh personel berwenang.</div>
 <div class="damage-kpis" id="damageKpis"></div>
 <article class="damage-panel"><div class="cardhead"><div><h2>Daftar kasus kerusakan</h2><p>Satu nomor kasus untuk setiap material yang terdampak.</p></div><span class="chip" id="damageCount">0 kasus</span></div>
 <div class="damage-tools"><input id="damageSearch" placeholder="Cari kode, material, lokasi, incident..."><select id="damageStatus"><option value="">Semua status</option>${statuses.map(s=>'<option>'+s+'</option>').join('')}</select><select id="damageSeverity"><option value="">Semua prioritas</option><option>Kritis</option><option>Tinggi</option><option>Sedang</option><option>Rendah</option></select></div>
 <div class="damage-table"><table><thead><tr><th>CASE / MATERIAL</th><th>INSIDEN / LOKASI</th><th>PRIORITAS</th><th>STATUS PEMULIHAN</th><th>PIC / FOLLOW-UP</th><th>AKSI</th></tr></thead><tbody id="damageRows"></tbody></table></div>
 <div class="tablefooter"><span id="damageShown"></span><span>Perubahan status tercatat dalam timeline.</span></div></article>
`;
const main=document.querySelector('main'),register=$('register');
main.insertBefore(section,register);
const addDialog=document.createElement('dialog');addDialog.id='damageDialog';
addDialog.innerHTML=`<form id="damageForm"><div class="cardhead"><div><div class="eyebrow">NEW DAMAGE RECORD</div><h2>Catat material terdampak</h2></div><button type="button" data-damage-close="damageDialog">✕</button></div>
 <label>Ambil dari inventaris (opsional)<select name="assetId" id="damageAsset"><option value="">Material belum terdaftar / isi manual</option></select></label>
 <div class="pair"><label>Kode material<input name="code" required maxlength="40" placeholder="MAT-001"></label><label>Nama material / peralatan<input name="name" required maxlength="100"></label></div>
 <label>Lokasi terdampak<input name="location" required maxlength="100"></label>
 <div class="pair"><label>Nama / nomor insiden<input name="incident" required maxlength="100" value="Kebakaran Area"></label><label>Tanggal kejadian<input name="incidentDate" type="date" required></label></div>
 <div class="pair"><label>Tingkat prioritas<select name="severity"><option>Kritis</option><option selected>Tinggi</option><option>Sedang</option><option>Rendah</option></select></label><label>Penanggung jawab / PIC<input name="assignedTo" required maxlength="80"></label></div>
 <div class="pair"><label>Status awal<select name="status"><option>Baru dicatat</option><option>Menunggu inspeksi</option></select></label><label>Tanggal tindak lanjut berikutnya<input name="followUpDate" type="date" required></label></div>
 <label>Deskripsi kerusakan / temuan<textarea name="description" rows="3" required maxlength="1500" placeholder="Contoh: isolasi kabel meleleh, casing menghitam..."></textarea></label>
 <div class="formactions"><button type="button" data-damage-close="damageDialog">Batal</button><button class="primary">Simpan kasus kerusakan</button></div></form>`;
const detailDialog=document.createElement('dialog');detailDialog.id='damageDetailDialog';
detailDialog.innerHTML=`<div class="cardhead"><div><div class="eyebrow">DAMAGE CASE HISTORY</div><h2 id="damageDetailTitle">Detail kasus</h2></div><button type="button" data-damage-close="damageDetailDialog">✕</button></div><div id="damageDetailBody"></div>`;
document.body.append(addDialog,detailDialog);
const fmtDate=s=>new Date(s+'T12:00:00').toLocaleDateString('id-ID',{day:'numeric',month:'short',year:'numeric'});
const actorName=()=>window.PM_ACTOR?.name||'Pengguna PM';
const pill=(s,sev=false)=>'<span class="damage-pill '+(sev?({Kritis:'critical',Tinggi:'high',Sedang:'medium',Rendah:'low'}[s]||'open'):(s==='Selesai'?'done':s==='Tidak layak pakai'?'critical':'open'))+'">'+esc(s)+'</span>';
function ensureCases(){if(!Array.isArray(state.damageCases))state.damageCases=[]}
function renderDamage(){
 ensureCases();$('overview').hidden=true;register.hidden=true;section.style.display='block';$('title').textContent='Damage & Recovery Tracking';$('crumb').textContent='Damage Tracking';$('add').hidden=true;$('export').hidden=true;
 const cases=state.damageCases,open=cases.filter(c=>!['Selesai','Tidak layak pakai'].includes(c.status)),critical=cases.filter(c=>c.severity==='Kritis'&&!['Selesai','Tidak layak pakai'].includes(c.status)),repair=cases.filter(c=>['Dalam perbaikan','Menunggu verifikasi'].includes(c.status)),late=cases.filter(c=>!['Selesai','Tidak layak pakai'].includes(c.status)&&c.followUpDate<now());
 $('damageKpis').innerHTML=[['Total kasus',cases.length],['Masih ditangani',open.length],['Prioritas kritis',critical.length],['Follow-up terlambat',late.length]].map(([n,v])=>'<div class="damage-kpi"><small>'+n+'</small><b>'+v+'</b></div>').join('');
 const q=$('damageSearch').value.toLowerCase(),s=$('damageStatus').value,v=$('damageSeverity').value;
 const list=cases.filter(c=>(!s||c.status===s)&&(!v||c.severity===v)&&[c.id,c.code,c.name,c.location,c.incident,c.assignedTo].join(' ').toLowerCase().includes(q)).sort((a,b)=>a.followUpDate.localeCompare(b.followUpDate)||a.incidentDate.localeCompare(b.incidentDate));
 $('damageCount').textContent=cases.length+' kasus';$('damageShown').textContent='Menampilkan '+list.length+' kasus';
 $('damageRows').innerHTML=list.map(c=>'<tr><td><strong>'+esc(c.id)+'</strong><small>'+esc(c.code)+' · '+esc(c.name)+'</small></td><td>'+esc(c.incident)+'<small>'+esc(c.location)+' · '+fmtDate(c.incidentDate)+'</small></td><td>'+pill(c.severity,true)+'</td><td>'+pill(c.status)+'<small>'+esc(c.description.slice(0,95))+(c.description.length>95?'…':'')+'</small></td><td>'+esc(c.assignedTo||'Belum ditentukan')+'<small>Follow-up: '+fmtDate(c.followUpDate)+'</small></td><td><button class="damage-action" data-damage-detail="'+esc(c.id)+'">Detail / Update ↗</button></td></tr>').join('')||'<tr><td colspan="6" class="damage-empty">Belum ada kasus kerusakan. Catat material terdampak untuk mulai tracking.</td></tr>';
}
function showDamagePage(){active=true;document.querySelectorAll('#overview,#register').forEach(x=>x.hidden=true);renderDamage();document.querySelectorAll('nav button').forEach(b=>b.classList.toggle('active',b.id==='damageNav'))}
function hideDamagePage(){active=false;section.style.display='none';$('add').hidden=false;$('export').hidden=false}
const originalRender=window.render;
if(typeof originalRender==='function')window.render=function(){originalRender();if(active)renderDamage()};
const nav=$('damageNav');
nav?.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();showDamagePage()},true);
$('damageAdd').onclick=()=>{
 const f=$('damageForm');f.reset();const sel=$('damageAsset');
 sel.innerHTML='<option value="">Material belum terdaftar / isi manual</option>'+state.assets.map(a=>'<option value="'+esc(a.id)+'">'+esc(a.code)+' · '+esc(a.name)+' — '+esc(a.location)+'</option>').join('');
 f.elements.incidentDate.value=now();f.elements.followUpDate.value=now();f.elements.status.value='Baru dicatat';f.elements.incident.value='Kebakaran Area';addDialog.showModal();
};
$('damageAsset').onchange=e=>{const a=state.assets.find(x=>x.id===e.target.value);if(a){$('damageForm').elements.code.value=a.code;$('damageForm').elements.name.value=a.name;$('damageForm').elements.location.value=a.location}};
$('damageForm').onsubmit=e=>{
 e.preventDefault();const raw=Object.fromEntries(new FormData(e.target)),id='DMG-'+new Date().getFullYear()+'-'+String(Date.now()).slice(-6);
 const c={id,assetId:raw.assetId||'',code:raw.code.trim(),name:raw.name.trim(),location:raw.location.trim(),incident:raw.incident.trim(),incidentDate:raw.incidentDate,severity:raw.severity,status:raw.status,assignedTo:raw.assignedTo.trim(),followUpDate:raw.followUpDate,description:raw.description.trim(),timeline:[{date:now(),status:raw.status,note:'Kasus kerusakan dibuat. '+raw.description.trim(),by:actorName()}]};
 const next={...state,damageCases:[...(state.damageCases||[]),c]};if(commit(next)){addDialog.close();renderDamage();toast('Kasus '+id+' berhasil dicatat dan disinkronkan.')}
};
function openDamageDetail(id){
 const c=state.damageCases.find(x=>x.id===id);if(!c)return;selectedCase=id;
 $('damageDetailTitle').textContent=c.id+' · '+c.code;
 $('damageDetailBody').innerHTML=`<div class="damage-warning">Status operasional aset tidak berubah otomatis. Jangan gunakan material/peralatan terdampak sebelum inspeksi dan persetujuan teknis.</div>
 <dl><dt>Material</dt><dd>${esc(c.name)}</dd><dt>Lokasi</dt><dd>${esc(c.location)}</dd><dt>Insiden</dt><dd>${esc(c.incident)} · ${fmtDate(c.incidentDate)}</dd><dt>Prioritas</dt><dd>${pill(c.severity,true)}</dd><dt>Status saat ini</dt><dd>${pill(c.status)}</dd><dt>PIC</dt><dd>${esc(c.assignedTo)}</dd><dt>Deskripsi</dt><dd>${esc(c.description)}</dd><dt>Follow-up</dt><dd>${fmtDate(c.followUpDate)}</dd></dl>
 <h3>Update tracking</h3><form id="damageUpdateForm"><div class="pair"><label>Status baru<select name="status">${statuses.map(s=>'<option '+(s===c.status?'selected':'')+'>'+s+'</option>').join('')}</select></label><label>PIC<input name="assignedTo" required maxlength="80" value="${esc(c.assignedTo)}"></label></div><label>Follow-up berikutnya<input name="followUpDate" type="date" required value="${c.followUpDate}"></label><label>Catatan update<textarea name="note" rows="3" required maxlength="1000" placeholder="Apa yang sudah dilakukan / kendala / keputusan inspeksi?"></textarea></label><div class="formactions"><button class="primary">Simpan update status</button></div></form>
 <h3>Timeline aktivitas</h3><div class="damage-timeline">${c.timeline.slice().reverse().map(t=>'<div class="damage-event"><b>'+esc(t.status)+'</b><small>'+fmtDate(t.date)+' · '+esc(t.by)+'</small><p>'+esc(t.note)+'</p></div>').join('')}</div>`;
 $('damageUpdateForm').onsubmit=e=>{e.preventDefault();const raw=Object.fromEntries(new FormData(e.target)),nextCases=state.damageCases.map(x=>x.id===id?{...x,status:raw.status,assignedTo:raw.assignedTo.trim(),followUpDate:raw.followUpDate,timeline:[...x.timeline,{date:now(),status:raw.status,note:raw.note.trim(),by:actorName()}]}:x);if(commit({...state,damageCases:nextCases})){detailDialog.close();renderDamage();toast('Timeline '+id+' berhasil diperbarui.')}};
 detailDialog.showModal();
}
document.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.damageClose){$(b.dataset.damageClose).close();return}if(b.dataset.damageDetail)openDamageDetail(b.dataset.damageDetail)});
['damageSearch','damageStatus','damageSeverity'].forEach(id=>$(id).addEventListener('input',renderDamage));
document.addEventListener('click',e=>{const b=e.target.closest('button[data-page]');if(b&&active){hideDamagePage()}},true);
})();
