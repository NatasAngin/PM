(function(g){
const legacyHeaders=['Kode Asset','Nama Peralatan','Kategori (CCTV, Jaringan, Kabinet (Rak Server))','Lokasi'];
const legacyKeys=['code','name','category','location'];
const sourceHeaders=['kode_aset','nama_peralatan','kategori','lokasi','penanggung_jawab','kondisi','jadwal_berikutnya','interval_bulan','checklist'];
const sourceKeys=['code','name','category','location','pic','condition','due','interval','checklist'];
const defaults={
'CCTV':['Bersihkan lensa kamera','Periksa posisi, fokus, dan kualitas gambar','Verifikasi koneksi jaringan, rekaman, dan waktu sistem'],
'Box Panel':['Periksa kondisi fisik box panel dan pengunci','Periksa kebersihan bagian dalam dan luar panel','Periksa kerapian kabel, label, dan grounding'],
'Kabinet (Rak Server)':['Periksa kebersihan dan kondisi fisik kabinet','Periksa kerapian kabel dan jalur sirkulasi udara','Periksa pintu, engsel, kunci, dan grounding kabinet'],
'Jaringan':['Periksa port, kabel, dan indikator perangkat','Tinjau log serta utilisasi perangkat','Cadangkan konfigurasi perangkat']
};
const normalizeKey=value=>String(value??'').normalize('NFKC').toLocaleLowerCase('id').replace(/[^a-z0-9]/g,'');
function normalizeCategory(value,name=''){
 const key=normalizeKey(value),asset=normalizeKey(name);
 const aliases={
  cctv:'CCTV',ipcam:'CCTV',camera:'CCTV',kamera:'CCTV',securitycamera:'CCTV',networkcamera:'CCTV',
  boxpanel:'Box Panel',panelbox:'Box Panel',panelboxhikvision:'Box Panel',boxpanelhikvision:'Box Panel',panel:'Box Panel',
  cabinet:'Kabinet (Rak Server)',cabinetrack:'Kabinet (Rak Server)',cabinetrack:'Kabinet (Rak Server)',rack:'Kabinet (Rak Server)',servercabinet:'Kabinet (Rak Server)',rackserver:'Kabinet (Rak Server)',
  jaringan:'Jaringan',network:'Jaringan',switch:'Jaringan',router:'Jaringan'
 };
 if(aliases[key])return aliases[key];
 if(asset.includes('panelbox')||asset.includes('boxpanel'))return 'Box Panel';
 if(asset.includes('cctv')||asset.includes('camera')||asset.includes('hikvision')&&/ds2|ds/.test(asset))return 'CCTV';
 if(asset.includes('cabinet')||asset.includes('rack'))return 'Kabinet (Rak Server)';
 if(asset.includes('switch')||asset.includes('router')||asset.includes('firewall'))return 'Jaringan';
 const canonical=PM.categories.find(v=>normalizeKey(v)===key);
 return canonical||null;
}unction(g){
const legacyHeaders=['Kode Asset','Nama Peralatan','Kategori (CCTV, Jaringan, Kabinet (Rak Server))','Lokasi'];
const legacyKeys=['code','name','category','location'];
const sourceHeaders=['kode_aset','nama_peralatan','kategori','lokasi','penanggung_jawab','kondisi','jadwal_berikutnya','interval_bulan','checklist'];
const sourceKeys=['code','name','category','location','pic','condition','due','interval','checklist'];
const defaults={
'CCTV':['Bersihkan lensa dan periksa posisi kamera','Periksa kualitas rekaman','Verifikasi penyimpanan dan waktu sistem'],
'IP CAM':['Bersihkan lensa kamera','Periksa posisi, fokus, dan kualitas gambar','Verifikasi koneksi jaringan dan rekaman'],
'Jaringan':['Periksa port, kabel, dan indikator perangkat','Tinjau log serta utilisasi perangkat','Cadangkan konfigurasi perangkat'],
'Kabinet (Rak Server)':['Periksa kebersihan dan kondisi fisik kabinet','Periksa kerapian kabel dan jalur sirkulasi udara','Periksa pintu, engsel, kunci, dan grounding kabinet'],
'CABINET':['Periksa kebersihan dan kondisi fisik kabinet','Periksa kerapian kabel dan jalur sirkulasi udara','Periksa pintu, engsel, kunci, dan grounding kabinet'],
'Cabinet':['Periksa kebersihan dan kondisi fisik kabinet','Periksa kerapian kabel dan jalur sirkulasi udara','Periksa pintu, engsel, kunci, dan grounding kabinet'],
'Box Panel':['Periksa kondisi fisik box panel dan kunci','Periksa kebersihan bagian dalam dan luar panel','Periksa kerapian kabel serta label identifikasi']
};
function parse(text){
 text=text.replace(/^\uFEFF/,'');
 if(text.length>5000000)throw Error('Ukuran CSV maksimum 5 MB.');
 let rows=[],row=[],field='',quoted=false,closed=false;
 const first=text.split(/\r?\n/)[0],delimiter=first.includes(';')&&!first.includes(',')?';':',';
 for(let i=0;i<text.length;i++){const c=text[i];if(quoted){if(c==='"'){if(text[i+1]==='"'){field+='"';i++}else{quoted=false;closed=true}}else field+=c;continue}
 if(c==='"'){if(field.length||closed)throw Error('Tanda kutip CSV tidak valid.');quoted=true}
 else if(c===delimiter){row.push(field);field='';closed=false}
 else if(c==='\n'||c==='\r'){if(c==='\r'&&text[i+1]==='\n')i++;row.push(field);if(row.some(x=>x.trim()))rows.push(row);row=[];field='';closed=false}
 else{if(closed)throw Error('Karakter setelah tanda kutip tidak valid.');field+=c}}
 if(quoted)throw Error('Tanda kutip CSV belum ditutup.');row.push(field);if(row.some(x=>x.trim()))rows.push(row);
 if(rows.length>1001)throw Error('Maksimal 1.000 peralatan per unggahan.');return rows
}
function prepare(text,assets,mode='add'){
 const rows=parse(text);if(rows.length<2)throw Error('CSV harus memiliki header dan minimal satu baris data.');
 const header=rows.shift().map(x=>x.trim().toLowerCase());
 const sourceMode=sourceHeaders.every(h=>header.includes(h));
 const required=sourceMode?['kode_aset','nama_peralatan','kategori','lokasi']:legacyHeaders.map(x=>x.toLowerCase());
 const keys=sourceMode?sourceKeys:legacyKeys;
 const positions=sourceMode?sourceHeaders.map(h=>header.indexOf(h)):legacyHeaders.map(h=>header.indexOf(h.toLowerCase()));
 if(positions.some(i=>i<0)||new Set(header).size!==header.length)throw Error('Header tidak dikenali. Gunakan file BAI-Template-Upload-Maintenance.csv atau template 4 kolom dari aplikasi.');
 if(!sourceMode&&(header.length!==4||required.some(h=>!header.includes(h))))throw Error('Template lama harus memiliki tepat 4 kolom: Kode Asset, Nama Peralatan, Kategori, dan Lokasi.');
 if(sourceMode&&header.length!==9)throw Error('Template BAI harus memiliki tepat 9 kolom sesuai file sumber.');
 const seen=new Map(),errors=[],items=[];
 rows.forEach((row,index)=>{const line=index+2;try{
 if(row.length!==header.length)throw Error('Jumlah kolom tidak sesuai header.');
 const raw=Object.fromEntries(keys.map((k,i)=>[k,(row[positions[i]]??'').trim()]));
 const a={code:raw.code,name:raw.name,category:normalizeCategory(raw.category,raw.name),location:raw.location};
 if(!a.code)throw Error('kode_aset wajib diisi.');if(!a.name)throw Error('nama_peralatan wajib diisi.');
 if(!PM.categories.includes(a.category))throw Error('Kategori "'+a.category+'" belum dikenali aplikasi.');
 if(!a.location)throw Error('lokasi wajib diisi.');
 const existing=assets.find(x=>x.code.toLowerCase()===a.code.toLowerCase());
 if(seen.has(a.code.toLowerCase()))throw Error('Kode aset '+a.code+' duplikat dengan baris '+seen.get(a.code.toLowerCase())+'. Perbaiki salah satu kode aset sebelum impor.');seen.set(a.code.toLowerCase(),line);
 if(existing&&mode==='add')throw Error('Kode aset sudah terdaftar. Pilih mode perbarui untuk menggantinya.');
 const pic=raw.pic||existing?.pic||'Belum ditentukan';
 const condition=raw.condition||existing?.condition||'Baik';
 const due=raw.due||existing?.due||PM.iso();
 const interval=raw.interval?Number(raw.interval):(existing?.interval||3);
 if(!PM.conditions.includes(condition))throw Error('kondisi harus Baik, Perlu perhatian, atau Gangguan.');
 if(!PM.validDate(due))throw Error('jadwal_berikutnya harus berupa tanggal YYYY-MM-DD.');
 if(![1,3,6,12].includes(interval))throw Error('interval_bulan hanya boleh 1, 3, 6, atau 12.');
 const checklistText=raw.checklist||'';
 const checklist=checklistText?checklistText.split(/[;\n|]/).map(x=>x.trim()).filter(Boolean):(existing?.checklist?.length?existing.checklist:(defaults[a.category]||['Periksa kondisi fisik peralatan','Periksa fungsi dan konektivitas','Catat hasil pemeriksaan serta tindak lanjut']));
 Object.assign(a,{pic,condition,due,interval,checklist,id:existing?.id||'csv-preview-'+index});
 PM.validate({version:1,assets:[a],history:[]});items.push({asset:a,update:!!existing,line})
 }catch(e){errors.push('Baris '+line+': '+e.message)}});
 return {items,errors}
}
function serialize(rows){return '\uFEFF'+rows.map(row=>row.map(v=>'"'+String(v??'').replaceAll('"','""')+'"').join(',')).join('\r\n')+'\r\n'}
const sample=[sourceHeaders,['2G01-3301-CVVB-0001','DS-2CD3T41G2-IUF','IP CAM','2G01-3301 Desulfurization Building','','','','',''],['PANEL-001','Box Panel Utama','Box Panel','Ruang Panel','','','','',''],['CAB-001','Cabinet Rack Server','CABINET','Data Center','','','','','']];
g.PMCSV={headers:sourceHeaders,keys:sourceKeys,parse,prepare,serialize,sample,template:()=>serialize(sample)};
})(globalThis);
