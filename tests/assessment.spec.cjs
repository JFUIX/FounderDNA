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
