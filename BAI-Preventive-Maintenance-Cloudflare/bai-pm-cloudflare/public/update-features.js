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
  let categoryMigrationRunning=false;
  render=function(){
    if(!categoryMigrationRunning&&globalThis.PMCSV?.normalizeCategory){
      const normalize=globalThis.PMCSV.normalizeCategory;
      const assets=state.assets.map(a=>{const category=normalize(a.category,a.name);return category&&category!==a.category?{...a,category}:a});
      const history=state.history.map(h=>{const category=normalize(h.category,h.name);return category&&category!==h.category?{...h,category}:h});
      const changed=assets.some((a,i)=>a!==state.assets[i])||history.some((h,i)=>h!==state.history[i]);
      if(changed){categoryMigrationRunning=true;try{commit({...state,assets,history})}finally{categoryMigrationRunning=false}return}
    }
    baseRender();
    const filter=$('category');
    const counts={'CCTV':0,'Box Panel':0,'Kabinet (Rak Server)':0,'Jaringan':0};
    state.assets.forEach(a=>{if(Object.prototype.hasOwnProperty.call(counts,a.category))counts[a.category]++});
    [...filter.options].forEach(o=>{
      if(!o.value)o.textContent='Semua kategori ('+state.assets.length+')';
      else if(Object.prototype.hasOwnProperty.call(counts,o.value))o.textContent=o.value+' ('+counts[o.value]+')';
    });
    if(isManager())document.querySelectorAll('[data-complete]').forEach(b=>{b.textContent='Lihat hasil';b.title='Lihat hasil maintenance sebelumnya'});
  };

  // Group inventory by full physical location and provide administrator bulk deletion.
  const selectedAssetIds=new Set();
  function enhanceInventory(){
    if(!isManager()||page!=='Inventaris Aset')return;
    const body=$('rows'),head=$('thead'),tableWrap=$('register').querySelector('.tablewrap');
    if(!body||!head||!tableWrap)return;
    let bar=$('bulkActions');
    if(!bar){
      bar=document.createElement('div');bar.id='bulkActions';bar.className='bulk-actions';
      bar.innerHTML='<span id="bulkSelectedCount">0 dipilih</span><label><input type="checkbox" id="selectAllVisibleAssets"> Pilih semua hasil filter</label><button type="button" id="deleteSelectedAssets" class="danger">Hapus yang dipilih</button>';
      tableWrap.before(bar);
      bar.addEventListener('change',e=>{
        if(e.target.id==='selectAllVisibleAssets'){
          [...body.querySelectorAll('tr[data-asset-row]')].forEach(row=>{const cb=row.querySelector('[data-bulk-select]');if(!cb)return;cb.checked=e.target.checked;e.target.checked?selectedAssetIds.add(row.dataset.assetRow):selectedAssetIds.delete(row.dataset.assetRow)});
          updateBulkCount();
        }
      });
      bar.addEventListener('click',e=>{
        if(e.target.id!=='deleteSelectedAssets')return;
        const ids=[...selectedAssetIds];if(!ids.length)return;
        if(!confirm('Hapus '+ids.length+' peralatan terpilih? Riwayat pekerjaan tetap disimpan.'))return;
        if(commit({...state,assets:state.assets.filter(a=>!selectedAssetIds.has(a.id))})){selectedAssetIds.clear();updateBulkCount();toast(ids.length+' peralatan dihapus. Riwayat pekerjaan tetap tersimpan.')}
      });
    }
    const rows=[...body.querySelectorAll('tr')].filter(row=>!row.classList.contains('category-group-row'));
    const groups=new Map();
    rows.forEach(row=>{
      const id=row.querySelector('[data-edit]')?.dataset.edit||row.querySelector('[data-complete]')?.dataset.complete;
      if(!id)return;
      row.dataset.assetRow=id;
      const small=row.querySelector('td small')?.textContent||'';
      const parts=small.split(' · ');
      const location=(parts.length>1?parts.slice(1).join(' · '):'Lokasi belum ditentukan').trim().replace(/\s+/g,' ');
      const key=location.toLocaleLowerCase('id');
      if(!groups.has(key))groups.set(key,{location,rows:[]});
      groups.get(key).rows.push(row);
      if(!row.querySelector('[data-bulk-select]')){
        const cell=document.createElement('td');cell.className='select-cell';
        const cb=document.createElement('input');cb.type='checkbox';cb.dataset.bulkSelect='';cb.setAttribute('aria-label','Pilih aset '+id);cb.checked=selectedAssetIds.has(id);
        cb.addEventListener('change',()=>{cb.checked?selectedAssetIds.add(id):selectedAssetIds.delete(id);updateBulkCount()});
        cell.append(cb);row.insertBefore(cell,row.firstElementChild);
      }
    });
    if(!groups.size){updateBulkCount();return}
    const header=head.querySelector('tr');
    if(header&&!header.querySelector('.select-head')){const th=document.createElement('th');th.className='select-head';th.textContent='PILIH';header.insertBefore(th,header.firstElementChild)}
    body.replaceChildren();
    [...groups.values()].sort((a,b)=>a.location.localeCompare(b.location,'id')).forEach(group=>{
      const tr=document.createElement('tr');tr.className='location-group-row';
      const td=document.createElement('td');td.colSpan=7;td.innerHTML='<strong></strong><span></span>';td.querySelector('strong').textContent=group.location;td.querySelector('span').textContent=group.rows.length+' peralatan';tr.append(td);body.append(tr);
      group.rows.forEach(row=>body.append(row));
    });
    updateBulkCount();
  }
  function updateBulkCount(){
    const bar=$('bulkActions');if(!bar)return;
    $('bulkSelectedCount').textContent=selectedAssetIds.size+' dipilih';
    const boxes=[...$('rows').querySelectorAll('[data-bulk-select]')];
    const all=$('selectAllVisibleAssets');if(all){all.checked=boxes.length>0&&boxes.every(x=>x.checked);all.indeterminate=boxes.some(x=>x.checked)&&!all.checked}
  }
  const renderGroupedByLocation=render;
  render=function(){renderGroupedByLocation();enhanceInventory()};

  // New records use only the three categories in the supplied update. Legacy categories remain readable/editable.
  const category=$('assetForm').elements.category;
  const allowed=['CCTV','Jaringan','Box Panel','Kabinet (Rak Server)'];
  const originalOpenAsset=openAsset;
  openAsset=function(id){
    originalOpenAsset(id);
    const current=state.assets.find(a=>a.id===id);
    [...category.options].forEach(o=>{o.hidden=!allowed.includes(o.value)&&o.value!==current?.category});
    if(current)category.value=current.category;
    else if(!allowed.includes(category.value))category.value='CCTV';
    const f=$('assetForm');
    for(const name of ['pic','condition','due','interval']){
      const field=f.elements[name];if(!field)continue;
      const label=field.closest('label');if(label)label.hidden=true;
      field.required=false;
      if(!current){
        if(name==='pic')field.value='Belum ditentukan';
        if(name==='condition')field.value='Baik';
        if(name==='due')field.value=now();
        if(name==='interval')field.value='3';
      }
    }
  };
  // Preserve legacy category values in existing records; new records are restricted to the updated set.
  const baseAssetSubmit=$('assetForm').onsubmit;
  $('assetForm').addEventListener('submit',e=>{
    const current=state.assets.find(a=>a.id===editId);
    if(!current&&!allowed.includes(category.value)){e.preventDefault();e.stopImmediatePropagation();toast('Kategori aset baru hanya CCTV, Jaringan, atau Kabinet.')}
  },true);
})();
