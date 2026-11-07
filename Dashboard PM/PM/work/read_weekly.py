import zipfile,xml.etree.ElementTree as E,json
p=r'C:\Users\trisnardi.boesyanto\Downloads\Template_Laporan_Mingguan_v2_ICT.xlsx'
ns={'s':'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
with zipfile.ZipFile(p) as z:
 strings=[]
 if 'xl/sharedStrings.xml' in z.namelist():
  strings=[''.join(t.itertext()) for t in E.fromstring(z.read('xl/sharedStrings.xml')).findall('s:si',ns)]
 rels={x.attrib['Id']:x.attrib['Target'] for x in E.fromstring(z.read('xl/_rels/workbook.xml.rels'))}
 result=[]
 for sheet in E.fromstring(z.read('xl/workbook.xml')).findall('s:sheets/s:sheet',ns):
  rid=sheet.attrib['{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id'];target=rels[rid];path=target.lstrip('/') if target.startswith('/') else 'xl/'+target
  root=E.fromstring(z.read(path));rows=[]
  for row in root.findall('s:sheetData/s:row',ns):
   cells=[]
   for c in row:
    v=c.find('s:v',ns);f=c.find('s:f',ns);val=v.text if v is not None else ''
    if c.attrib.get('t')=='s' and val:val=strings[int(val)]
    elif c.attrib.get('t')=='inlineStr':val=''.join(c.find('s:is',ns).itertext())
    if val or f is not None:cells.append([c.attrib['r'],val, f.text if f is not None else None])
   if cells:rows.append(cells)
  result.append({'sheet':sheet.attrib['name'],'rows':rows,'merges':[c.attrib['ref'] for c in root.findall('s:mergeCells/s:mergeCell',ns)],'validations':[E.tostring(c,encoding='unicode') for c in root.findall('s:dataValidations/s:dataValidation',ns)]})
 print(json.dumps(result,ensure_ascii=False,indent=1))
 with open('work/weekly-template.json','w',encoding='utf-8') as out:json.dump(result,out,ensure_ascii=False,indent=2)
