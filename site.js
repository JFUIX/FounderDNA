'use strict';
(()=>{
 const $=s=>document.querySelector(s);
 const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
 const config=window.FOUNDERDNA_COMMUNITY||{};
 const fd=window.FD={db:null,user:null,reviewer:false,el,$,ok:r=>{if(r.error)throw r.error;return r.data;}};
 let toastTimer,connection;
 fd.notify=text=>{const n=$('#site-toast');if(!n)return;n.textContent=text;n.hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>n.hidden=true,7000);};
 fd.safeReturn=()=>location.pathname.split('/').pop()||'index.html';
 fd.signIn=()=>{const d=$('#site-auth');if(!d)return;$('#site-auth-status').textContent='';if(!d.open)d.showModal();fd.ready.catch(e=>{$('#site-auth-status').textContent=e.message;});};
 document.querySelectorAll('[data-auth]').forEach(b=>b.onclick=async()=>{if(fd.user){b.disabled=true;try{fd.ok(await fd.db.auth.signOut());location.reload();}catch(e){fd.notify(e.message);b.disabled=false;}}else fd.signIn();});
 const close=$('#site-auth-close');if(close)close.onclick=()=>$('#site-auth').close();
 const form=$('#site-auth-form');if(form)form.onsubmit=async e=>{
  e.preventDefault();const b=e.submitter||form.querySelector('[type=submit]');b.disabled=true;
  try{
   await fd.ready;if(!fd.db)throw Error('Sign-in is unavailable. Try again later.');
   const destination=fd.safeReturn()+location.search;
   try{localStorage.setItem('fd-service-return',destination);}catch{}
   // Keep the deployed callback URL exact; Supabase redirect allow-lists may reject extra query parameters.
   const callback=new URL('community.html',location.href);
   fd.ok(await fd.db.auth.signInWithOtp({email:$('#site-email').value.trim(),options:{emailRedirectTo:callback.href,data:{display_name:$('#site-name').value.trim()||'Founder'}}}));
   $('#site-auth-status').textContent='Check your inbox for a sign-in link. It will return you to this task. You may need to reselect any documents after signing in.';
  }catch(err){$('#site-auth-status').textContent=err.message;}finally{b.disabled=false;}
 };
 async function initialize(){
  if(!config.supabaseUrl||!config.supabasePublishableKey)throw Error('The service connection is not configured.');
  if(!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(config.supabaseUrl))throw Error('The service address is invalid.');
  await new Promise((resolve,reject)=>{
   const script=document.createElement('script');
   const timer=setTimeout(()=>{script.remove();reject(Error('Sign-in took too long to load. Please refresh and try again.'));},15000);
   script.src='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.95.3/dist/umd/supabase.js';
   script.onload=()=>{clearTimeout(timer);resolve();};script.onerror=()=>{clearTimeout(timer);reject(Error('Sign-in could not load. Please refresh.'));};document.head.append(script);
  });
  fd.db=window.supabase.createClient(config.supabaseUrl,config.supabasePublishableKey);
  const {data,error}=await fd.db.auth.getSession();if(error)fd.notify('Please request a new sign-in link.');fd.user=data?.session?.user||null;
  // Clear rendered private data on logout or account changes in this or another tab.
  fd.db.auth.onAuthStateChange?.((_event,session)=>{if((session?.user?.id||null)!==(fd.user?.id||null))location.reload();});
  if(fd.user){document.querySelectorAll('[data-auth]').forEach(b=>b.textContent='Sign out');const result=await fd.db.rpc('service_reviewer_status');fd.reviewer=!result.error&&result.data===true;if(fd.reviewer)document.querySelectorAll('[data-review-link]').forEach(n=>n.hidden=false);}
  return fd;
 }
 Object.defineProperty(fd,'ready',{get(){if(!connection){connection=initialize();connection.catch(e=>{const s=$('#service-state');if(s)s.textContent=e.message;});}return connection;}});
 // Existing sessions still get the account controls immediately; anonymous public pages stay lightweight.
 try{const ref=new URL(config.supabaseUrl).hostname.split('.')[0];if(localStorage.getItem('sb-'+ref+'-auth-token'))fd.ready.catch(()=>{});}catch{}
})();
