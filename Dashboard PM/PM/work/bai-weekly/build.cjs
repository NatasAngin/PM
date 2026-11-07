const fs=require('node:fs'),path=require('node:path');
let html=fs.readFileSync(path.join(__dirname,'index.html'),'utf8');
const css=['style.css','extra.css'].map(n=>fs.readFileSync(path.join(__dirname,n),'utf8')).join('\n');
html=html.replace('<link rel="stylesheet" href="style.css">',()=>'<style>'+css+'</style>');
for(const n of ['template-data','core','xlsx-import','app']){const js=fs.readFileSync(path.join(__dirname,n+'.js'),'utf8').replace(/<\/script/gi,'<\\/script');html=html.replace('<script src="'+n+'.js"></script>',()=>'<script>'+js+'</script>')}
if(/<script src=|<link rel="stylesheet"/.test(html))throw Error('Unbundled dependencies');
const out=path.resolve(__dirname,'../../outputs/BAI-Weekly-Team-IT-Lokal.html');fs.writeFileSync(out,html,'utf8');console.log('Created '+path.basename(out)+' ('+Buffer.byteLength(html)+' bytes).');
