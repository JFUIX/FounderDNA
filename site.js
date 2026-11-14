'use strict';
(()=>{
 const $=s=>document.querySelector(s);
 // Connected people: a delicate triangulated network of glowing points, following the pointer.
 const startNetworkCursor=()=>{
  if(!matchMedia('(hover:hover) and (pointer:fine) and (prefers-reduced-motion:no-preference)').matches)return;
  const canvas=document.createElement('canvas');canvas.className='fd-network-cursor';
  canvas.setAttribute('aria-hidden','true');document.body.append(canvas);
  const ctx=canvas.getContext('2d');if(!ctx)return;
  const points=[
   [-90,-25],[-66,-72],[-28,-102],[22,-100],[70,-75],[94,-25],
   [-91,30],[-65,77],[-27,100],[25,98],[72,67],[95,28],
   [-42,-30],[5,-44],[49,-22],[-44,28],[4,25],[51,31],[0,0]
  ].map(([x,y],i)=>({ox:x,oy:y,x:0,y:0,i}));
  let mx=-300,my=-300,x=-300,y=-300,visible=false,last=0;
  const resize=()=>{const d=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(innerWidth*d);canvas.height=Math.round(innerHeight*d);ctx.setTransform(d,0,0,d,0,0)};
  resize();addEventListener('resize',resize,{passive:true});
  addEventListener('pointermove',e=>{if(e.pointerType==='touch')return;mx=e.clientX;my=e.clientY;visible=true;canvas.style.opacity='1'},{passive:true});
  document.addEventListener('pointerleave',()=>{visible=false;canvas.style.opacity='0'});
  addEventListener('blur',()=>{visible=false;canvas.style.opacity='0'});
  document.addEventListener('visibilitychange',()=>{if(document.hidden){visible=false;canvas.style.opacity='0'}});
  const render=t=>{
   requestAnimationFrame(render);if(!visible)return;
   const dt=Math.min(t-last||16,40);last=t;
   x+=(mx-x)*Math.min(.19,dt*.012);y+=(my-y)*Math.min(.19,dt*.012);
   ctx.clearRect(0,0,innerWidth,innerHeight);
   const time=t*.001;
   points.forEach(p=>{p.x=x+p.ox+Math.sin(time*.65+p.i*1.8)*3;p.y=y+p.oy+Math.cos(time*.58+p.i*1.4)*3});
   // Connect nearby nodes into the airy, overlapping triangular mesh in the reference.
   for(let i=0;i<points.length;i++)for(let j=i+1;j<points.length;j++){
    const a=points[i],b=points[j],dist=Math.hypot(a.x-b.x,a.y-b.y);
    if(dist>108)continue;
    const alpha=(1-dist/150)*.24;
    ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);
    ctx.strokeStyle='rgba(255,224,203,'+alpha.toFixed(3)+')';ctx.lineWidth=.75;ctx.stroke();
   }
   points.forEach(p=>{
    const central=p.i===18,rad=central?3.6:(p.i%4===0?2.5:1.9);
    ctx.beginPath();ctx.arc(p.x,p.y,rad,0,Math.PI*2);
    ctx.fillStyle=central?'rgba(255,188,107,.98)':'rgba(255,237,216,.88)';ctx.fill();
   });
   const glow=ctx.createRadialGradient(x,y,0,x,y,20);
   glow.addColorStop(0,'rgba(255,125,58,.28)');glow.addColorStop(1,'rgba(255,125,58,0)');
   ctx.fillStyle=glow;ctx.beginPath();ctx.arc(x,y,20,0,Math.PI*2);ctx.fill();
  };
  requestAnimationFrame(render);
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
