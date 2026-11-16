/* Additive maintenance workflow updates. Existing Cloudflare auth, D1 sync and photo handling remain in place. */
(()=>{
  const $=id=>document.getElementById(id);
  const actor=()=>window.PM_ACTOR||null;
  const isManager=()=>['Super Admin','administrator'].includes(actor()?.role);
  const baseOpenComplete=openComplete;
  openComplete=function(id){
    if(isManager()){viewMaintenanceResults(id);return}
    baseOpenComplete(id);
    const f=$('completeForm');
    f.querySelectorAll('#checks input[type="checkbox"]').forEach(x=>x.required=false);
    const a=state.assets.find(x=>x.id===id);
    if(a){
      f.elements.interval.value=String([1,3,6,12].includes(Number(a.interval))?a.interval:3);
      f.elements.next.value=PM.addMonths(f.elements.date.value,Number(f.elements.interval.value));
      $('checks').insertAdjacentHTML('afterbegin','<p class="checklist-help">Centang item yang sudah dikerjakan. Item yang belum selesai wajib dijelaskan pada hasil pekerjaan atau tindak lanjut.</p>');
    }
  };
  function recalculateNext(){
    const f=$('completeForm');
    if(PM.validDate(f.elements.date.value))f.elements.next.value=PM.addMonths(f.elements.date.value,Number(f.elements.interval.value));
  }
  $('completeForm').elements.date.addEventListener('change',recalculateNext);
  $('completeForm').elements.interval.addEventListener('change',recalculateNext);
  $('completeForm').onsubmit=e=>{
    e.preventDefault();
    if(isManager()){toast('Administrator hanya dapat melihat hasil maintenance.');return}
    if(photoBusy){toast('Tunggu hingga foto selesai diproses.');return}
    const f=e.target,raw=Object.fromEntries(new FormData(f)),a=state.assets.find(x=>x.id===completeId);
    if(!a||!PM.validDate(raw.date)||raw.date>now()){toast('Tanggal pelaksanaan harus valid dan tidak boleh di masa depan.');return}
    const interval=Number(raw.interval),nextDate=raw.next;
    if(![1,3,6,12].includes(interval)||!PM.validDate(nextDate)||nextDate<=raw.date){toast('Pilih interval perawatan dan jadwal berikutnya setelah tanggal pelaksanaan.');return}
    const checklistResults=a.checklist.map((_,i)=>raw['check'+i]==='on');
    if(!raw.notes?.trim()){toast(checklistResults.some(v=>!v)?'Jelaskan item checklist yang belum dicentang pada hasil pekerjaan atau tindak lanjut.':'Isi hasil pekerjaan atau tindak lanjut sebelum menyimpan.');return}
    const h={id:uid(),assetId:a.id,code:a.code,name:a.name,category:a.category,location:a.location,scheduled:a.due,date:raw.date,technician:raw.technician.trim(),condition:raw.condition,notes:raw.notes.trim(),checklist:a.checklist.slice(),checklistResults,next:nextDate,interval,photos:pendingPhotos.slice()};
    const next={...state,assets:state.assets.map(x=>x.id===a.id?{...x,due:nextDate,condition:raw.condition,lastMaintenance:raw.date,interval,pic:raw.technician.trim()}:x),history:[...state.history,h]};
    if(commit(next)){$('completeDialog').close();toast('Hasil maintenance dicatat, PIC diperbarui, dan jadwal berikutnya dihitung ulang.')}
  };
  const baseHistoryDetail=historyDetail;
  function maintenanceResults(assetId){return state.history.filter(h=>h.assetId===assetId).sort((a,b)=>b.date.localeCompare(a.date))}
  function viewMaintenanceResults(assetId){
    if(!isManager())return;
    const results=maintenanceResults(assetId);
    if(!results.length){const a=state.assets.find(x=>x.id===assetId);if(!a)return;$('historyDetail').innerHTML='<h3>'+esc(a.code)+' · '+esc(a.name)+'</h3><p class="empty">Belum ada hasil maintenance yang dicatat untuk peralatan ini.</p>';$('historyDialog').showModal();return}
    historyDetail(results[0].id);
  }
  historyDetail=function(id){
    baseHistoryDetail(id);
    const h=state.history.find(x=>x.id===id);if(!h)return;
    const checks=$('historyDetail').querySelector('h3');
    const headings=[...$('historyDetail').querySelectorAll('h3')];
    const checkHeading=headings.find(x=>/Checklist selesai/i.test(x.textContent));
    if(checkHeading){
      const list=checkHeading.nextElementSibling;
      const items=list?.tagName==='UL'?list.querySelectorAll('li'):[];
      checkHeading.textContent='Checklist pelaksanaan';
      if(list?.tagName==='UL'){
        list.innerHTML=h.checklist.map((item,i)=>{
          const done=h.checklistResults?.[i]??true;
          return '<li>'+(done?'✓ Selesai: ':'○ Belum selesai: ')+esc(item)+'</li>';
        }).join('');
        const count=h.checklistResults?h.checklistResults.filter(Boolean).length:h.checklist.length;
        const summary=document.createElement('p');summary.textContent=count+' dari '+h.checklist.length+' item selesai';list.before(summary);
      }
    }
    if(isManager()){
      const photoInput=$('historyDetail').querySelector('#historyPhotos');
      if(photoInput)photoInput.closest('label').hidden=true;
      $('historyDetail').querySelectorAll('[data-delete-saved-photo]').forEach(b=>b.hidden=true);
      const results=maintenanceResults(h.assetId);
      const wrap=document.createElement('label');wrap.textContent='Pilih pelaksanaan maintenance ';
      const select=document.createElement('select');select.id='resultSelection';
      select.innerHTML=results.map(r=>'<option value="'+esc(r.id)+'" '+(r.id===id?'selected':'')+'>'+esc(fmt(r.date))+' · '+esc(r.technician)+'</option>').join('');
      select.addEventListener('change',()=>historyDetail(select.value));wrap.append(select);
      $('historyDetail').prepend(wrap);
    }
  };
  const baseRender=render;
  render=function(){baseRender();if(isManager())document.querySelectorAll('[data-complete]').forEach(b=>{b.textContent='Lihat hasil';b.title='Lihat hasil maintenance sebelumnya'})};
  // New records use only the three categories in the supplied update. Legacy categories remain readable/editable.
  const category=$('assetForm').elements.category;
  const allowed=['CCTV','Jaringan','Kabinet (Rak Server)'];
  const originalOpenAsset=openAsset;
  openAsset=function(id){
    originalOpenAsset(id);
    const current=state.assets.find(a=>a.id===id);
    [...category.options].forEach(o=>{o.hidden=!allowed.includes(o.value)&&o.value!==current?.category});
    if(current)category.value=current.category;
    else if(!allowed.includes(category.value))category.value='CCTV';
  };
  // Preserve legacy category values in existing records; new records are restricted to the updated set.
  const baseAssetSubmit=$('assetForm').onsubmit;
  $('assetForm').addEventListener('submit',e=>{
    const current=state.assets.find(a=>a.id===editId);
    if(!current&&!allowed.includes(category.value)){e.preventDefault();e.stopImmediatePropagation();toast('Kategori aset baru hanya CCTV, Jaringan, atau Kabinet.')}
  },true);
})();
