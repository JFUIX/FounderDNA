'use strict';
(() => {
  const $=s=>document.querySelector(s);
  const form=$('#brief-form');
  form.onsubmit=e=>{
    e.preventDefault();
    const values=['brief-business','brief-context','brief-obstacle','brief-outcome'].map(id=>$('#'+id).value.trim());
    if(values.some(v=>!v))return;
    $('#brief-output').textContent='FOUNDERDNA / PRIVATE BUSINESS BRIEF\n\nBusiness or project: '+values[0]+'\n\nWhat I am working on\n'+values[1]+'\n\nWhat is getting in the way\n'+values[2]+'\n\nA useful next step\n'+values[3];
    $('#brief-preview').hidden=false;
    $('#brief-preview').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'auto':'smooth'});
  };
  $('#download-brief').onclick=()=>{
    const url=URL.createObjectURL(new Blob([$('#brief-output').textContent],{type:'text/plain;charset=utf-8'}));
    const a=document.createElement('a');a.href=url;a.download='FounderDNA-private-brief.txt';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  };
  const config=window.FOUNDERDNA_COMMUNITY||{};
  const el=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
  async function recent(){
    const container=$('#latest-posts');
    try{
      if(!config.supabaseUrl||!config.supabasePublishableKey)throw Error('Not connected');
      const response=await fetch(config.supabaseUrl+'/rest/v1/milestones?select=id,business,category,headline,story,created_at&order=created_at.desc,id.desc&limit=3',{headers:{apikey:config.supabasePublishableKey}});
      if(!response.ok)throw Error('Could not load');const posts=await response.json();
      container.replaceChildren();
      if(!posts.length){const box=el('div');box.className='empty';box.append(el('p','The community is just getting started. Your first milestone can help set the tone.'));const a=el('a','Share the first milestone ↗');a.href='./community.html#composer';a.className='primary';box.append(a);container.append(box);return;}
      posts.forEach(p=>{const card=el('article');card.className='latest-card';const badge=el('span',p.category);badge.className='badge';const meta=el('div',p.business+' · '+new Date(p.created_at).toLocaleDateString());meta.className='latest-meta';const a=el('a','Read & join the conversation ↗');a.href='./community.html?post='+encodeURIComponent(p.id);card.append(badge,meta,el('h3',p.headline),el('p',p.story.length>160?p.story.slice(0,160)+'…':p.story),a);container.append(card);});
    }catch{const box=el('div','Recent milestones could not load here.');box.className='empty';const a=el('a',' Open the community →');a.href='./community.html';box.append(a);container.replaceChildren(box);}
  }
  recent();
})();
