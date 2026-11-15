const {test,expect}=require('@playwright/test');
const AxeBuilder=require('@axe-core/playwright').default;
const fs=require('node:fs');
const {mockSupabaseUMD}=require('./mock-supabase.cjs');
const base='http://127.0.0.1:8765/';
const sdk='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.95.3/dist/umd/supabase.js';
const mock=async(page,body=mockSupabaseUMD)=>page.route(sdk,r=>r.fulfill({status:200,contentType:'application/javascript',body}));
for(const name of ['index','about','privacy','assessment','dashboard','brief','requests','review','community']){
 test(name+': accessible public shell, modal, navigation and responsive layout',async({page,request})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+name+'.html');
  for(const width of [320,390,768,1440]){await page.setViewportSize({width,height:900});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);}
  const links=await page.locator('a[href]').evaluateAll(links=>[...new Set(links.map(a=>a.getAttribute('href')).filter(h=>h?.startsWith('./')&&!h.startsWith('./#')))]);
  for(const href of links){const response=await request.get(new URL(href,base).href);expect(response.status(),href).toBeLessThan(400);}
  expect((await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa','best-practice']).analyze()).violations).toEqual([]);
  if(name==='community'){await page.locator('#account').click();await expect(page.locator('#auth')).toBeVisible();}
  else{if(name==='assessment')await page.evaluate(()=>window.FD.signIn());else await page.locator('[data-auth]').first().click();await expect(page.locator('#site-auth')).toBeVisible();}
  expect((await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa','best-practice']).analyze()).violations).toEqual([]);
  expect(errors).toEqual([]);
 });
}
test('anonymous homepage loads authentication only when requested',async({page})=>{
 let loads=0;await page.route(sdk,r=>{loads++;return r.fulfill({status:200,contentType:'application/javascript',body:mockSupabaseUMD});});
 await page.goto(base);expect(loads).toBe(0);
 await page.locator('[data-auth]').click();await expect.poll(()=>loads).toBe(1);
});
test('report and its download update after task and reflection changes',async({page})=>{
 await mock(page);await page.goto(base+'dashboard.html');
 await expect(page.locator('#report-download')).toBeEnabled();
 await page.locator('#task-title').fill('Speak to buyers');await page.getByRole('button',{name:'Add task',exact:true}).click();
 await expect(page.locator('#report-summary')).toContainText('0 of 1 retrieved tasks complete');
 await page.locator('#task-list input').check();
 await expect(page.locator('#report-summary')).toContainText('1 of 1 retrieved tasks complete');
 await page.locator('#checkin-win').fill('Spoke to five buyers');
 await page.getByRole('button',{name:"Save this week's reflection"}).click();
 await expect(page.locator('#report-notes')).toContainText('Spoke to five buyers');
 const [download]=await Promise.all([page.waitForEvent('download'),page.locator('#report-download').click()]);
 expect(fs.readFileSync(await download.path(),'utf8')).toContain('Spoke to five buyers');
 page.on('dialog',d=>d.accept());await page.getByRole('button',{name:'Delete task Speak to buyers',exact:true}).click();
 await expect(page.locator('#report-summary')).toContainText('No saved action tasks yet.');
 await page.getByRole('button',{name:'Delete reflection'}).click();
 await expect(page.locator('#report-summary')).toContainText('No weekly check-ins saved yet.');
});
test('task network failures preserve input and allow retry',async({page})=>{
 await mock(page,mockSupabaseUMD.replace('insert(row){','insert(row){if(!window.qaFailed){window.qaFailed=true;throw Error("Network interrupted")};'));
 await page.goto(base+'dashboard.html');await page.locator('#task-title').fill('Retry this task');
 const add=page.getByRole('button',{name:'Add task',exact:true});await add.click();
 await expect(page.locator('#task-message')).toContainText('Network interrupted');await expect(add).toBeEnabled();
 await expect(page.locator('#task-title')).toHaveValue('Retry this task');await add.click();
 await expect(page.locator('#task-list')).toContainText('Retry this task');
});
test('cross-tab sign-out clears the private dashboard',async({page})=>{
 await mock(page);await page.goto(base+'dashboard.html');await expect(page.locator('#dashboard-content')).toBeVisible();
 await page.evaluate(()=>window.qaAuthChange());await expect(page.locator('#dashboard-content')).toBeHidden();
 await expect(page.locator('#dashboard-status')).toContainText('Sign in');
});
test('sign-in remains available when browser storage is unavailable',async({page})=>{
 const anonymous=`window.supabase={createClient:()=>({auth:{getSession:async()=>({data:{session:null}}),signInWithOtp:async args=>{window.qaOtp=args;return {error:null}}}})}`;
 await mock(page,anonymous);await page.addInitScript(()=>{Storage.prototype.setItem=()=>{throw Error('Storage disabled')};});
 await page.goto(base+'index.html');await page.locator('[data-auth]').click();
 await page.locator('#site-name').fill('Test founder');await page.locator('#site-email').fill('test@example.invalid');
 await page.getByRole('button',{name:'Email me a sign-in link'}).click();
 await expect(page.locator('#site-auth-status')).toContainText('Check your inbox');
 const callback=await page.evaluate(()=>window.qaOtp.options.emailRedirectTo);
 expect(callback).toBe(base+'community.html');
});
test('brief ignores inactive portfolio fields and clears drafts after receipt',async({page})=>{
 const body=mockSupabaseUMD.replace('rpc:async()=>({data:false,error:null})',"rpc:async name=>({data:name==='submit_business_brief'?[{request_id:'request-qa',request_reference:'FD-QA'}]:false,error:null})");
 await mock(page,body);await page.goto(base+'brief.html?action=support');
 await page.locator('#business').fill('Example business');await page.locator('#stage').selectOption({index:1});
 await page.locator('#portfolio_link').evaluate(e=>e.value='bad legacy URL');await page.locator('#brief-next').click();
 await page.locator('#situation').fill('Need customer evidence');await page.locator('#outcome').fill('Validate demand');
 await page.locator('#brief-next').click();await page.locator('#brief-next').click();
 await page.locator('#review_consent').check();await page.locator('#contact_name').fill('Example founder');
 await page.locator('#brief-submit').click();await expect(page.locator('#brief-receipt')).toBeVisible();
 await page.reload();expect(await page.evaluate(()=>localStorage.getItem('fd-private-brief-v1'))).toBeNull();
});
test('assessment result heading receives focus and saving cannot create duplicates',async({page})=>{
 await mock(page);await page.goto(base+'assessment.html');
 for(let i=0;i<12;i++){await page.getByRole('button',{name:/03\s+Somewhat/}).click();await page.getByRole('button',{name:i===11?'View my results':'Next question',exact:true}).click();}
 await expect(page.getByRole('heading',{name:'Build with more clarity.'})).toBeFocused();
 await page.getByRole('button',{name:'Save to my account',exact:true}).click();await expect(page.getByRole('button',{name:'Saved to your account',exact:true})).toBeDisabled();
 expect((await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()).violations).toEqual([]);
});
for(const [action,fields] of [
 ['support',{}],['collaborator',{collaborator_role:'Customer research partner'}],
 ['expert',{expert_question:'How should I validate this offer?'}],
 ['milestone',{milestone_title:'First customer interview',milestone_story:'Learned about a concrete problem.'}],
 ['expertise',{skills:'Customer research',availability:'Two hours a week'}]
]){
 test('guided '+action+' brief validates each step and can be downloaded',async({page})=>{
  await mock(page);await page.goto(base+'brief.html?action='+action);
  await page.locator('#brief-next').click();await expect(page.locator('#business')).toBeFocused();
  await page.locator('#business').fill('Audit business');await page.locator('#stage').selectOption({index:1});await page.locator('#brief-next').click();
  await page.locator('#brief-next').click();await expect(page.locator('#situation')).toBeFocused();
  await page.locator('#situation').fill('Need a clearer next step');await page.locator('#outcome').fill('Talk to three potential buyers');await page.locator('#brief-next').click();
  for(const [id,value] of Object.entries(fields))await page.locator('#'+id).fill(value);
  expect((await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()).violations).toEqual([]);
  await page.locator('#brief-next').click();await expect(page.locator('#brief-summary')).toContainText('Audit business');
  const [file]=await Promise.all([page.waitForEvent('download'),page.locator('#download-business-brief').click()]);
  expect(fs.readFileSync(await file.path(),'utf8')).toContain('Audit business');
 });
}
test('community preview clears publication consent between separate milestones',async({page})=>{
 await page.route('**/community-config.js',r=>r.fulfill({contentType:'application/javascript',body:'window.FOUNDERDNA_COMMUNITY={};'}));
 await page.goto(base+'community.html');
 await page.locator('#business').fill('Preview business');await page.locator('#headline').fill('A first milestone');await page.locator('#story').fill('A useful learning outcome');
 await page.locator('#milestone-consent').check();await page.locator('#publish').click();
 await expect(page.locator('#posts')).toContainText('A first milestone');await expect(page.locator('#milestone-consent')).not.toBeChecked();
});
test('authenticated dashboard and report meet automated accessibility checks',async({page})=>{
 await mock(page);await page.goto(base+'dashboard.html');await expect(page.locator('#report-download')).toBeEnabled();
 expect((await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa','best-practice']).analyze()).violations).toEqual([]);
});
test('private request conversation and introduction consent update in the UI',async({page})=>{
 const {serviceMock}=require('./mock-service.cjs');await mock(page,serviceMock());await page.goto(base+'requests.html');
 await expect(page.locator('#request-list')).toContainText('FD-TEST');
 await page.locator('#request-list textarea').fill('I spoke to three buyers.');await page.getByRole('button',{name:'Save private update'}).click();
 await expect(page.locator('.timeline')).toContainText('I spoke to three buyers.');
 page.on('dialog',d=>d.accept());await page.getByRole('button',{name:'Approve this introduction',exact:true}).click();
 await expect(page.locator('#request-list')).toContainText('Your decision: Approved');
 expect((await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa','best-practice']).analyze()).violations).toEqual([]);
});
test('review status recovers to the latest confirmed value after a failed change',async({page})=>{
 const {serviceMock}=require('./mock-service.cjs');await mock(page,serviceMock(true));await page.goto(base+'review.html');
 await page.locator('#review-list button').click();const select=page.locator('#review-detail select').first();
 await select.selectOption('In review');await expect(select).toBeEnabled();
 await page.evaluate(()=>window.qaFailStatus=true);await select.selectOption('Closed');await expect(select).toHaveValue('In review');
 await expect(page.locator('#site-toast')).toContainText('Network interrupted');
 expect((await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa','best-practice']).analyze()).violations).toEqual([]);
});
