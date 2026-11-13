'use strict';
(async()=>{
 const fd=window.FD,$=fd.$;
 async function load(){
  $('#refresh-requests').disabled=true;$('#requests-state').textContent='Loading your private requests...';
  try{
   await fd.ready;$('#request-list').replaceChildren();$('#dna-snapshot').replaceChildren();
   if(!fd.user){$('#requests-state').textContent='Sign in with the email used for your requests. Your briefs and contact information are private.';$('#request-list').append(fd.button('Sign in to My Progress',fd.signIn,'btn'));return;}
   let query=fd.db.from('business_requests').select('*').eq('user_id',fd.user.id).order('created_at',{ascending:false}).limit(100);
   const id=new URLSearchParams(location.search).get('request');if(id&&/^[a-f0-9-]{36}$/i.test(id))query=query.eq('id',id);
   const data=fd.ok(await query);$('#requests-state').textContent=data.length?'Your saved requests. Refresh here for team responses and next steps.':'No requests found for this account. Start a brief to tell us what would help.';
   const profile=await fd.db.from('founder_dna').select('*').eq('user_id',fd.user.id);if(!profile.error&&profile.data[0]){const d=fd.el('details');d.append(fd.el('summary','','Your private FounderDNA / latest business context'));fd.describeBrief(d,profile.data[0].brief);$('#dna-snapshot').append(d);}
   for(const r of data)await fd.requestCard($('#request-list'),r,false);
  }catch(e){$('#requests-state').textContent='Your private progress space could not load: '+e.message+' Please refresh or contact the project owner.';}finally{$('#refresh-requests').disabled=false;}
 }
 $('#refresh-requests').onclick=load;await load();
})();
