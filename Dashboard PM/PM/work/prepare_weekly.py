import json,datetime,pathlib
raw=json.load(open('work/weekly-template.json',encoding='utf-8'))
maps={s['sheet']:{c[0]:c[1] for row in s['rows'] for c in row} for s in raw}
m=maps['Master'];p=maps['Pustaka Tahapan'];l=maps['Laporan Mingguan'];r=maps['Rincian']
def date(v):return (datetime.date(1899,12,30)+datetime.timedelta(days=float(v))).isoformat() if v else ''
staff=[dict(zip(['name','role','section','sectionCode','supervisor'],[m.get(c+str(i),'') for c in 'ABCDE'])) for i in range(5,36) if m.get('A'+str(i))]
patterns=[]
for start,end in [(6,10),(19,22),(27,31),(37,41),(46,49),(54,57),(62,68),(73,77)]:
 title=next(p['A'+str(i)] for i in range(start-2,start) if 'A'+str(i) in p and '.' in str(p['A'+str(i)]))
 patterns.append({'name':title,'stages':[{'description':p['B'+str(i)],'weight':float(p['C'+str(i)])*100,'requirement':p['D'+str(i)]} for i in range(start,end+1)]})
routineLibrary=[{'sectionCode':m['A'+str(i)],'name':m['B'+str(i)],'category':m['C'+str(i)],'unit':m['D'+str(i)],'frequency':m['E'+str(i)],'target':m['F'+str(i)],'definition':m['G'+str(i)]} for i in range(41,61)]
sample={'id':'template-example-w42-rizwan','staff':l['B3'],'monday':date(l['I3']),'example':True,'source':'Contoh dari template v2-ICT','routine':[{'id':'A1','name':l['B12'],'category':l['C12'],'unit':l['D12'],'frequency':l['E12'],'target':float(l['F12']),'actual':float(l['G12']),'notes':l['J12'],'evidence':l['K12']}],'adhoc':[{'id':'B1','name':l['B31'],'category':l['C31'],'assigner':l['D31'],'pic':l['E31'],'target':date(l['F31']),'previous':l['G31'],'notes':l['J31'],'pattern':2,'stages':[{'description':r.get('D'+str(i),''),'weight':float(r['E'+str(i)])*100,'planned':date(r.get('F'+str(i))),'actual':date(r.get('G'+str(i))),'evidenceType':r.get('H'+str(i),''),'evidence':r.get('I'+str(i),''),'notes':r.get('K'+str(i),'')} for i in range(6,11)]}],'notes':{'obstacles':l.get('C49','') or '','next':l.get('C50','') or '','removed':l.get('C51','') or ''}}
data={'staff':staff,'patterns':patterns,'routineLibrary':routineLibrary,'categories':[m['H'+str(i)] for i in range(5,15)],'units':[m['I'+str(i)] for i in range(5,15)],'frequencies':[m['J'+str(i)] for i in range(5,9)],'evidenceTypes':[m['K'+str(i)] for i in range(5,12)],'sample':sample,'guidance':[maps['Panduan'].get('B'+str(i),'') for i in range(3,11)]}
out=pathlib.Path('work/bai-weekly');out.mkdir(exist_ok=True)
(out/'template-data.js').write_text('const TEMPLATE='+json.dumps(data,ensure_ascii=False)+';',encoding='utf-8')
print('Prepared:',len(staff),'staff,',len(patterns),'patterns,',len(routineLibrary),'standard routine tasks. Sample period:',sample['monday'])
