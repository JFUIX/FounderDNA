'use strict';
(()=>{
 const $=s=>document.querySelector(s);
 // A quiet, page-wide matrix of points. Cursor proximity pulls points into a connected network.
 const startNetworkCursor=()=>{
  if(!matchMedia('(hover:hover) and (pointer:fine) and (prefers-reduced-motion:no-preference)').matches)return;
  const canvas=document.createElement('canvas');canvas.className='fd-network-cursor fd-dot-matrix';
  canvas.setAttribute('aria-hidden','true');document.body.append(canvas);
  const ctx=canvas.getContext('2d');if(!ctx)return;
  let points=[],cols=0,rows=0,mx=-1000,my=-1000,active=false,raf=0,last=0;
  const gap=52,radius=185;
  const resize=()=>{
   const w=innerWidth,h=innerHeight,d=Math.min(devicePixelRatio||1,2);
   canvas.width=Math.round(w*d);canvas.height=Math.round(h*d);
   ctx.setTransform(d,0,0,d,0,0);
   cols=Math.ceil(w/gap)+1;rows=Math.ceil(h/gap)+1;points=[];
   const x0=(w-(cols-1)*gap)/2,y0=(h-(rows-1)*gap)/2;
   for(let row=0;row<rows;row++)for(let col=0;col<cols;col++)
    points.push({ox:x0+col*gap,oy:y0+row*gap,x:x0+col*gap,y:y0+row*gap});
  };
  resize();addEventListener('resize',resize,{passive:true});
  addEventListener('pointermove',e=>{if(e.pointerType==='touch')return;mx=e.clientX;my=e.clientY;active=true},{passive:true});
  document.addEventListener('pointerleave',()=>{active=false});
  addEventListener('blur',()=>{active=false});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)last=0});
  const render=t=>{
   raf=requestAnimationFrame(render);
   if(document.hidden||t-last<28)return;last=t;
   ctx.clearRect(0,0,innerWidth,innerHeight);
   const near=[];
   for(const p of points){
    const dx=mx-p.ox,dy=my-p.oy,dist=Math.hypot(dx,dy);
    const influence=active?Math.max(0,1-dist/radius):0;
    // Each nearby dot is gently attracted toward the pointer, then springs back.
    const pull=influence*influence*23;
    const tx=p.ox+(dist?dx/dist*pull:0),ty=p.oy+(dist?dy/dist*pull:0);
    p.x+=(tx-p.x)*.18;p.y+=(ty-p.y)*.18;
    const close=active&&dist<radius;
    if(close)near.push({p,dist});
    ctx.beginPath();ctx.arc(p.x,p.y,close?1.5+influence*1.1:1.1,0,Math.PI*2);
    ctx.fillStyle=close?'rgba(255,255,255,'+(0.26+influence*.65)+')':'rgba(255,255,255,.16)';
    ctx.fill();
   }
   // Only the area around the pointer reveals a web of relationships.
   for(let i=0;i<near.length;i++)for(let j=i+1;j<near.length;j++){
    const a=near[i],b=near[j],dist=Math.hypot(a.p.x-b.p.x,a.p.y-b.p.y);
    if(dist>83)continue;
    const strength=(1-a.dist/radius)*(1-b.dist/radius);
    if(strength<.015)continue;
    ctx.beginPath();ctx.moveTo(a.p.x,a.p.y);ctx.lineTo(b.p.x,b.p.y);
    ctx.lineWidth=.8;ctx.strokeStyle='rgba(255,255,255,'+Math.min(.58,strength*.72)+')';ctx.stroke();
   }
  };
  raf=requestAnimationFrame(render);
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
