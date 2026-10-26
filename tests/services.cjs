const {chromium}=require('playwright'),fs=require('fs'),assert=require('assert/strict'),{randomUUID,randomInt}=require('crypto');
const base='http://127.0.0.1:3001',id=randomUUID().slice(0,6),prefix='T'+Array.from({length:2},()=>String.fromCharCode(65+randomInt(0,26))).join('');
const names=['Документы '+id,'Паспорт '+id,'Замена '+id];
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});const created=[];let page,headers;try{
 const context=await browser.newContext({viewport:{width:1440,height:1000}});await context.addInitScript(()=>localStorage.setItem('kezek.locale','ru'));page=await context.newPage();
 const account=JSON.parse(fs.readFileSync('.local/demo-credentials.json','utf8')).accounts.find(a=>a.login==='admin1');
 await page.goto(base+'/admin#services');await page.getByLabel('Логин',{exact:true}).fill(account.login);await page.getByLabel('Пароль',{exact:true}).fill(account.password);await page.getByRole('button',{name:'Войти',exact:true}).click();await page.locator('.panel-title').waitFor();
 const me=await(await page.request.get(base+'/api/me')).json();headers={'X-CSRF-Token':me.csrf,'X-Branch-Id':me.branchId};
 for(let depth=0;depth<3;depth++){
  if(depth===0)await page.locator('.panel-title .button').click();else await page.getByRole('row').filter({hasText:names[depth-1]}).getByRole('button',{name:'Добавить подуслугу',exact:true}).click();
  await page.locator('.editor').getByLabel('RU',{exact:true}).fill(names[depth]);await page.locator('.editor').getByLabel('KK',{exact:true}).fill(names[depth]);await page.locator('.editor').getByLabel('EN',{exact:true}).fill(names[depth]);
  const inputs=page.locator('.editor input:not([type="checkbox"])');await inputs.nth(3).fill(prefix+(depth===1?'C':depth===2?'L':''));
  assert.equal(await page.locator('.editor select').inputValue(),depth?created[depth-1].id:'');await page.locator('.editor button[type="submit"]').click();await page.locator('.editor').waitFor({state:'hidden'});await page.locator('.service-tree-name').filter({hasText:names[depth]}).waitFor();
  const state=await(await page.request.get(base+'/api/state',{headers})).json();const service=state.services.find(s=>s.name.ru===names[depth]);assert(service);created.push(service);
 }
 await page.getByRole('row').filter({has:page.getByText(names[0],{exact:true})}).getByRole('button',{name:'Изменить',exact:true}).click();for(const service of created)assert.equal(await page.locator('.editor select option[value="'+service.id+'"]').count(),0);await page.getByRole('button',{name:'Отмена',exact:true}).click();
 fs.mkdirSync('artifacts/ui',{recursive:true});await page.screenshot({path:'artifacts/ui/service-tree-admin.png',fullPage:true});
 const terminalContext=await browser.newContext({viewport:{width:1440,height:1000}});await terminalContext.addInitScript(()=>{localStorage.setItem('kezek.locale','ru');window.print=()=>{};});const terminal=await terminalContext.newPage();let issues=0;terminal.on('request',r=>{if(r.url().endsWith('/api/commands')&&r.postData()?.includes('"issue"'))issues++;});
 await terminal.goto(base+'/terminal');await terminal.getByLabel('Токен компании',{exact:true}).fill('1234-5678');await terminal.getByLabel('Название',{exact:true}).fill('Nested services browser test');await terminal.getByRole('button',{name:'Подключить устройство',exact:true}).click();await terminal.getByLabel('Точка обслуживания',{exact:true}).selectOption(me.branchId);await terminal.getByRole('button',{name:'Подключить устройство',exact:true}).click();
 await terminal.locator('.service-button').filter({hasText:names[0]}).click();assert.equal(issues,0);assert.equal(await terminal.locator('.service-button').filter({hasText:names[2]}).count(),0);
 await terminal.locator('.service-button').filter({hasText:names[1]}).click();assert.equal(issues,0);await terminal.screenshot({path:'artifacts/ui/service-tree-terminal.png',fullPage:true});
 await terminal.locator('.service-back button').click();await terminal.locator('.service-button').filter({hasText:names[1]}).click();await terminal.locator('.service-button').filter({hasText:names[2]}).click();await terminal.getByText('Талон отправлен в браузерную печать',{exact:true}).waitFor();const number=await terminal.locator('.ticket-result h1').innerText();assert.equal(issues,1);assert((await terminal.locator('.ticket-result').innerText()).includes(names.join(' / ')));await terminal.getByRole('button',{name:'Повторная печать',exact:true}).click();await terminal.getByText('Талон отправлен в браузерную печать',{exact:true}).waitFor();assert.equal(await terminal.locator('.ticket-result h1').innerText(),number);assert.equal(issues,1);
 console.log('PASS: three-level service creation in admin, cycle options excluded, terminal navigation/back, one leaf ticket and reprint without duplicates.');
 }finally{
  if(page&&headers)for(const service of created)await page.request.post(base+'/api/admin/services',{headers,data:{...service,active:false}}).catch(()=>{});
  await browser.close();
 }
})().catch(e=>{console.error(e.message);process.exitCode=1});
