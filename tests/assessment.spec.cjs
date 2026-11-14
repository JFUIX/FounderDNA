const { test, expect } = require('@playwright/test');
const url = 'http://127.0.0.1:8765/assessment.html';
test('all-zero answers produce 0%, including valid zero responses', async ({page}) => {
 await page.goto(url);
 for(let i=0;i<12;i++){
  await page.getByRole('button',{name:/01\s+Not yet/}).click();
  await page.getByRole('button',{name:i===11?'View my results':'Next question'}).click();
 }
 await expect(page.locator('.score-large')).toContainText('0%');
 await expect(page.locator('.result-card')).toHaveCount(4);
 await expect(page.locator('.metric-fill')).toHaveCount(4);
});
test('highest answers produce 100%, retake clears answers',async ({page})=>{
 await page.goto(url);
 for(let i=0;i<12;i++){
  await page.getByRole('button',{name:/05\s+Consistently/}).click();
  await page.getByRole('button',{name:i===11?'View my results':'Next question'}).click();
 }
 await expect(page.locator('.score-large')).toContainText('100%');
 await page.getByRole('button',{name:'Retake assessment'}).click();
 await expect(page.getByText('QUESTION 01 / 12')).toBeVisible();
 await expect(page.getByRole('button',{name:'Next question'})).toBeDisabled();
});
test('previous restores selected answer and incomplete questions cannot advance',async ({page})=>{
 await page.goto(url);
 await expect(page.getByRole('button',{name:'Next question'})).toBeDisabled();
 await page.getByRole('button',{name:/03\s+Somewhat/}).click();
 await page.getByRole('button',{name:'Next question'}).click();
 await page.getByRole('button',{name:'Previous'}).click();
 await expect(page.getByRole('button',{name:/03\s+Somewhat/})).toHaveAttribute('aria-pressed','true');
});
for(const width of [320,390,768,1440]){
 test('no horizontal overflow at '+width+'px',async ({page})=>{
  await page.setViewportSize({width,height:900});
  await page.goto(url);
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);
  expect(overflow).toBe(false);
 });
}
test('results download works without sending data to backend',async ({page})=>{
 await page.goto(url);
 for(let i=0;i<12;i++){await page.getByRole('button',{name:/03\s+Somewhat/}).click();await page.getByRole('button',{name:i===11?'View my results':'Next question'}).click();}
 const [download]=await Promise.all([page.waitForEvent('download'),page.getByRole('button',{name:'Download results'}).click()]);
 expect(download.suggestedFilename()).toBe('FounderDNA-reflection-results.txt');
 await expect(page.getByText('Turn insight into action.')).toBeVisible();
});

test('dashboard renders its public shell and remains within mobile viewport',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.goto('http://127.0.0.1:8765/dashboard.html');
 await expect(page.getByRole('heading',{name:/Know your progress/})).toBeVisible();
 await expect(page.locator('#dashboard-status')).toBeVisible();
 await expect(page.locator('#dashboard-content')).toBeHidden();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1)).toBe(false);
});
test('dashboard keeps private content hidden before authentication',async({page})=>{
 await page.goto('http://127.0.0.1:8765/dashboard.html');
 await expect(page.locator('#dashboard-content')).toBeHidden();
 await expect(page.locator('#dashboard-history')).toBeHidden();
});

test('action plan form exists and stays private while signed out',async({page})=>{
 await page.goto('http://127.0.0.1:8765/dashboard.html');
 await expect(page.locator('#task-form')).toHaveCount(1);
 await expect(page.locator('#task-title')).toHaveAttribute('maxlength','180');
 await expect(page.locator('#dashboard-content')).toBeHidden();
});

test('weekly check-in interface is present but hidden before sign-in',async({page})=>{
 await page.goto('http://127.0.0.1:8765/dashboard.html');
 await expect(page.locator('#checkin-form')).toHaveCount(1);
 await expect(page.locator('#checkin-win')).toHaveAttribute('maxlength','1000');
 await expect(page.locator('#checkin-focus')).toHaveAttribute('maxlength','500');
 await expect(page.locator('#dashboard-content')).toBeHidden();
});

test('private progress report controls are present and hidden before sign-in',async({page})=>{
 await page.goto('http://127.0.0.1:8765/dashboard.html');
 await expect(page.locator('#progress-report')).toHaveCount(1);
 await expect(page.locator('#report-download')).toBeDisabled();
 await expect(page.locator('#report-print')).toBeDisabled();
 await expect(page.locator('#dashboard-content')).toBeHidden();
});

