'use strict';
(()=>{
 const fd=window.FD,el=fd.el;
 const button=(text,handler,cls='btn secondary')=>{const b=el('button',cls,text);b.type='button';b.onclick=handler;return b;};
 fd.button=button;
 fd.describeBrief=(container,brief)=>{
  const dl=el('dl','summary-grid');
  Object.entries(brief||{}).forEach(([k,v])=>{if(v===''||v===null||v===undefined)return;const label=k.replaceAll('_',' ');dl.append(el('dt','',label),el('dd','',typeof v==='boolean'?(v?'Yes':'No'):String(v)));});container.append(dl);
 };
 fd.requestCard=async(container,r,reviewer=false)=>{
  const card=el('article','request-card');container.append(card);
  const head=el('header');head.append(el('span','tag',r.reference),el('span','tag',r.status));card.append(head,el('h3','',r.brief.business+' / '+r.action),el('p','',r.brief.outcome),el('div','meta','Submitted '+new Date(r.created_at).toLocaleString()+' · Updated '+new Date(r.updated_at).toLocaleString()));
  if(reviewer){
   card.append(el('p','','Private contact: '+(r.brief.contact_name||'Not provided')+' · '+r.contact_email));
   const label=el('label','','Review status'),select=el('select');['Submitted','In review','Awaiting details','Next step proposed','Closed'].forEach(s=>{const o=el('option','',s);o.value=s;o.selected=s===r.status;select.append(o);});label.append(select);card.append(label);
   select.onchange=async()=>{select.disabled=true;try{const data=fd.ok(await fd.db.from('business_requests').update({status:select.value}).eq('id',r.id).select('id'));if(!data?.length)throw Error('This status could not be updated.');head.lastElementChild.textContent=select.value;fd.notify('Request status saved.');}catch(e){fd.notify(e.message);select.value=r.status;}finally{select.disabled=false;}};
  }
  const details=el('details'),summary=el('summary','','View the private brief');details.append(summary);fd.describeBrief(details,r.brief);card.append(details);
  if(r.files?.length){const docs=el('div','toolbar');r.files.forEach(f=>docs.append(button('Get private '+f.kind+' download',async e=>{const b=e.currentTarget;b.disabled=true;try{const data=fd.ok(await fd.db.storage.from('founderdna-documents').createSignedUrl(f.path,60,{download:true}));const link=el('a','btn secondary','Download '+f.kind+' (60-second link)');link.href=data.signedUrl;link.target='_blank';link.rel='noopener noreferrer';b.replaceWith(link);}catch(err){fd.notify('Document could not be opened: '+err.message);b.disabled=false;}})));card.append(el('h4','','Private application documents'),docs);}
  const intros=el('section');card.append(intros);
  async function introductions(){
   intros.replaceChildren(el('h4','','Introduction decisions'));
   try{const data=fd.ok(await fd.db.from('request_introductions').select('*').eq('request_id',r.id).order('created_at',{ascending:false}));
    if(!data.length)intros.append(el('p','','No introduction has been proposed. Your information has not been approved for external sharing.'));
    data.forEach(i=>{const box=el('div','intro-card');box.append(el('h4','',i.recipient),el('p','',i.purpose),el('strong','','Information proposed for sharing'),el('p','',i.information),el('p','','Your decision: '+i.consent));
     if(fd.user?.id===r.user_id){for(const choice of ['Approved','Declined'])box.append(button(choice==='Approved'?'Approve this introduction':'Decline / withdraw permission',async()=>{if(!confirm((choice==='Approved'?'Approve':'Decline or withdraw permission for')+' sharing only the described information with '+i.recipient+'?'))return;try{const rows=fd.ok(await fd.db.from('request_introductions').update({consent:choice}).eq('id',i.id).select('id'));if(!rows?.length)throw Error('Your decision was not saved.');await introductions();fd.notify('Your introduction decision was saved.');}catch(err){fd.notify(err.message);}}));}
     else if(i.consent==='Approved')box.append(el('small','','Owner permission recorded. Share only the described information; arrange the introduction manually.'));
     intros.append(box);
    });
   }catch(e){intros.append(el('p','','Introduction proposals could not load. Refresh to try again.'));}
  }
  await introductions();
  if(reviewer){
   const d=el('details');d.append(el('summary','','Propose a named introduction'));
   const form=el('form'),inputs={};for(const [key,title,max] of [['recipient','Recipient: person and organisation',200],['purpose','Why this introduction is useful',2000],['information','Exactly what information would be shared',3000]]){const label=el('label','',title),input=el(key==='recipient'?'input':'textarea');input.required=true;input.maxLength=max;inputs[key]=input;label.append(input);form.append(label);}const send=el('button','btn','Ask for introduction permission');send.type='submit';form.append(send);d.append(form);card.append(d);
   form.onsubmit=async e=>{e.preventDefault();send.disabled=true;try{fd.ok(await fd.db.from('request_introductions').insert({request_id:r.id,...Object.fromEntries(Object.entries(inputs).map(([k,v])=>[k,v.value.trim()]))}));form.reset();await introductions();fd.notify('Proposal saved. Wait for the owner to approve before sharing.');}catch(err){fd.notify(err.message);}finally{send.disabled=false;}};
   if(r.action==='Share a Milestone'){
    const box=el('div','intro-card');box.append(el('h4','','Public milestone review'),el('p','',r.brief.milestone_title||'No public title supplied'),el('p','',r.brief.milestone_story||'No public story supplied'),el('small','',r.brief.public_consent?'Explicit publication permission recorded. Only the business name, public title and public story will be copied.':'No public permission. Keep this update private.'));
    if(r.brief.public_consent&&!r.published_milestone_id)box.append(button('Approve & publish the consented milestone',async e=>{if(!confirm('Publish only these approved public fields? Private context and contact details will stay private.'))return;const b=e.currentTarget;b.disabled=true;try{const id=fd.ok(await fd.db.rpc('publish_reviewed_milestone',{p_request:r.id}));b.replaceWith(el('p','','Published. Milestone reference: '+id));}catch(err){fd.notify(err.message);b.disabled=false;}}));
    if(r.published_milestone_id)box.append(el('p','','This request already has a published milestone.'));card.append(box);
   }
  }
  card.append(el('h4','','Conversation & next steps'));const timeline=el('div','timeline');card.append(timeline);
  async function updates(){timeline.replaceChildren(el('p','','Loading updates...'));try{const data=fd.ok(await fd.db.from('request_updates').select('*').eq('request_id',r.id).order('created_at',{ascending:false}).limit(100));timeline.replaceChildren();if(!data.length)timeline.append(el('p','','No updates yet. Your submitted brief is waiting for human review.'));data.forEach(u=>{const item=el('div','update');item.append(el('strong','',u.kind),el('p','',u.message),el('time','',new Date(u.created_at).toLocaleString()));timeline.append(item);});}catch{timeline.replaceChildren(el('p','','Updates could not load. Refresh to try again.'));}}
  await updates();
  const messageForm=el('form');const kind=el('select');(reviewer?['Team response','Next action','Relevant opportunity']:['Message','Weekly check-in']).forEach(k=>{const o=el('option','',k);o.value=k;kind.append(o);});const kindLabel=el('label','','Update type');kindLabel.append(kind);const msgLabel=el('label','',reviewer?'Reply, feedback, or a useful next action':'Reply or check in on your progress'),msg=el('textarea');msg.required=true;msg.maxLength=4000;msg.rows=4;msg.placeholder=reviewer?'Be specific about what happens next. Describe any opportunity accurately.':'What changed? What is holding you back now? What is your next step?';msgLabel.append(msg);const submit=el('button','btn',reviewer?'Save team update':'Save private update');submit.type='submit';messageForm.append(kindLabel,msgLabel,submit);card.append(messageForm,el('small','','Updates are shown here, not emailed. Refresh My Progress to check for responses. A weekly check-in is a useful rhythm; no automatic reminder is sent.'));
  messageForm.onsubmit=async e=>{e.preventDefault();if(!msg.value.trim())return;submit.disabled=true;try{fd.ok(await fd.db.from('request_updates').insert({request_id:r.id,author_id:fd.user.id,kind:kind.value,message:msg.value.trim()}));msg.value='';await updates();fd.notify('Private update saved.');}catch(err){fd.notify(err.message);}finally{submit.disabled=false;}};
 };
})();
