'use strict';
(async()=>{
 const $=s=>document.querySelector(s);
 const status=$('#dashboard-status');
 const content=$('#dashboard-content');
 const text=(tag,value,cls)=>{const e=document.createElement(tag);e.textContent=value;if(cls)e.className=cls;return e;};
 const names={clarity:'Direction & clarity',validation:'Customer validation',execution:'Execution & prioritization',resilience:'Learning & adaptability'};
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
   if(validScores(latest)){
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
   row.append(left,text('strong',record.overall_score+'%'));history.append(row);
  }
  status.hidden=true;content.hidden=false;
 }catch(error){status.textContent='Your private dashboard could not load. Please refresh or try again later.';console.error('FounderDNA dashboard:',error);}
})();