'use strict';
(()=>{
 const $=s=>document.querySelector(s);
 // Subtle network of isometric cubes: each cube represents a person, with links appearing as they connect.
 const startNetworkCursor=()=>{
  if(!matchMedia('(hover:hover) and (pointer:fine) and (prefers-reduced-motion:no-preference)').matches)return;
  const canvas=document.createElement('canvas');
  canvas.className='fd-network-cursor';canvas.setAttribute('aria-hidden','true');
  document.body.append(canvas);
  const ctx=canvas.getContext('2d');if(!ctx)return;
  const nodes=Array.from({length:7},(_,i)=>({x:0,y:0,phase:i*2.39996}));
  let mx=-200,my=-200,x=-200,y=-200,visible=false,last=0,frame=0;
  const resize=()=>{const d=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(innerWidth*d);canvas.height=Math.round(innerHeight*d);ctx.setTransform(d,0,0,d,0,0);};
  resize();addEventListener('resize',resize,{passive:true});
  addEventListener('pointermove',e=>{if(e.pointerType==='touch')return;mx=e.clientX;my=e.clientY;visible=true;canvas.style.opacity='1';},{passive:true});
  document.addEventListener('pointerleave',()=>{visible=false;canvas.style.opacity='0';});
  addEventListener('blur',()=>{visible=false;canvas.style.opacity='0';});
  const cube=(cx,cy,size,alpha)=>{
   const h=size*.55;ctx.strokeStyle='rgba(255,75,75,'+alpha+')';ctx.lineWidth=1.2;
   ctx.beginPath();ctx.moveTo(cx,cy-h);ctx.lineTo(cx+size,cy-h*.5);ctx.lineTo(cx,cy);ctx.lineTo(cx-size,cy-h*.5);ctx.closePath();
   ctx.moveTo(cx-size,cy-h*.5);ctx.lineTo(cx-size,cy+h*.5);ctx.lineTo(cx,cy+h);
   ctx.lineTo(cx+size,cy+h*.5);ctx.lineTo(cx+size,cy-h*.5);
   ctx.moveTo(cx,cy);ctx.lineTo(cx,cy+h);ctx.stroke();
  };
  const render=t=>{
   frame=requestAnimationFrame(render);if(!visible)return;
   const dt=Math.min((t-last)||16,40);last=t;
   x+=(mx-x)*Math.min(.22,dt*.014);y+=(my-y)*Math.min(.22,dt*.014);
   ctx.clearRect(0,0,innerWidth,innerHeight);
   const time=t*.001;
   nodes.forEach((n,i)=>{
    const angle=n.phase+Math.sin(time*.45+i)*.14;
    const radius=i===0?0:16+Math.sqrt(i)*13;
    n.x=x+Math.cos(angle)*radius+Math.sin(time*1.2+i)*3;
    n.y=y+Math.sin(angle)*radius*.7+Math.cos(time+i)*3;
   });
   nodes.forEach((n,i)=>{if(!i)return;const parent=nodes[Math.floor((i-1)/2)];
    const dist=Math.hypot(n.x-parent.x,n.y-parent.y);
    if(dist<75){ctx.beginPath();ctx.moveTo(parent.x,parent.y);ctx.lineTo(n.x,n.y);
     ctx.strokeStyle='rgba(255,85,85,'+(0.16+0.24*(1-dist/75))+')';ctx.lineWidth=1;ctx.stroke();}
   });
   nodes.forEach((n,i)=>cube(n.x,n.y,i===0?5.8:4.2,i===0?.95:.65));
  };
  frame=requestAnimationFrame(render);
  document.addEventListener('visibilitychange',()=>{if(document.hidden){canvas.style.opacity='0';visible=false;}});
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
