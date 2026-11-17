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
  cabinet:'Kabinet (Rak Server)',cabinetrack:'Kabinet (Rak Server)',rack:'Kabinet (Rak Server)',servercabinet:'Kabinet (Rak Server)',rackserver:'Kabinet (Rak Server)',
  jaringan:'Jaringan',network:'Jaringan',switch:'Jaringan',router:'Jaringan'
 };
 if(aliases[key])return aliases[key];
 if(asset.includes('panelbox')||asset.includes('boxpanel'))return 'Box Panel';
 if(asset.includes('cctv')||asset.includes('camera')||(asset.includes('hikvision')&&(asset.startsWith('ds')||asset.includes('ds2'))))return 'CCTV';
 if(asset.includes('cabinet')||asset.includes('rack'))return 'Kabinet (Rak Server)';
 if(asset.includes('switch')||asset.includes('router')||asset.includes('firewall'))return 'Jaringan';
 return PM.categories.find(v=>normalizeKey(v)===key)||null;
}
function parse(text){
 text=String(text).replace(/^\uFEFF/,'');
 if(text.length>5000000)throw Error('Ukuran CSV maksimum 5 MB.');
 const rows=[];let row=[],field='',quoted=false,closed=false;
 const first=text.split(/\r?\n/)[0],delimiter=first.includes(';')&&!first.includes(',')?';':',';
 for(let i=0;i<text.length;i++){
  const c=text[i];
  if(quoted){if(c==='"'){if(text[i+1]==='"'){field+='"';i++}else{quoted=false;closed=true}}else field+=c;continue}
  if(c==='"'){if(field.length||closed)throw Error('Tanda kutip CSV tidak valid.');quoted=true}
  else if(c===delimiter){row.push(field);field='';closed=false}
  else if(c==='\n'||c==='\r'){if(c==='\r'&&text[i+1]==='\n')i++;row.push(field);if(row.some(v=>v.trim()))rows.push(row);row=[];field='';closed=false}
  else{if(closed)throw Error('Karakter setelah tanda kutip tidak valid.');field+=c}
 }
 if(quoted)throw Error('Tanda kutip CSV belum ditutup.');
 row.push(field);if(row.some(v=>v.trim()))rows.push(row);
 if(rows.length>1001)throw Error('Maksimal 1.000 peralatan per unggahan.');
 return rows;
}
function prepare(text,assets,mode='add'){
 const rows=parse(text);
 if(rows.length<2)throw Error('CSV harus memiliki header dan minimal satu baris data.');
 const header=rows.shift().map(v=>v.trim().toLocaleLowerCase('id'));
 const sourceMode=sourceHeaders.every(v=>header.includes(v));
 const keys=sourceMode?sourceKeys:legacyKeys;
 const expected=sourceMode?sourceHeaders:legacyHeaders.map(v=>v.toLocaleLowerCase('id'));
 const positions=expected.map(v=>header.indexOf(v));
 if(positions.some(v=>v<0)||new Set(header).size!==header.length)throw Error('Header tidak dikenali. Gunakan template BAI 9 kolom atau template 4 kolom dari aplikasi.');
 if((sourceMode&&header.length!==9)||(!sourceMode&&header.length!==4))throw Error('Jumlah kolom tidak sesuai template.');
 const seen=new Map(),errors=[],items=[];
 rows.forEach((row,index)=>{
  const line=index+2;
  try{
   if(row.length!==header.length)throw Error('Jumlah kolom tidak sesuai header.');
   const raw=Object.fromEntries(keys.map((key,i)=>[key,(row[positions[i]]??'').trim()]));
   if(!raw.code)throw Error('kode_aset wajib diisi.');
   if(!raw.name)throw Error('nama_peralatan wajib diisi.');
   if(!raw.location)throw Error('lokasi wajib diisi.');
   const category=normalizeCategory(raw.category,raw.name);
   if(!category)throw Error('Kategori "'+raw.category+'" belum dapat dipetakan. Periksa kategori atau nama peralatan.');
   const existing=assets.find(v=>v.code.toLowerCase()===raw.code.toLowerCase()&&v.location.trim().toLocaleLowerCase('id')===raw.location.trim().toLocaleLowerCase('id'));
   const codeKey=raw.code.toLocaleLowerCase('id')+'|'+raw.location.trim().toLocaleLowerCase('id');
   if(seen.has(codeKey))throw Error('Kombinasi kode aset dan lokasi duplikat dengan baris '+seen.get(codeKey)+'.');
   seen.set(codeKey,line);
   if(existing&&mode==='add')throw Error('Kode aset sudah terdaftar. Pilih mode perbarui untuk menggantinya.');
   const pic=raw.pic||existing?.pic||'Belum ditentukan';
   const condition=raw.condition||existing?.condition||'Baik';
   const due=raw.due||existing?.due||PM.iso();
   const interval=raw.interval?Number(raw.interval):(existing?.interval||3);
   if(!PM.conditions.includes(condition))throw Error('kondisi harus Baik, Perlu perhatian, atau Gangguan.');
   if(!PM.validDate(due))throw Error('jadwal_berikutnya harus berupa tanggal YYYY-MM-DD.');
   if(![1,3,6,12].includes(interval))throw Error('interval_bulan hanya boleh 1, 3, 6, atau 12.');
   const checklistText=raw.checklist||'';
   const checklist=checklistText?checklistText.split(/[;\n|]/).map(v=>v.trim()).filter(Boolean):(existing?.checklist?.length?existing.checklist:(defaults[category]||['Periksa kondisi fisik peralatan','Periksa fungsi dan konektivitas','Catat hasil pemeriksaan serta tindak lanjut']));
   const asset={id:existing?.id||'csv-preview-'+index,code:raw.code,name:raw.name,category,location:raw.location,pic,condition,due,interval,checklist};
   PM.validate({version:1,assets:[asset],history:[]});
   items.push({asset,update:!!existing,line});
  }catch(e){errors.push('Baris '+line+': '+e.message)}
 });
 return {items,errors};
}
function serialize(rows){return '\uFEFF'+rows.map(row=>row.map(v=>'"'+String(v??'').replaceAll('"','""')+'"').join(',')).join('\r\n')+'\r\n'}
const sample=[sourceHeaders,['2G01-3301-CVVB-0001','DS-2CD3T41G2-IUF','CCTV','2G01-3301 Desulfurization Building','','','','',''],['PANEL-001','Panel Box Hikvision','Box Panel','Ruang Panel','','','','',''],['CAB-001','Cabinet Rack Toten','Kabinet (Rak Server)','Data Center','','','','','']];
g.PMCSV={headers:sourceHeaders,keys:sourceKeys,parse,prepare,serialize,sample,normalizeCategory,template:()=>serialize(sample)};
})(globalThis);
