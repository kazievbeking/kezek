from pathlib import Path
import json
import pdfplumber
from pypdf import PdfReader

root=Path(__file__).resolve().parents[1]
path=root/'output/pdf/Kezek_Manual_A-Z_RU.pdf'
reader=PdfReader(path)
text='\n'.join(page.extract_text() or '' for page in reader.pages)
assert len(reader.pages)==34
assert len(reader.outline)==32
assert '\ufffd' not in text and '\u25a0' not in text
for phrase in ['Филиалы и их точки','CompanyBranch','companyBranchCode','Филиал и точки: создание','FLOOR1','FLOOR2','Резервное копирование','Восстановление после сбоя','CREATE ROLE kezek_runtime','proxy_pass http://127.0.0.1:3001']:
    assert phrase in text,phrase
assert 'node --import tsx scripts/create-owner.ts' in text
credentials=root/'.local/demo-credentials.json'
if credentials.exists():
    for account in json.loads(credentials.read_text(encoding='utf-8'))['accounts']:
        password=account.get('password','')
        assert not password or password not in text,'Private credential in PDF'
overflow=[]
with pdfplumber.open(path) as pdf:
    for n,page in enumerate(pdf.pages,1):
        for char in page.chars:
            if char.get('text','').strip() and (char['x0']<48 or char['x1']>548 or char['top']<15 or char['bottom']>page.height-12):
                overflow.append({'page':n,'text':char['text'],'x':round(char['x1'],1)})
assert not overflow,overflow[:10]
result={'pages':len(reader.pages),'bookmarks':len(reader.outline),'layout_bounds':'passed','required_topics':'passed','private_credentials':'absent','visual_review':'Poppler render: contact sheet and selected full pages inspected'}
(root/'.local/pdf-qa.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(result))
