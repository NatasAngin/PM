(()=>{
const $=id=>document.getElementById(id);
let actor=null,setupRequired=false,busy=false;
const api=async(path,body)=>{const r=await fetch(path,{method:body?"POST":"GET",headers:body?{"Content-Type":"application/json"}:{},body:body?JSON.stringify(body):undefined,credentials:"same-origin"});const d=await r.json().catch(()=>({error:"Respons server tidak valid."}));if(!r.ok)throw Error(d.error||"Permintaan gagal.");return d};
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
document.body.insertAdjacentHTML("beforeend",`
<section id="secureLogin" class="secure-login"><form id="secureLoginForm" class="secure-login-box">
<div class="eyebrow">PT BORNEO ALUMINA INDONESIA</div><h1>Preventive Maintenance IT</h1><p id="secureIntro">Memeriksa sesi...</p>
<label id="secureNameWrap" hidden>Nama lengkap<input id="secureName" maxlength="80" autocomplete="name"></label>
<label>Username<input id="secureUsername" required minlength="3" maxlength="40" autocomplete="username"></label>
<label>Password<input id="securePassword" type="password" required maxlength="128" autocomplete="current-password"></label>
<label id="secureConfirmWrap" hidden>Konfirmasi password<input id="secureConfirm" type="password" minlength="10" maxlength="128" autocomplete="new-password"></label>
<p id="secureMessage" role="status"></p><button class="primary" id="secureSubmit">Masuk</button>
</form></section>
<dialog id="secureAccounts"><div class="cardhead"><div><div class="eyebrow">PENGELOLAAN AKSES</div><h2>Kelola Akun</h2></div><button type="button" data-sec-close>✕</button></div>
<form id="secureAccountForm"><div class="pair"><label>Nama<input name="name" required maxlength="80"></label><label>Username<input name="username" required minlength="3" maxlength="40" pattern="[a-zA-Z0-9._-]{3,40}"></label></div><div class="pair"><label>Role<select name="role"><option value="user">User</option><option value="administrator">Administrator</option></select></label><label>Password awal<input name="password" type="password" required minlength="10" maxlength="128"></label></div><button class="primary">＋ Tambah akun</button><p id="secureAccountMessage"></p></form><div class="tablewrap"><table><thead><tr><th>Akun</th><th>Role</th><th>Status</th><th>Aksi</th></tr></thead><tbody id="secureAccountRows"></tbody></table></div></dialog>
`);
const style=document.createElement("style");style.textContent=`
.secure-login{position:fixed;inset:0;z-index:99999;display:grid;place-items:center;padding:20px;background:#edf3f1}
.secure-login[hidden]{display:none}.secure-login-box{width:min(440px,100%);padding:32px;background:#fff;border:1px solid #dce7e2;border-radius:18px;box-shadow:0 18px 55px #193b3020}
.secure-login-box h1{font-size:25px;margin:10px 0}.secure-login-box p{color:#657a73;line-height:1.5}
.secure-login-box label,#secureAccounts label{display:grid;gap:7px;margin:14px 0;font-size:13px;font-weight:600}
.secure-login-box input,#secureAccounts input,#secureAccounts select{width:100%;padding:12px;border:1px solid #d6e1dc;border-radius:8px;font:inherit}
#secureMessage{color:#b34d3c;min-height:20px}#secureAccounts{width:min(760px,calc(100% - 24px));max-height:85vh;overflow:auto}
#secureAccounts td button{margin:2px}.secure-login-box button{width:100%;padding:12px}
body.secure-locked aside,body.secure-locked .shell{visibility:hidden}
`;document.head.append(style);
const login=$("secureLogin"),form=$("secureLoginForm");
function lock(){document.body.classList.add("secure-locked");login.hidden=false}
function unlock(a){actor=a;login.hidden=true;document.body.classList.remove("secure-locked");window.PM_ACTOR=a;document.body.dataset.role=a.role;const bottom=document.querySelector(".sidebottom");if(bottom){bottom.innerHTML='<div class="avatar">IT</div><strong>'+esc(a.name)+'</strong><small>'+esc(a.role)+'</small><button id="secureManage" '+(a.role==="user"?"hidden":"")+'>Kelola Akun</button><button id="secureLogout">Keluar</button>'}
document.querySelectorAll('nav [data-page]').forEach(b=>{b.hidden=a.role==="user"&&b.dataset.page!=="Jadwal Maintenance"});
document.querySelectorAll("#export,#uploadCSV,#backup,#import").forEach(b=>{if(b)b.hidden=a.role==="user"});
if(a.role==="user"){$("deleteAsset")?.setAttribute("hidden","");document.querySelectorAll("[data-delete-saved-photo]").forEach(b=>b.hidden=true);document.querySelector('nav [data-page="Jadwal Maintenance"]')?.click()}
$("secureLogout")?.addEventListener("click",async()=>{try{await api("/api/auth/logout",{});location.reload()}catch(e){alert(e.message)}});
$("secureManage")?.addEventListener("click",showAccounts);
}
async function showAccounts(){try{const d=await api("/api/auth/accounts");$("secureAccountRows").innerHTML=d.accounts.map(a=>'<tr><td><b>'+esc(a.name)+'</b><small>'+esc(a.username)+'</small></td><td>'+esc(a.role)+'</td><td>'+(a.active?"Aktif":"Nonaktif")+'</td><td>'+(a.role==="Super Admin"?"—":'<button data-sec-toggle="'+esc(a.id)+'" data-active="'+(!a.active)+'">'+(a.active?"Nonaktifkan":"Aktifkan")+'</button><button data-sec-reset="'+esc(a.id)+'">Reset password</button>')+'</td></tr>').join("");$("secureAccounts").showModal()}catch(e){$("secureAccountMessage").textContent=e.message}}
$("secureAccountForm").onsubmit=async e=>{e.preventDefault();const b=Object.fromEntries(new FormData(e.target));try{await api("/api/auth/accounts",b);e.target.reset();$("secureAccountMessage").textContent="Akun berhasil dibuat.";showAccounts()}catch(err){$("secureAccountMessage").textContent=err.message}};
$("secureAccounts").addEventListener("click",async e=>{const b=e.target.closest("button");if(!b)return;if(b.hasAttribute("data-sec-close"))$("secureAccounts").close();if(b.dataset.secToggle){try{await fetch("/api/auth/accounts/"+b.dataset.secToggle,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({active:b.dataset.active==="true"})});showAccounts()}catch(err){alert(err.message)}}if(b.dataset.secReset){const p=prompt("Masukkan password baru (minimal 10 karakter):");if(p){try{await fetch("/api/auth/accounts/"+b.dataset.secReset,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({password:p})});alert("Password berhasil direset.")}catch(err){alert(err.message)}}}});
form.onsubmit=async e=>{e.preventDefault();if(busy)return;busy=true;$("secureSubmit").disabled=true;$("secureMessage").textContent="Memproses...";try{let d;if(setupRequired){if($("securePassword").value!==$("secureConfirm").value)throw Error("Konfirmasi password tidak sama.");d=await api("/api/auth/setup",{name:$("secureName").value,username:$("secureUsername").value,password:$("securePassword").value})}else d=await api("/api/auth/login",{username:$("secureUsername").value,password:$("securePassword").value});unlock(d.actor);sessionStorage.setItem("bai-pm-auth-ready","1");location.reload()}catch(err){$("secureMessage").textContent=err.message}finally{busy=false;$("secureSubmit").disabled=false}};
(async()=>{lock();try{const d=await api("/api/auth/me");setupRequired=d.setupRequired;$("secureNameWrap").hidden=!setupRequired;$("secureConfirmWrap").hidden=!setupRequired;$("secureName").required=setupRequired;$("secureConfirm").required=setupRequired;$("securePassword").minLength=setupRequired?10:1;$("secureIntro").textContent=setupRequired?"Penggunaan pertama: buat akun Super Admin. Password minimal 10 karakter.":"Masuk menggunakan akun yang terdaftar."; $("secureSubmit").textContent=setupRequired?"Buat Super Admin":"Masuk";if(d.actor){unlock(d.actor);if(sessionStorage.getItem("bai-pm-auth-ready")){sessionStorage.removeItem("bai-pm-auth-ready")}else{sessionStorage.setItem("bai-pm-auth-ready","1");location.reload()}}}catch(e){$("secureMessage").textContent="Tidak dapat memeriksa sesi: "+e.message}})();
})();