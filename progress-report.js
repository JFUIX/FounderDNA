'use strict';
(async()=>{
 const $=s=>document.querySelector(s);
 const status=$('#report-status'),stats=$('#report-stats'),summary=$('#report-summary'),notes=$('#report-notes');
 const download=$('#report-download'),print=$('#report-print');
 if(!status||!window.FD)return;
 const make=(tag,value,cls)=>{const el=document.createElement(tag);el.textContent=value;if(cls)el.className=cls;return el;};
 const validScore=n=>Number.isInteger(n)&&n>=0&&n<=100;
 const date=v=>new Date(v).toLocaleDateString(undefined,{year:'numeric',month:'short',day:'numeric'});
 const esc=s=>String(s??'').replaceAll('\\','\\\\').replaceAll('\n',' ');
 try{
  await window.FD.ready;
  const auth=await window.FD.db.auth.getUser();
  if(auth.error||!auth.data.user)return;
  const db=window.FD.db;
  const [a,t,w]=await Promise.all([
   db.from('assessment_results').select('overall_score,dimension_scores,created_at').order('created_at',{ascending:false}).limit(100),
   db.from('founder_action_tasks').select('title,goal,completed,created_at').order('created_at',{ascending:false}).limit(100),
   db.from('founder_weekly_checkins').select('week_start,win,challenge,lesson,next_focus').order('week_start',{ascending:false}).limit(52)
  ]);
  if(a.error||t.error||w.error)throw a.error||t.error||w.error;
  const assessments=(a.data||[]).filter(x=>validScore(x.overall_score));
  const tasks=t.data||[],checkins=w.data||[];
  const done=tasks.filter(x=>x.completed).length,open=tasks.length-done;
  const latest=assessments[0],oldest=assessments[assessments.length-1];
  const change=assessments.length>1?latest.overall_score-oldest.overall_score:null;
  const label=(value,title)=>{const el=make('div','','report-stat');el.append(make('strong',value),make('span',title));stats.append(el);};
  stats.replaceChildren();
  label(latest?latest.overall_score+'%':'Not available','Latest assessment');
  label(tasks.length?done+' / '+tasks.length:'0','Completed / recent tasks');
  label(String(checkins.length),'Recent weekly check-ins');
  const lines=[
   latest?'Latest saved assessment: '+latest.overall_score+'% ('+date(latest.created_at)+').':'No saved assessments yet.',
   change===null?'At least two assessments are needed for a score comparison.':'Change between oldest and newest retrieved assessments: '+(change>0?'+':'')+change+' percentage points.',
   tasks.length?done+' of '+tasks.length+' retrieved tasks complete; '+open+' remaining.':'No saved action tasks yet.',
   checkins.length?'Latest weekly check-in: week of '+checkins[0].week_start+'.':'No weekly check-ins saved yet.'
  ];
  if(assessments.length===100||tasks.length===100||checkins.length===52)lines.push('Some sections are limited to recent records; this is not an all-time report.');
  summary.textContent=lines.join('\n');
  notes.replaceChildren();
  const add=(title,body)=>{if(!body)return;const article=make('article','');article.append(make('h3',title),make('p',body));notes.append(article);};
  const recent=checkins[0];
  if(recent){
   add('Latest win',recent.win);
   add('Latest lesson',recent.lesson);
   add('Next focus',recent.next_focus);
  }
  const pending=tasks.filter(x=>!x.completed).slice(0,5);
  if(pending.length)add('Next actions',pending.map(x=>'• '+x.title+(x.goal?': '+x.goal:'')).join('\n'));
  const exportText=()=>[
   '# FounderDNA | Founder Progress Report',
   'Generated: '+new Date().toLocaleString(),
   '',
   '## Snapshot',...lines,'',
   '## Most recent reflection',
   ...(recent?['Week of '+recent.week_start,'Win: '+recent.win,'Challenge: '+recent.challenge,'Lesson: '+recent.lesson,'Next focus: '+recent.next_focus]:['No weekly reflection saved.']),
   '',
   '## Pending action tasks',
   ...(pending.length?pending.map(x=>'- '+esc(x.title)+(x.goal?' ('+esc(x.goal)+')':'')):['No pending tasks.']),
   '',
   'Personal reflection only. Not a prediction or objective business-performance assessment.'
  ].join('\n');
  download.addEventListener('click',()=>{
   const blob=new Blob([exportText()],{type:'text/markdown;charset=utf-8'});
   const url=URL.createObjectURL(blob),link=document.createElement('a');
   link.href=url;link.download='FounderDNA-progress-report.md';document.body.append(link);link.click();link.remove();
   setTimeout(()=>URL.revokeObjectURL(url),1500);
  });
  print.addEventListener('click',()=>window.print());
  download.disabled=false;print.disabled=false;
  status.textContent='Your private report is ready. The download stays on your device.';
 }catch(error){status.textContent='Report unavailable. Please try again later.';console.error('FounderDNA report:',error);}
})();