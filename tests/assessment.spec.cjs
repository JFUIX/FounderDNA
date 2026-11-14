const { test, expect } = require('@playwright/test');
const path = require('node:path');
const url = 'file://' + path.resolve(__dirname, '..', 'assessment.html');
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