const mockSupabaseUMD = "(() => {\nconst state={assessment_results:[{id:'a1',overall_score:75,dimension_scores:{clarity:75,validation:50,execution:100,resilience:75},created_at:'2026-11-10T00:00:00Z'}],founder_action_tasks:[],founder_weekly_checkins:[]};\nconst user={id:'test-user-a',email:'test-a@example.invalid'};\nconst table=name=>({\n select(){return this},order(){return this},limit(){return Promise.resolve({data:state[name]||[],error:null})},\n insert(row){state[name].push({...row,id:'test-'+state[name].length,created_at:new Date().toISOString()});return Promise.resolve({data:null,error:null})},\n upsert(row){const old=state[name].find(x=>x.user_id===row.user_id&&x.week_start===row.week_start);if(old)Object.assign(old,row);else state[name].push({...row,id:'week-'+state[name].length});return Promise.resolve({data:null,error:null})},\n update(row){this.updateRow=row;return this},delete(){this.deleting=true;return this},\n eq(key,value){const row=state[name].find(x=>x[key]===value);if(this.deleting)state[name]=state[name].filter(x=>x[key]!==value);else if(row&&this.updateRow)Object.assign(row,this.updateRow);return Promise.resolve({data:null,error:null})}\n});\nwindow.supabase={createClient:()=>({auth:{getSession:async()=>({data:{session:{user}},error:null}),getUser:async()=>({data:{user},error:null}),signOut:async()=>({error:null})},rpc:async()=>({data:false,error:null}),from:table})};\n})();";
test('authenticated dashboard task, weekly check-in and report export work with a mocked backend',async({page})=>{
 await page.route('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.95.3/dist/umd/supabase.js',route=>route.fulfill({status:200,contentType:'application/javascript',body:mockSupabaseUMD}));
 await page.goto('http://127.0.0.1:8765/dashboard.html');
 await expect(page.locator('#dashboard-content')).toBeVisible();
 await expect(page.locator('#latest-score')).toHaveText('75%');
 await page.locator('#task-title').fill('Interview three customers');
 await page.locator('#task-goal').fill('Validate demand');
 await page.getByRole('button',{name:'Add task'}).click();
 await expect(page.locator('#task-list')).toContainText('Interview three customers');
 await page.locator('#task-list input[type=checkbox]').check();
 await expect(page.locator('#task-message')).toContainText('1 of 1');
 await page.locator('#checkin-win').fill('Finished customer interviews');
 await page.getByRole('button',{name:"Save this week's reflection"}).click();
 await expect(page.locator('#checkin-history')).toContainText('Finished customer interviews');
 await expect(page.locator('#report-status')).toContainText('ready');
 const [file]=await Promise.all([page.waitForEvent('download'),page.locator('#report-download').click()]);
 expect(file.suggestedFilename()).toBe('FounderDNA-progress-report.md');
});


for(const width of [320,390,768,1440]){
 test('authenticated dashboard and report fit '+width+'px viewport',async({page})=>{
  await page.setViewportSize({width,height:900});
  await page.route('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.95.3/dist/umd/supabase.js',route=>route.fulfill({status:200,contentType:'application/javascript',body:mockSupabaseUMD}));
  await page.goto('http://127.0.0.1:8765/dashboard.html');
  await expect(page.locator('#dashboard-content')).toBeVisible();
  await expect(page.locator('#report-download')).toBeEnabled();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1)).toBe(false);
 });
}
test('report export includes saved assessment and reflection data',async({page})=>{
 await page.route('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.95.3/dist/umd/supabase.js',route=>route.fulfill({status:200,contentType:'application/javascript',body:mockSupabaseUMD}));
 await page.goto('http://127.0.0.1:8765/dashboard.html');
 await expect(page.locator('#report-download')).toBeEnabled();
 const [download]=await Promise.all([page.waitForEvent('download'),page.locator('#report-download').click()]);
 expect(download.suggestedFilename()).toBe('FounderDNA-progress-report.md');
 const fs=require('node:fs');const text=fs.readFileSync(await download.path(),'utf8');
 expect(text).toContain('Latest saved assessment: 75%');
 expect(text).toContain('Founder Progress Report');
});
