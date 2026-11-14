'use strict';
(()=>{
 const $=s=>document.querySelector(s);
 // Pixel field: square fragments respond in staggered rectangular patches, never a circular halo.
 const startNetworkCursor=()=>{
  if(!matchMedia('(hover:hover) and (pointer:fine) and (prefers-reduced-motion:no-preference)').matches)return;
  const canvas=document.createElement('canvas');canvas.className='fd-network-cursor fd-dot-matrix';
  canvas.setAttribute('aria-hidden','true');document.body.append(canvas);
  const ctx=canvas.getContext('2d');if(!ctx)return;
  const cell=17,life=540;let mx=-1000,my=-1000,active=false,last=0;
  const fragments=new Map();
  const hash=(x,y)=>{let n=Math.imul(x,374761393)+Math.imul(y,668265263);n=Math.imul(n^(n>>>13),1274126177);return ((n^(n>>>16))>>>0)/4294967295};
  const resize=()=>{const d=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(innerWidth*d);canvas.height=Math.round(innerHeight*d);ctx.setTransform(d,0,0,d,0,0)};
  resize();addEventListener('resize',resize,{passive:true});
  addEventListener('pointermove',e=>{if(e.pointerType==='touch')return;mx=e.clientX;my=e.clientY;active=true;
   const cx=Math.floor(mx/cell),cy=Math.floor(my/cell),now=performance.now();
   // Pixelated, asymmetric rectangular scatter with hard edges and occasional gaps.
   for(let iy=-3;iy<=3;iy++)for(let ix=-5;ix<=5;ix++){
    const gx=cx+ix,gy=cy+iy,noise=hash(gx,gy);
    if(noise<.52||Math.abs(ix)+Math.abs(iy)>7+noise*2)continue;
    const key=gx+','+gy;
    fragments.set(key,{gx,gy,born:now,seed:noise});
   }
   if(fragments.size>180){for(const key of fragments.keys()){fragments.delete(key);if(fragments.size<=140)break}}
  },{passive:true});
  document.addEventListener('pointerleave',()=>{active=false});
  addEventListener('blur',()=>{active=false});
  const draw=t=>{
   requestAnimationFrame(draw);
   if(document.hidden||t-last<30)return;last=t;
   ctx.clearRect(0,0,innerWidth,innerHeight);
   for(const [key,p] of fragments){
    const age=t-p.born;if(age>life){fragments.delete(key);continue}
    const fade=Math.min(1,(life-age)/190),jitter=p.seed>.86?2:0;
    const size=p.seed>.87?7:p.seed>.67?4:2.5;
    const x=p.gx*cell+cell/2-size/2+(p.seed-.5)*jitter;
    const y=p.gy*cell+cell/2-size/2;
    const red=p.seed>.91;
    ctx.fillStyle=red?'rgba(200,0,0,'+(.55*fade)+')':'rgba(255,255,255,'+(.52*fade)+')';
    ctx.fillRect(Math.round(x),Math.round(y),size,size);
   }
  };
  requestAnimationFrame(draw);
 };
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',startNetworkCursor,{once:true});else startNetworkCursor();

 const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
 const config=window.FOUNDERDNA_COMMUNITY||{};
 const fd=window.FD={db:null,user:null,reviewer:false,el,$,ok:r=>{if(r.error)throw r.error;return r.data;}};
 let toastTimer;
 fd.notify=text=>{const n=$('#site-toast');if(!n)return;n.textContent=text;n.hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>n.hidden=true,7000);};
 fd.safeReturn=()=>location.pathname.split('/').pop()+location.search;
 fd.signIn=()=>{const d=$('#site-auth');if(!d)return;$('#site-auth-status').textContent='';d.showModal();};
 document.querySelectorAll('[data-auth]').forEach(b=>b.onclick=async()=>{if(fd.user){try{fd.ok(await fd.db.auth.signOut());location.reload();}catch(e){fd.notify(e.message);}}else fd.signIn();});
 const close=$('#site-auth-close');if(close)close.onclick=()=>$('#site-auth').close();
 const form=$('#site-auth-form');if(form)form.onsubmit=async e=>{
  e.preventDefault();const b=e.submitter||form.querySelector('[type=submit]');b.disabled=true;
  try{
   await fd.ready;if(!fd.db)throw Error('Sign-in is unavailable. Try again later.');
   localStorage.setItem('fd-service-return',fd.safeReturn());
   const callback=new URL('community.html',location.href).href;
   fd.ok(await fd.db.auth.signInWithOtp({email:$('#site-email').value.trim(),options:{emailRedirectTo:callback,data:{display_name:$('#site-name').value.trim()||'Founder'}}}));
   $('#site-auth-status').textContent='Check your inbox for a sign-in link. It will return you to this task. You may need to reselect any documents after signing in.';
  }catch(err){$('#site-auth-status').textContent=err.message;}finally{b.disabled=false;}
 };
 fd.ready=(async()=>{
  if(!config.supabaseUrl||!config.supabasePublishableKey)throw Error('The service connection is not configured.');
  if(!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(config.supabaseUrl))throw Error('The service address is invalid.');
  await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.95.3/dist/umd/supabase.js';script.onload=resolve;script.onerror=()=>reject(Error('Sign-in could not load. Please refresh.'));document.head.append(script);});
  fd.db=window.supabase.createClient(config.supabaseUrl,config.supabasePublishableKey);
  const {data,error}=await fd.db.auth.getSession();if(error)fd.notify('Please request a new sign-in link.');fd.user=data?.session?.user||null;
  if(fd.user){document.querySelectorAll('[data-auth]').forEach(b=>b.textContent='Sign out');const result=await fd.db.rpc('service_reviewer_status');fd.reviewer=!result.error&&result.data===true;if(fd.reviewer)document.querySelectorAll('[data-review-link]').forEach(n=>n.hidden=false);}
  return fd;
 })();fd.ready.catch(e=>{const s=$('#service-state');if(s)s.textContent=e.message;});
})();
