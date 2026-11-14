'use strict';
(()=>{
const dimensions=[
{id:'clarity',label:'Direction & clarity',advice:'Write a one-sentence customer problem, a specific audience, and one measurable goal for the next 30 days.'},
{id:'validation',label:'Customer validation',advice:'Speak to five potential customers and test one small offer before investing more time or money.'},
{id:'execution',label:'Execution & prioritization',advice:'Choose one high-impact task for this week, define done, and review the outcome before adding new tasks.'},
{id:'resilience',label:'Learning & adaptability',advice:'Keep a weekly decision log: what you tried, what happened, what you learned, and what you will change.'}
];
const questions=[
['clarity','How clearly can you describe the customer you want to serve?'],['clarity','How specifically can you explain the problem your business solves?'],['clarity','How clear is your most important goal for the next month?'],
['validation','How much direct feedback have you gathered from potential customers?'],['validation','How well have you tested whether people actually want your solution?'],['validation','How confidently can you describe what customers value enough to pay for?'],
['execution','How consistently do you turn your plans into completed actions?'],['execution','How effectively do you prioritize the most important work?'],['execution','How well do you track whether your actions produce useful results?'],
['resilience','How effectively do you learn from experiments that do not work?'],['resilience','How willing are you to adjust your approach based on evidence?'],['resilience','How consistently do you reflect on progress and decide what to improve?']
];
const options=['Not yet','Just starting','Somewhat','Mostly','Consistently'];
const answers=Array(questions.length).fill(null);let step=0;
const draftKey='founderdna-assessment-pending-v1';
try{const pending=JSON.parse(sessionStorage.getItem(draftKey)||'null');if(Array.isArray(pending)&&pending.length===12&&pending.every(v=>Number.isInteger(v)&&v>=0&&v<=4)){answers.splice(0,12,...pending);step=12;sessionStorage.removeItem(draftKey);}}catch{}

const root=document.getElementById('assessment-content');root.tabIndex=-1;
const make=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;};
const button=(label,cls,fn)=>{const b=make('button',label,cls);b.type='button';b.onclick=fn;return b;};
const score=(indices)=>Math.round(indices.reduce((sum,i)=>sum+answers[i],0)/(indices.length*4)*100);
function calculate(){
if(answers.some(a=>!Number.isInteger(a)||a<0||a>4))throw Error('Complete every question before viewing results.');
const scores=dimensions.map(d=>({...d,score:score(questions.map((q,i)=>q[0]===d.id?i:-1).filter(i=>i>=0))}));
return {scores,overall:Math.round(answers.reduce((sum,a)=>sum+a,0)/(answers.length*4)*100)};
}
function actionRow(){const row=make('div',undefined,'assessment-controls');root.append(row);return row;}
function render(){
root.replaceChildren();
if(step===questions.length){results();return;}
const label=make('div','QUESTION '+String(step+1).padStart(2,'0')+' / '+questions.length,'assessment-eyebrow');
const progress=make('div',undefined,'progress-track');progress.setAttribute('role','progressbar');progress.setAttribute('aria-label','Assessment progress');progress.setAttribute('aria-valuemin','0');progress.setAttribute('aria-valuemax',String(questions.length));progress.setAttribute('aria-valuenow',String(step));const fill=make('div',undefined,'progress-fill');fill.style.width=(step/questions.length*100)+'%';progress.append(fill);
const heading=make('h2',questions[step][1]);heading.id='question-title';
root.append(label,progress,heading);
const group=make('div',undefined,'answer-grid');group.setAttribute('role','group');group.setAttribute('aria-labelledby','question-title');
options.forEach((value,index)=>{const b=button(String(index+1).padStart(2,'0')+'  '+value,'answer',()=>{answers[step]=index;render();const selected=root.querySelector('.answer[aria-pressed="true"]');selected?.focus();});b.setAttribute('aria-pressed',String(answers[step]===index));group.append(b);});
root.append(group);
const controls=actionRow();const previous=button('Previous','secondary-action',()=>{step--;render();root.querySelector('h2')?.focus();});previous.disabled=step===0;
const next=button(step===questions.length-1?'View my results':'Next question','primary-action',()=>{if(answers[step]===null)return;step++;render();root.querySelector('h2')?.focus();});next.disabled=answers[step]===null;
controls.append(previous,next);heading.tabIndex=-1;
}
function resultCard(d){
const card=make('article',undefined,'result-card');
const top=make('div',undefined,'metric-head');top.append(make('span',d.label),make('strong',d.score+'%'));card.append(top);
const track=make('div',undefined,'metric-track');track.setAttribute('role','meter');track.setAttribute('aria-label',d.label);track.setAttribute('aria-valuemin','0');track.setAttribute('aria-valuemax','100');track.setAttribute('aria-valuenow',String(d.score));const bar=make('div',undefined,'metric-fill');bar.style.width=d.score+'%';track.append(bar);card.append(track);
card.append(make('p',d.advice));return card;
}
function results(){
const {scores,overall}=calculate();
const ordered=[...scores].sort((a,b)=>a.score-b.score);const focus=ordered[0];const strength=ordered[ordered.length-1];
root.append(make('div','YOUR FOUNDERDNA PROFILE','assessment-eyebrow'));
const hero=make('div',undefined,'results-hero');const left=make('div');left.append(make('div','Your reflection score','results-kicker'));const num=make('div',undefined,'score-large');num.append(document.createTextNode(overall+'%'));left.append(num);left.append(make('p','Based on 12 self-reported answers. This is a snapshot for reflection, not a prediction of success.'));
const right=make('div',undefined,'results-summary');right.append(make('span','YOUR CURRENT PROFILE','assessment-eyebrow'),make('h2','Build with more clarity.'));
right.append(make('p','Your strongest reported area is '+strength.label.toLowerCase()+'. Your first growth opportunity is '+focus.label.toLowerCase()+'.'));
hero.append(left,right);root.append(hero);
root.append(make('h2','Your four founder dimensions'));
const grid=make('div',undefined,'result-grid');scores.forEach(d=>grid.append(resultCard(d)));root.append(grid);
const plan=make('section',undefined,'action-plan');plan.append(make('span','YOUR NEXT 7 DAYS','assessment-eyebrow'),make('h2','Turn insight into action.'));
const list=make('ol');[
'Day 1: '+focus.advice,
'Days 2–3: Complete one small action related to this priority. Record what actually happened.',
'Days 4–5: Ask one relevant person for feedback and compare it with your assumptions.',
'Days 6–7: Review what changed, choose one measurable next step, and set a date to revisit it.'
].forEach(item=>list.append(make('li',item)));plan.append(list);root.append(plan);
const controls=actionRow();
controls.append(button('Download results','primary-action',()=>download({scores,overall,focus,strength})));
const save=button('Save to my account','secondary-action',async()=>{
 save.disabled=true;save.textContent='Saving…';
 try{
  await window.FD.ready;
  if(!window.FD.user){
   sessionStorage.setItem(draftKey,JSON.stringify(answers));
   window.FD.signIn();
   save.textContent='Sign in to save';return;
  }
  const userResult=await window.FD.db.auth.getUser();
  if(userResult.error||!userResult.data.user)throw Error('Please sign in again.');
  const payload={user_id:userResult.data.user.id,overall_score:overall,dimension_scores:Object.fromEntries(scores.map(d=>[d.id,d.score])),answers:[...answers]};
  const response=await window.FD.db.from('assessment_results').insert(payload);
  if(response.error)throw response.error;
  save.textContent='Saved to your account';
  await showHistory();
 }catch(error){save.textContent='Save to my account';window.FD?.notify(error.message||'Could not save. Please try again.');}
 finally{save.disabled=false;}
});
controls.append(save);
controls.append(button('Print / save PDF','secondary-action',()=>window.print()));
controls.append(button('Retake assessment','secondary-action',()=>{answers.fill(null);step=0;render();root.querySelector('h2')?.focus();}));
const link=make('a','Request practical support →','secondary-action');link.href='./brief.html?action=support';controls.append(link);
const history=make('section',undefined,'assessment-history');history.id='assessment-history';root.append(history);
showHistory();
}
async function showHistory(){
 const target=document.getElementById('assessment-history');if(!target||!window.FD)return;
 try{
  await window.FD.ready;
  if(!window.FD.user)return;
  const response=await window.FD.db.from('assessment_results').select('id,overall_score,dimension_scores,created_at').order('created_at',{ascending:false}).limit(10);
  if(response.error)throw response.error;
  target.replaceChildren(make('h2','Your saved assessments'));
  if(!response.data.length){target.append(make('p','No saved assessments yet. Save this result to begin tracking progress.'));return;}
  const list=make('div',undefined,'history-list');
  response.data.forEach(item=>{
   const row=make('div',undefined,'history-item');
   const date=make('span',new Date(item.created_at).toLocaleDateString());
   const total=make('strong',item.overall_score+'%');
   const remove=button('Delete','secondary-action',async()=>{
    if(!confirm('Delete this saved assessment? This cannot be undone.'))return;
    remove.disabled=true;
    const deleted=await window.FD.db.from('assessment_results').delete().eq('id',item.id);
    if(deleted.error){window.FD.notify(deleted.error.message);remove.disabled=false;return;}
    showHistory();
   });
   row.append(date,total,remove);list.append(row);
  });
  target.append(list);
 }catch(error){target.replaceChildren(make('p','Saved assessment history is unavailable right now.'));}
}
function download({scores,overall,focus,strength}){
const lines=['FounderDNA | Founder Reflection Profile','Date: '+new Date().toLocaleDateString(),'Overall reflection score: '+overall+'%','',...scores.flatMap(d=>[d.label+': '+d.score+'%',d.advice,'']),'Strongest reported area: '+strength.label,'First growth opportunity: '+focus.label,'','This is a self-reported reflection tool, not a validated diagnostic or prediction of business success.'];
const url=URL.createObjectURL(new Blob([lines.join('\n')],{type:'text/plain;charset=utf-8'}));
const a=make('a');a.href=url;a.download='FounderDNA-reflection-results.txt';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
render();
})();