'use strict';
(async()=>{
 const fd=window.FD,$=fd.$;let rows=[];
 async function renderList(){const status=$('#queue-status').value;const data=rows.filter(r=>status==='All requests'||r.status===status);$('#review-list').replaceChildren();if(!data.length)$('#review-list').append(fd.el('p','','No requests in this queue.'));data.forEach(r=>{const b=fd.button(r.reference+' / '+r.brief.business+' / '+r.action+' / '+r.status,async()=>{$('#review-detail').replaceChildren();await fd.requestCard($('#review-detail'),r,true);});$('#review-list').append(b);});}
 async function moderate(){
  const out=$('#milestone-queue');out.replaceChildren();
  const data=fd.ok(await fd.db.from('milestones').select('id,business,headline,story,publication_consent,publication_status').eq('publication_status','Pending').order('created_at',{ascending:true}).limit(100));
  if(!data.length)out.append(fd.el('p','','No community milestones waiting for review. Private milestone requests are reviewed in the request queue above.'));
  data.forEach(m=>{const box=fd.el('article','request-card');box.append(fd.el('span','tag','Pending / '+m.business),fd.el('h3','',m.headline),fd.el('p','',m.story));if(m.publication_consent){box.append(fd.button('Approve publication',()=>decide('Approved')));}else box.append(fd.el('p','','No explicit public consent. Do not approve; ask the owner to resubmit with permission.'));box.append(fd.button('Decline publication',()=>decide('Declined')));out.append(box);
   async function decide(status){if(!confirm(status==='Approved'?'Publish this consented milestone?':'Decline public publication?'))return;try{const rows=fd.ok(await fd.db.from('milestones').update({publication_status:status}).eq('id',m.id).select('id'));if(!rows?.length)throw Error('The moderation decision was not saved.');box.remove();fd.notify('Moderation decision saved.');}catch(err){fd.notify(err.message);}}
  });
 }
 async function load(){
  try{await fd.ready;if(!fd.user){$('#review-state').textContent='Sign in using your authorized reviewer email. No private requests are shown until access is verified.';$('#review-state').append(fd.button('Sign in',fd.signIn));return;}
   const allowed=fd.ok(await fd.db.rpc('service_reviewer_status'));if(!allowed){$('#review-state').textContent='This account does not have reviewer access. Request access from the project owner.';return;}
   $('#review-state').textContent='Authorized private review desk. Read only what is needed to help the requester.';$('#review-workspace').hidden=false;rows=fd.ok(await fd.db.from('business_requests').select('*').order('created_at',{ascending:false}).limit(200));await renderList();await moderate();
  }catch(e){$('#review-state').textContent='The review desk could not load: '+e.message;}
 }
 $('#refresh-review').onclick=load;$('#queue-status').onchange=renderList;await load();
})();
