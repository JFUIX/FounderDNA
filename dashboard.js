'use strict';
(async()=>{
 const $=s=>document.querySelector(s);
 const status=$('#dashboard-status');
 const content=$('#dashboard-content');
 const text=(tag,value,cls)=>{const e=document.createElement(tag);e.textContent=value;if(cls)e.className=cls;return e;};
 const names={clarity:'Direction & clarity',validation:'Customer validation',execution:'Execution & prioritization',resilience:'Learning & adaptability'};
 const actions={clarity:'Write down who you serve, the problem you solve, and one measurable goal for the next 30 days.',validation:'Talk with five potential customers and test one small offer before investing further.',execution:'Choose one high-impact task, define what done means, and review its result this week.',resilience:'Record one experiment, what happened, what you learned, and what you will change.'};
 const date=value=>new Date(value).toLocaleDateString(undefined,{year:'numeric',month:'short',day:'numeric'});
 const validScores=record=>record&&record.dimension_scores&&Object.keys(names).every(key=>Number.isInteger(record.dimension_scores[key])&&record.dimension_scores[key]>=0&&record.dimension_scores[key]<=100);
 try{
  await window.FD.ready;
  const db=window.FD.db;
  const auth=await db.auth.getUser();
  if(auth.error||!auth.data.user){
   status.replaceChildren(text('span','Sign in to see your private dashboard. '));
   const signIn=text('button','Sign in','btn');signIn.type='button';signIn.addEventListener('click',()=>window.FD.signIn());status.append(signIn);
   return;
  }
  const {data,error}=await db.from('assessment_results').select('id,overall_score,dimension_scores,created_at').order('created_at',{ascending:false}).limit(100);
  if(error)throw error;
  const records=data||[];
  $('#assessment-count').textContent=records.length===100?'100+':String(records.length);
  if(records.length){
   const latest=records[0];
   $('#latest-score').textContent=latest.overall_score+'%';
   $('#latest-date').textContent='Saved '+date(latest.created_at);
   if(records.length>1){
    const first=records[records.length-1];
    const change=latest.overall_score-first.overall_score;
    $('#score-change').textContent=(change>0?'+':'')+change+' pts';
    $('#comparison-note').textContent='Change between your oldest and newest saved reflections'+(records.length===100?' among the latest 100 records':'')+'.';
   }
   if(records.length>1){
    $('#trend-section').hidden=false;
    const trend=$('#dashboard-trend');trend.replaceChildren();
    const shown=[...records.slice(0,12)].reverse();
    trend.setAttribute('aria-label','Reflection scores oldest to newest: '+shown.map(r=>r.overall_score+' percent').join(', '));
    for(const record of shown){
     const bar=text('div','','trend-bar');
     bar.style.height=Math.max(4,record.overall_score)+'%';
     bar.title=date(record.created_at)+': '+record.overall_score+'%';
     bar.tabIndex=0;bar.setAttribute('aria-label',bar.title);
     trend.append(bar);
    }
   }
   if(validScores(latest)){
    const weakest=Object.keys(names).reduce((min,key)=>latest.dimension_scores[key]<latest.dimension_scores[min]?key:min,'clarity');
    $('#priority-title').textContent='Focus on '+names[weakest].toLowerCase()+'.';
    $('#priority-description').textContent=actions[weakest];
    $('#priority-section').hidden=false;
    $('#dimensions-section').hidden=false;
    const compare=$('#dimensions');compare.replaceChildren();
    const first=records.length>1&&validScores(records[records.length-1])?records[records.length-1]:null;
    Object.entries(names).forEach(([key,label])=>{
     const card=text('article','','dashboard-card');
     card.append(text('h3',label));
     const row=text('div','','dashboard-dimension');
     const value=latest.dimension_scores[key];
     row.append(text('span','Latest reflection'),text('strong',value+'%'));
     if(first){const diff=value-first.dimension_scores[key];row.append(text('em',(diff>0?'+':'')+diff+' pts'));}
     const track=text('div','','dashboard-track');track.setAttribute('role','meter');track.setAttribute('aria-label',label);track.setAttribute('aria-valuemin','0');track.setAttribute('aria-valuemax','100');track.setAttribute('aria-valuenow',String(value));
     const fill=text('div','');fill.style.width=value+'%';track.append(fill);row.append(track);card.append(row);compare.append(card);
    });
   }
  }
  const history=$('#dashboard-history');history.replaceChildren();
  if(!records.length)history.append(text('p','No saved results yet. Take your first assessment, then select Save to my account.'));
  for(const record of records.slice(0,12)){
   const row=text('article','','dashboard-entry');
   const left=text('div','');left.append(text('time',date(record.created_at)),text('div','Founder reflection','eyebrow'));
   row.append(left,text('strong',record.overall_score+'%'));
   const remove=text('button','Delete','dashboard-history-button');remove.type='button';
   remove.setAttribute('aria-label','Delete assessment saved '+date(record.created_at));
   remove.addEventListener('click',async()=>{
    if(!confirm('Permanently delete this saved assessment?'))return;
    remove.disabled=true;
    const result=await db.from('assessment_results').delete().eq('id',record.id);
    if(result.error){remove.disabled=false;window.FD.notify(result.error.message);return;}
    location.reload();
   });
   row.append(remove);history.append(row);
  }
  status.hidden=true;content.hidden=false;
 }catch(error){status.textContent='Your private dashboard could not load. Please refresh or try again later.';console.error('FounderDNA dashboard:',error);}
})();