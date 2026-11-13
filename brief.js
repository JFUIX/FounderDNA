'use strict';
(()=>{
 const fd=window.FD,$=fd.$,form=$('#business-brief');
 const names={support:'Request Support',collaborator:'Find a Collaborator',expert:'Ask an Expert',milestone:'Share a Milestone',expertise:'Offer Your Expertise'};
 const fields=['business','stage','purpose','sector','website','situation','tried','outcome','strengths','capabilities','support_area','collaborator_role','commitment','relationship','collaborator_offer','expert_question','skills','availability','portfolio_link','milestone_title','milestone_story','funding_path','funding_context','additional','contact_name'];
 const labels={business:'Business or professional name',stage:'Current stage',purpose:'Purpose',sector:'Sector',website:'Website',situation:'Situation and obstacle',tried:'What has been tried',outcome:'Desired next step',strengths:'Strengths',capabilities:'Team capabilities and missing skills',support_area:'Support area',collaborator_role:'Collaborator role',commitment:'Expected commitment',relationship:'Working relationship',collaborator_offer:'What you offer',expert_question:'Question for an expert',skills:'Skills and experience',availability:'Availability and engagement',portfolio_link:'Portfolio link',milestone_title:'Proposed public milestone title',milestone_story:'Proposed public milestone story',funding_path:'Funding pathway',funding_context:'Funding purpose',additional:'Additional context',contact_name:'Private contact name'};
 const key='fd-private-brief-v1';let step=0,token=crypto.randomUUID(),hasDraft=false,pendingPrivateDraft=null;
 const params=new URLSearchParams(location.search);
 function values(){return Object.fromEntries(fields.map(k=>[k,$('#'+k).value.trim()]));}
 function save(){try{localStorage.setItem(key,JSON.stringify({data:values(),action:$('#action').value,token,step,at:Date.now(),owner:fd.user?.id||null}));$('#brief-draft-status').textContent='Private draft saved on this browser for 7 days.';}catch{$('#brief-draft-status').textContent='Draft storage is unavailable. Download a copy before leaving.';}}
 function restore(d){fields.forEach(k=>{if(typeof d.data[k]==='string')$('#'+k).value=d.data[k].slice(0,4000);});if(Object.values(names).includes(d.action))$('#action').value=d.action;if(/^[a-f0-9-]{36}$/i.test(d.token))token=d.token;step=Number.isInteger(d.step)&&d.step>=0&&d.step<4?d.step:0;hasDraft=true;}
 try{const d=JSON.parse(localStorage.getItem(key)||'null');if(d&&typeof d.at==='number'&&Date.now()-d.at<7*86400000&&d.data){if(d.owner)pendingPrivateDraft=d;else restore(d);}else if(d)localStorage.removeItem(key);}catch{}
 if(names[params.get('action')])$('#action').value=names[params.get('action')];
 if(params.get('path')==='investment'){$('#funding_path').value='Investment readiness or introductions';$('#support_area').value='Funding readiness & resources';}
 if(params.get('path')==='non-investment'){$('#funding_path').value='Non-investment resources or support';$('#support_area').value='Funding readiness & resources';}
 function configure(){
  const action=$('#action').value;
  $('#brief-title').textContent=action==='Offer Your Expertise'?'Bring your expertise to the right problem.':action==='Share a Milestone'?'Make progress worth learning from.':action==='Find a Collaborator'?'Find the capabilities your next step needs.':action==='Ask an Expert'?'Give your question the right context.':'Make your next business step clearer.';
  $('#collaborator-fields').hidden=action!=='Find a Collaborator';$('#expert-fields').hidden=action!=='Ask an Expert';$('#expertise-fields').hidden=action!=='Offer Your Expertise';$('#milestone-fields').hidden=action!=='Share a Milestone';$('#funding-fields').hidden=['Offer Your Expertise','Share a Milestone'].includes(action);
  $('#public-consent-label').hidden=action!=='Share a Milestone';
  $('#document-consent-label').hidden=action!=='Offer Your Expertise'||!($('#cv').files.length||$('#portfolio').files.length);
  $('#detail-title').textContent=action==='Offer Your Expertise'?'Your skills, availability, and work.':action==='Share a Milestone'?'The progress you may choose to share.':'Make the request specific.';
 }
 function summary(){
  const out=$('#brief-summary');out.replaceChildren();const data=values();const visible=new Set(['business','stage','purpose','sector','website','situation','tried','outcome','strengths','capabilities','support_area','additional']);
  const a=$('#action').value;
  if(a==='Find a Collaborator')['collaborator_role','commitment','relationship','collaborator_offer'].forEach(k=>visible.add(k));
  if(a==='Ask an Expert')visible.add('expert_question');
  if(a==='Offer Your Expertise')['skills','availability','portfolio_link'].forEach(k=>visible.add(k));
  if(a==='Share a Milestone')['milestone_title','milestone_story'].forEach(k=>visible.add(k));else if(a!=='Offer Your Expertise')['funding_path','funding_context'].forEach(k=>visible.add(k));
  const add=(name,value)=>{out.append(fd.el('dt','',name),fd.el('dd','',value));};add('Your goal',a);
  for(const k of fields)if(visible.has(k)&&data[k])add(labels[k],data[k]);
  if(a==='Offer Your Expertise')for(const k of ['cv','portfolio'])if($('#'+k).files[0])add(k.toUpperCase()+' selected for private review',$('#'+k).files[0].name);
  $('#contact-account').textContent=fd.user?'Follow-up will use your verified sign-in email: '+fd.user.email+'. Your contact details remain private.':'Sign in to submit. Your verified sign-in email will be used for follow-up.';
  configure();
 }
 function show(){document.querySelectorAll('.wizard-step').forEach(n=>n.hidden=Number(n.dataset.step)!==step);document.querySelectorAll('#wizard-steps li').forEach((n,i)=>{n.classList.toggle('active',i===step);if(i===step)n.setAttribute('aria-current','step');else n.removeAttribute('aria-current');});$('#brief-back').hidden=step===0;$('#brief-next').hidden=step===3;$('#brief-submit').hidden=step!==3;$('#brief-step-label').textContent='Step '+(step+1)+' of 4';$('#brief-error').textContent='';if(step===3)summary();}
 function valid(which){
  let required=which===0?['business','stage']:which===1?['situation','outcome']:[];
  if(which===2&&$('#action').value==='Offer Your Expertise')required=['skills','availability'];
  if(which===2&&$('#action').value==='Share a Milestone')required=['milestone_title','milestone_story'];
  if(which===2&&$('#action').value==='Find a Collaborator')required=['collaborator_role'];
  if(which===2&&$('#action').value==='Ask an Expert')required=['expert_question'];
  for(const id of required)if(!$('#'+id).value.trim()){$('#brief-error').textContent='Please complete '+(labels[id]||id).toLowerCase()+'.';$('#'+id).focus();return false;}
  for(const id of ['website','portfolio_link']){const value=$('#'+id).value.trim();if(value){try{const u=new URL(value);if(u.protocol!=='https:'||u.username||u.password)throw Error();}catch{$('#brief-error').textContent='Website and portfolio links must be valid HTTPS addresses without login details.';step=id==='website'?0:2;show();$('#brief-error').textContent='Please use a valid HTTPS address.';$('#'+id).focus();return false;}}}
  return true;
 }
 fields.forEach(k=>$('#'+k).addEventListener('input',save));$('#action').onchange=()=>{configure();save();};['cv','portfolio'].forEach(k=>$('#'+k).onchange=()=>{configure();if(step===3)summary();});
 $('#brief-next').onclick=()=>{if(valid(step)){step++;show();save();$('#wizard-shell').scrollIntoView();}};$('#brief-back').onclick=()=>{step=Math.max(0,step-1);show();save();};
 $('#clear-brief').onclick=()=>{if(!confirm('Clear this private device draft?'))return;try{localStorage.removeItem(key);}catch{}form.reset();token=crypto.randomUUID();step=0;hasDraft=false;configure();show();$('#brief-draft-status').textContent='Draft cleared. Nothing has been sent.';};
 $('#download-business-brief').onclick=()=>{summary();const text='FOUNDERDNA / PRIVATE BRIEF\n\n'+[...$('#brief-summary').children].map(n=>n.textContent).join('\n\n')+'\n\nThis download does not send or publish the brief.';const url=URL.createObjectURL(new Blob([text],{type:'text/plain;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='FounderDNA-private-brief.txt';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
 async function fileData(input,kind,group){const file=input.files[0];if(!file)return null;if(file.size>2097152)throw Error(kind+' must be no more than 2 MB.');if(!file.name.toLowerCase().endsWith('.pdf'))throw Error(kind+' must be a PDF.');const header=new TextDecoder().decode(await file.slice(0,5).arrayBuffer());if(header!=='%PDF-')throw Error(kind+' does not appear to be a valid PDF.');const path=fd.user.id+'/'+group+'/'+crypto.randomUUID()+'.pdf';fd.ok(await fd.db.storage.from('founderdna-documents').upload(path,file,{contentType:'application/pdf',upsert:false}));return {kind,path,name:file.name.slice(0,150),size:file.size};}
 form.onsubmit=async e=>{
  e.preventDefault();for(let i=0;i<3;i++)if(!valid(i)){step=i;show();$('#brief-error').textContent='Please complete the required information in this step.';return;}
  if(!$('#contact_name').value.trim()){$('#brief-error').textContent='Please add a private contact name.';$('#contact_name').focus();return;}
  if(!$('#review_consent').checked){$('#brief-error').textContent='Please approve private team review before sending.';return;}
  const withFiles=$('#action').value==='Offer Your Expertise'&&($('#cv').files.length||$('#portfolio').files.length);
  if(withFiles&&!$('#document_consent').checked){$('#brief-error').textContent='Please approve sending the selected documents, or remove them.';return;}
  save();try{await fd.ready;}catch(err){$('#brief-error').textContent=err.message;return;}
  if(!fd.user){fd.signIn();return;}
  const b=$('#brief-submit'),uploaded=[];b.disabled=true;$('#brief-error').textContent='';
  try{
   if(withFiles){b.textContent='Uploading private documents...';for(const [id,kind] of [['cv','CV'],['portfolio','Portfolio']]){const file=await fileData($('#'+id),kind,token);if(file)uploaded.push(file);}}
   b.textContent='Saving your private request...';const data={...values(),review_consent:true,document_consent:Boolean(withFiles&&$('#document_consent').checked),public_consent:$('#action').value==='Share a Milestone'&&$('#public_consent').checked};
   const active=$('#action').value;
   if(active!=='Find a Collaborator')['collaborator_role','commitment','relationship','collaborator_offer'].forEach(k=>delete data[k]);
   if(active!=='Ask an Expert')delete data.expert_question;
   if(active!=='Offer Your Expertise')['skills','availability','portfolio_link'].forEach(k=>delete data[k]);
   if(active!=='Share a Milestone')['milestone_title','milestone_story'].forEach(k=>delete data[k]);
   if(['Offer Your Expertise','Share a Milestone'].includes(active))['funding_path','funding_context'].forEach(k=>delete data[k]);
   const received=fd.ok(await fd.db.rpc('submit_business_brief',{p_action:$('#action').value,p_brief:data,p_files:uploaded,p_client_token:token}));
   const receipt=received?.[0];if(!receipt?.request_id||!receipt.request_reference)throw Error('No receipt was returned. Keep your draft and check My Progress before retrying.');
   try{localStorage.removeItem(key);}catch{}$('#wizard-shell').hidden=true;$('#brief-receipt').hidden=false;$('#receipt-reference').textContent='Your reference: '+receipt.request_reference;$('#receipt-link').href='./requests.html?request='+encodeURIComponent(receipt.request_id);$('#brief-receipt').scrollIntoView();
  }catch(err){if(uploaded.length){try{await fd.db.storage.from('founderdna-documents').remove(uploaded.map(f=>f.path));}catch{}}$('#brief-error').textContent='Your request was not confirmed: '+err.message+' Your device draft is kept. Check My Progress before retrying if the connection was interrupted.';}
  finally{b.disabled=false;b.textContent='Send for private review ↗';}
 };
 configure();show();
 fd.ready.then(async()=>{if(pendingPrivateDraft&&pendingPrivateDraft.owner===fd.user?.id){restore(pendingPrivateDraft);if(names[params.get('action')])$('#action').value=names[params.get('action')];configure();show();}if(hasDraft&&fd.user)save();if(!hasDraft&&fd.user){try{const data=fd.ok(await fd.db.from('founder_dna').select('brief').eq('user_id',fd.user.id));if(data[0])fields.forEach(k=>{if(!$('#'+k).value&&typeof data[0].brief[k]==='string')$('#'+k).value=data[0].brief[k];});}catch{}}if(step===3)summary();}).catch(()=>{});
})();
