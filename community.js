'use strict';
(async () => {
  const $ = s => document.querySelector(s);
  const el = (tag, cls, text) => { const n=document.createElement(tag); if(cls)n.className=cls; if(text!==undefined)n.textContent=text; return n; };
  const config=window.FOUNDERDNA_COMMUNITY||{};
  const live=Boolean(config.supabaseUrl&&config.supabasePublishableKey);
  const categories=['Launch','Customers','Product','Team','Funding','Learning'];
  const fields=['business','category','headline','story'];
  const uuid=s=>typeof s==='string'&&/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(s);
  const params=new URLSearchParams(location.search);
  const selectedPost=uuid(params.get('post'))?params.get('post'):null;
  const selectedBusiness=uuid(params.get('business'))?params.get('business'):null;
  const draftKey='founderdna-milestone-draft-v2';
  const previewKey='founderdna-community-preview-v1';
  const date=s=>new Date(s).toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'});
  let db,user=null,posts=[],profiles={},ownProfile=null,blocks=[],inbox=[],filter='All',offset=0,hasMore=false,loading=false,request=0,editing=null,reportTarget=null;
  let toastTimer,searchTimer,preview={posts:[],comments:[]};
  const ok=result=>{if(result.error)throw result.error;return result.data;};
  function notify(text){$('#toast').textContent=text;$('#toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>{$('#toast').hidden=true;},7000);}
  function button(text,cls,handler){const b=el('button',cls,text);b.type='button';b.onclick=handler;return b;}
  function profileName(id,fallback){return profiles[id]?.founder_name||fallback||'Community member';}
  function readJSON(key,fallback){try{return JSON.parse(localStorage.getItem(key))||fallback;}catch{return fallback;}}
  function writePreview(){try{localStorage.setItem(previewKey,JSON.stringify(preview));}catch{throw Error('Browser storage is full or unavailable. Your change was not saved.');}}
  function draftPayload(){return Object.fromEntries(fields.map(id=>[id,$('#'+id).value]));}
  function saveDraft(){
    const draft={...draftPayload(),owner:user?.id||null,editing,at:Date.now()};
    try{localStorage.setItem(draftKey,JSON.stringify(draft));$('#draft-status').textContent='Draft saved on this device for 7 days.';return true;}
    catch{$('#draft-status').textContent='Draft could not be saved on this device. Keep a copy before leaving.';return false;}
  }
  function restoreDraft(){
    const d=readJSON(draftKey,null);
    if(!d||typeof d.at!=='number')return;
    if(Date.now()-d.at>7*86400000){try{localStorage.removeItem(draftKey);}catch{}return;}
    if(d.owner&&d.owner!==user?.id)return;
    const limits={business:80,category:20,headline:120,story:2000};
    for(const id of fields)if(typeof d[id]==='string'&&(id!=='category'||categories.includes(d[id])))$('#'+id).value=d[id].slice(0,limits[id]);
    if(d.editing&&d.owner===user?.id&&uuid(d.editing))editing=d.editing;
    updateComposer();$('#draft-status').textContent='Your saved draft has been restored. Nothing has been published.';
  }
  function resetComposer(clearBusiness=false){
    editing=null;$('#headline').value='';$('#story').value='';$('#category').value='Launch';
    if(clearBusiness)$('#business').value='';
    try{localStorage.removeItem(draftKey);}catch{}
    $('#draft-status').textContent='Drafts save on this device for 7 days.';updateComposer();
  }
  function updateComposer(){
    $('#composer-title').textContent=editing?'Revise your milestone for review':'What moved forward?';
    $('#publish').textContent=editing?'Save & request review':live?'Request publication review ↗':'Save preview milestone ↗';
    $('#cancel-edit').hidden=!editing;
  }
  fields.forEach(id=>$('#'+id).addEventListener('input',saveDraft));
  $('#clear-draft').onclick=()=>{if(confirm('Clear the milestone draft saved on this device?'))resetComposer(true);};
  $('#cancel-edit').onclick=()=>{if(confirm('Discard your unsaved edits?'))resetComposer();};
  document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>$('#'+b.dataset.close).close());
  $('#auth .close').onclick=()=>$('#auth').close();
  function updateAccount(){
    $('#account').textContent=user?'Sign out':live?'Sign in':'Preview mode';
    $('#profile-button').hidden=!user;$('#inbox-button').hidden=!user;
  }
  function openAuth(){saveDraft();$('#auth-status').textContent='';$('#auth').showModal();}
  $('#account').onclick=async()=>{
    if(!live){notify('Local preview: accounts are available after a public connection is configured.');return;}
    if(!db){notify('Sign-in is still loading. Please try again shortly.');return;}
    if(!user){openAuth();return;}
    try{ok(await db.auth.signOut());user=null;ownProfile=null;blocks=[];inbox=[];resetComposer(true);updateAccount();await load();notify('Signed out.');}catch(e){notify(e.message);}
  };
  $('#auth-form').onsubmit=async e=>{
    e.preventDefault();if(!db)return;
    const submit=e.submitter||$('#auth-form button[type="submit"]');submit.disabled=true;
    try{
      const name=$('#display-name').value.trim();if(!name)throw Error('Please enter your public name.');
      ok(await db.auth.signInWithOtp({email:$('#email').value.trim(),options:{emailRedirectTo:location.origin+location.pathname,data:{display_name:name}}}));
      $('#auth-status').textContent='Check your inbox for a sign-in link. Your milestone draft is saved on this device. Your public name appears with posts and replies; your email stays private.';
    }catch(err){$('#auth-status').textContent=err.message;}finally{submit.disabled=false;}
  };
  async function identity(){
    if(!user||!db){ownProfile=null;blocks=[];inbox=[];updateAccount();return;}
    const id=user.id;
    try{
      const [p,b]=await Promise.all([db.from('business_profiles').select('*').eq('user_id',id),db.from('community_blocks').select('blocked_id').eq('blocker_id',id)]);
      if(user?.id!==id)return;
      ownProfile=ok(p)?.[0]||null;blocks=ok(b).map(x=>x.blocked_id);
      if(ownProfile){profiles[id]=ownProfile;if(!$('#business').value)$('#business').value=ownProfile.business;}
      restoreDraft();await refreshInbox();
    }catch(e){notify('Account settings could not load: '+e.message);}updateAccount();
  }
  function hideBlocked(query,column='user_id'){return blocks.length?query.not(column,'in','('+blocks.join(',')+')'):query;}
  async function load(reset=true){
    if(!reset&&loading)return;
    const version=++request;loading=true;$('#refresh').disabled=true;$('#more').disabled=true;
    try{
      let rows;
      const start=reset?0:offset;
      if(live){
        let query=db.from('milestones').select('id,user_id,business,author_name,category,headline,story,created_at,updated_at,publication_status,milestone_comments(count)').order('created_at',{ascending:false}).order('id',{ascending:false});
        if(selectedPost)query=query.eq('id',selectedPost);
        if(selectedBusiness)query=query.eq('user_id',selectedBusiness);
        if(filter!=='All')query=query.eq('category',filter);
        const q=$('#search').value.trim();if(q)query=query.textSearch('search_document',q,{type:'websearch',config:'english'});
        rows=ok(await hideBlocked(query).range(start,start+29));
        if(version!==request)return;
        const ids=[...new Set(rows.map(p=>p.user_id).filter(Boolean))];
        if(selectedBusiness&&!ids.includes(selectedBusiness))ids.push(selectedBusiness);
        if(ids.length){const result=await db.from('business_profiles').select('*').in('user_id',ids);if(!result.error)(result.data||[]).forEach(p=>profiles[p.user_id]=p);}
      }else{
        const q=$('#search').value.trim().toLowerCase();
        rows=preview.posts.filter(p=>(filter==='All'||p.category===filter)&&[p.business,p.headline,p.story].join(' ').toLowerCase().includes(q));
      }
      if(version!==request)return;
      posts=reset?rows:[...posts,...rows.filter(p=>!posts.some(old=>old.id===p.id))];offset=start+rows.length;hasMore=live&&!selectedPost&&rows.length===30;
      render();
      if(selectedPost&&posts[0]&&posts[0].publication_status==='Approved'){const thread=$('.post .thread');thread.hidden=false;$('.conversation-button').setAttribute('aria-expanded','true');await loadThread(thread,posts[0]);}
    }catch(e){if(version===request){if(!posts.length)$('#posts').replaceChildren(el('div','empty','The feed could not load. Use Refresh to try again.'));notify('Could not load milestones: '+e.message);}}
    finally{if(version===request){loading=false;$('#refresh').disabled=false;$('#more').disabled=false;}}
  }
  function render(){
    $('#posts').replaceChildren(...posts.map(postCard));
    if(!posts.length){const box=el('div','empty',selectedPost?'This milestone is unavailable or hidden.':filter!=='All'||$('#search').value.trim()?'No milestones match this search. Try another term or category.':'The community is just getting started. Share a milestone to start the first conversation.');if(!selectedPost)box.append(button('Share a milestone','primary',()=>{$('#business').focus();$('#composer').scrollIntoView();}));$('#posts').append(box);}
    $('#more').hidden=!hasMore;
    if(selectedPost||selectedBusiness){const context=$('#route-context');context.hidden=false;context.replaceChildren(el('span','',selectedBusiness?'Milestones from '+(profiles[selectedBusiness]?.business||'this member')+' · ': 'Viewing one milestone · '));const a=el('a','','Back to all milestones →');a.href='./community.html';context.append(a);}
  }
  async function share(post){
    const url=new URL('community.html',location.href);url.searchParams.set('post',post.id);
    try{await navigator.clipboard.writeText(url.href);notify('Milestone link copied.');}catch{prompt('Copy this milestone link:',url.href);}
  }
  function editPost(post){
    if(live&&user?.id!==post.user_id)return;
    if(($('#headline').value.trim()||$('#story').value.trim())&&!confirm('Replace your current draft with this milestone?'))return;
    fields.forEach(id=>$('#'+id).value=post[id]);$('#milestone-consent').checked=false;editing=post.id;saveDraft();updateComposer();$('#composer').scrollIntoView();$('#headline').focus();
  }
  function conversationLabel(post){const count=post.milestone_comments?.[0]?.count??preview.comments.filter(c=>c.post_id===post.id).length;return count?count+' '+(count===1?'reply':'replies')+' · Join conversation':'Start the conversation ↗';}
  function postCard(post){
    const article=el('article','panel post');article.id='post-'+post.id;
    const top=el('div','post-top'),identityEl=el('div','post-identity');
    const business=button(post.business,'business-link',()=>showProfile(post.user_id,post));identityEl.append(business);
    identityEl.append(el('div','post-meta',profileName(post.user_id,post.author_name)+' · '+date(post.created_at)+(post.updated_at?' · Edited':'')));
    top.append(el('div','avatar business-avatar',post.business.slice(0,2).toUpperCase()),identityEl,el('span','badge',post.category));
    article.append(top,el('h3','',post.headline),el('p','post-body',post.story));
    if(live&&post.publication_status!=='Approved')article.append(el('p','notice',post.publication_status==='Declined'?'Publication was declined. You can revise and resubmit.':'Private to you and the review team. Awaiting publication review.'));
    const actions=el('div','post-actions');
    const thread=el('div','thread');thread.hidden=true;thread.id='thread-'+post.id;
    const toggle=button(conversationLabel(post),'conversation-button',async()=>{thread.hidden=!thread.hidden;toggle.setAttribute('aria-expanded',String(!thread.hidden));if(!thread.hidden)await loadThread(thread,post);});toggle.setAttribute('aria-expanded','false');toggle.setAttribute('aria-controls',thread.id);if(live&&post.publication_status!=='Approved'){toggle.disabled=true;toggle.textContent='Awaiting review';}actions.append(toggle);
    const controls=el('div','post-controls');controls.append(button('Copy link','text-button',()=>share(post)));
    if(!live||user?.id===post.user_id){
      controls.append(button('Edit','text-button',()=>editPost(post)));
      controls.append(button('Delete','text-button',async e=>{
        if(!confirm('Delete this milestone and all its replies?'))return;const b=e.currentTarget;b.disabled=true;
        try{
          if(live){const data=ok(await db.from('milestones').delete().eq('id',post.id).select('id'));if(!data?.length)throw Error('This milestone could not be deleted. Please sign in again.');}
          else{const before=structuredClone(preview);preview.posts=preview.posts.filter(p=>p.id!==post.id);preview.comments=preview.comments.filter(c=>c.post_id!==post.id);try{writePreview();}catch(e){preview=before;throw e;}}
          if(editing===post.id)resetComposer();await load();notify('Milestone deleted.');
        }catch(err){notify(err.message);b.disabled=false;}
      }));
    }else{
      controls.append(button('Report','text-button',()=>openReport({post_id:post.id})));
      controls.append(button('Hide member','text-button',()=>blockMember(post.user_id)));
    }
    actions.append(controls);article.append(actions,thread);return article;
  }
  const replyDraftKey=post=>'founderdna-reply-draft-'+(user?.id||'guest')+'-'+post.id;
  async function loadThread(thread,post){
    thread.replaceChildren(el('p','','Loading conversation...'));
    const list=el('div'),more=button('Load older replies','outline',()=>read(false));let count=0,busy=false;
    async function read(reset){
      if(busy)return;busy=true;more.disabled=true;
      try{
        let comments;
        if(live){const start=reset?0:count;comments=ok(await hideBlocked(db.from('milestone_comments').select('*').eq('post_id',post.id).order('created_at',{ascending:false}).order('id',{ascending:false})).range(start,start+49));}
        else comments=preview.comments.filter(c=>c.post_id===post.id).slice().reverse();
        if(reset){list.replaceChildren();count=0;}count+=comments.length;
        comments.forEach(c=>list.append(replyCard(c,post,()=>loadThread(thread,post))));more.hidden=!live||comments.length<50;
        if(!count)list.append(el('p','','No replies yet. Start the conversation.'));
      }catch(e){list.replaceChildren(el('p','','Replies could not load. Close and reopen the conversation to retry.'));notify(e.message);}finally{busy=false;more.disabled=false;}
    }
    thread.replaceChildren(el('small','muted','Newest replies first'),list,more);
    await read(true);
    if(live&&!user){thread.append(button('Sign in to reply','outline',openAuth));return;}
    const form=el('form','reply-form');
    if(!live){const label=el('label','','Your name'),input=el('input');input.name='author';input.required=true;input.maxLength=60;label.append(input);form.append(label);}
    const label=el('label','','Add a public reply'),body=el('textarea');body.name='body';body.required=true;body.maxLength=1000;body.rows=3;label.append(body);
    const saved=readJSON(replyDraftKey(post),null);if(saved&&Date.now()-saved.at>7*86400000){try{localStorage.removeItem(replyDraftKey(post));}catch{}}if(saved&&typeof saved.body==='string'&&typeof saved.at==='number'&&Date.now()-saved.at<7*86400000)body.value=saved.body.slice(0,1000);
    const status=el('small','muted','Your public name appears with your reply.');
    body.oninput=()=>{try{localStorage.setItem(replyDraftKey(post),JSON.stringify({body:body.value,at:Date.now()}));status.textContent='Reply draft saved on this device for 7 days.';}catch{status.textContent='Reply draft could not be saved. Keep this page open.';}};
    const send=el('button','primary',live?'Post reply':'Save preview reply');send.type='submit';form.append(label,status,send);
    form.onsubmit=async e=>{
      e.preventDefault();const text=body.value.trim();if(!text)return;
      if(live&&!user){openAuth();return;}send.disabled=true;
      try{
        const author=live?(ownProfile?.founder_name||user.user_metadata?.display_name||'Community member'):form.elements.author.value.trim();if(!author)throw Error('Please enter your name.');
        const comment={post_id:post.id,body:text,author_name:author};
        if(live)ok(await db.from('milestone_comments').insert({...comment,user_id:user.id}));
        else{preview.comments.push({...comment,id:crypto.randomUUID(),created_at:new Date().toISOString()});try{writePreview();}catch(e){preview.comments.pop();throw e;}}
        try{localStorage.removeItem(replyDraftKey(post));}catch{}
        await loadThread(thread,post);const count=post.milestone_comments?.[0];if(count)count.count+=1;
        const toggle=thread.closest('article').querySelector('.conversation-button');if(toggle)toggle.textContent=conversationLabel(post);notify(live?'Your reply is public.':'Reply saved in this browser only.');
      }catch(err){notify(err.message);send.disabled=false;}
    };thread.append(form);
  }
  function replyCard(comment,post,refresh){
    const reply=el('div','reply');reply.append(button(comment.author_name,'business-link',()=>showProfile(comment.user_id,{business:comment.author_name,author_name:comment.author_name})),el('p','',comment.body));
    const time=el('time','',date(comment.created_at));time.dateTime=comment.created_at;reply.append(time);
    if(!live||user?.id===comment.user_id)reply.append(button('Delete reply','text-button',async e=>{
      if(!confirm('Delete this reply?'))return;const b=e.currentTarget;b.disabled=true;
      try{
        if(live){const data=ok(await db.from('milestone_comments').delete().eq('id',comment.id).select('id'));if(!data?.length)throw Error('This reply could not be deleted.');}
        else{const before=structuredClone(preview);preview.comments=preview.comments.filter(c=>c.id!==comment.id);try{writePreview();}catch(e){preview=before;throw e;}}
        if(post.milestone_comments?.[0])post.milestone_comments[0].count=Math.max(0,post.milestone_comments[0].count-1);
        const toggle=reply.closest('article')?.querySelector('.conversation-button');if(toggle)toggle.textContent=conversationLabel(post);
        await refresh();
      }catch(err){notify(err.message);b.disabled=false;}
    }));
    else{reply.append(button('Report','text-button',()=>openReport({comment_id:comment.id})),button('Hide member','text-button',()=>blockMember(comment.user_id)));}
    return reply;
  }
  $('#post-form').onsubmit=async e=>{
    e.preventDefault();saveDraft();
    if(!$('#milestone-consent').checked){notify('Please give explicit publication permission before submitting for review.');return;}
    if(live&&!user){openAuth();return;}
    const data=draftPayload();fields.forEach(k=>data[k]=data[k].trim());data.publication_consent=true;if(fields.some(k=>!data[k])){notify('Please complete your business name, headline, and story.');return;}
    $('#publish').disabled=true;
    try{
      const wasEditing=Boolean(editing);
      if(live){
        if(editing){const result=ok(await db.from('milestones').update(data).eq('id',editing).eq('user_id',user.id).select('id'));if(!result?.length)throw Error('This milestone cannot be edited. It may have been deleted or belong to another account.');}
        else ok(await db.from('milestones').insert({...data,user_id:user.id,author_name:ownProfile?.founder_name||user.user_metadata?.display_name||'Community member'}));
      }else{
        const before=structuredClone(preview);
        if(editing){const p=preview.posts.find(p=>p.id===editing);if(!p)throw Error('The preview milestone no longer exists.');Object.assign(p,data,{updated_at:new Date().toISOString()});}
        else preview.posts.unshift({...data,id:crypto.randomUUID(),created_at:new Date().toISOString(),author_name:'You / Local preview'});
        try{writePreview();}catch(err){preview=before;throw err;}
      }
      resetComposer();filter='All';$('#search').value='';updateFilters();await load();$('#feed').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'auto':'smooth'});notify(live?(wasEditing?'Changes saved for publication review.':'Milestone saved privately for publication review.'):'Preview saved in this browser only.');
    }catch(err){notify('Could not save milestone: '+err.message);}finally{$('#publish').disabled=false;}
  };
  async function showProfile(id,fallback={}){
    const container=$('#profile-content');container.replaceChildren(el('p','','Loading business profile...'));$('#profile-view').showModal();
    try{
      if(live&&id&&!profiles[id]){const data=ok(await db.from('business_profiles').select('*').eq('user_id',id));if(data[0])profiles[id]=data[0];}
      const p=profiles[id];container.replaceChildren(el('span','eyebrow','BUSINESS PROFILE'),el('h2','',p?.business||fallback.business||'Community member'),el('p','',p?.founder_name||fallback.author_name||'Profile not set up yet.'),el('p','',p?.bio||'This member has not added a business description yet.'),el('small','muted','Business names and identities are self-described, not verified by FounderDNA.'));
      if(p?.website){const url=new URL(p.website);if(url.protocol==='https:'){const a=el('a','outline','Visit website ↗');a.href=url.href;a.target='_blank';a.rel='noopener noreferrer';container.append(a);}}
      if(uuid(id)){const a=el('a','primary','View all milestones →');a.href='./community.html?business='+encodeURIComponent(id);container.append(a);}
    }catch(err){container.replaceChildren(el('p','','This profile could not load.'));notify(err.message);}
  }
  $('#profile-button').onclick=()=>{
    if(!user){openAuth();return;}
    $('#profile-name').value=ownProfile?.founder_name||user.user_metadata?.display_name||'';$('#profile-business').value=ownProfile?.business||$('#business').value;$('#profile-bio').value=ownProfile?.bio||'';$('#profile-website').value=ownProfile?.website||'';$('#profile-status').textContent='';$('#blocked-list').replaceChildren();$('#profile-editor').showModal();
  };
  $('#profile-form').onsubmit=async e=>{
    e.preventDefault();if(!user||!db)return;const b=e.submitter||$('#profile-form button[type="submit"]');b.disabled=true;
    try{
      const data={business:$('#profile-business').value.trim(),founder_name:$('#profile-name').value.trim(),bio:$('#profile-bio').value.trim(),website:$('#profile-website').value.trim()};
      if(!data.business||!data.founder_name)throw Error('Please add a business name and your public name.');
      if(data.website){const url=new URL(data.website);if(url.protocol!=='https:'||url.username||url.password)throw Error('Use a website address starting with https://, without login details.');data.website=url.href;}
      const query=ownProfile?db.from('business_profiles').update(data).eq('user_id',user.id):db.from('business_profiles').insert({...data,user_id:user.id});ok(await query);
      ownProfile={...data,user_id:user.id};profiles[user.id]=ownProfile;if(!$('#business').value)$('#business').value=data.business;$('#profile-status').textContent='Your public business profile is saved.';render();
    }catch(err){$('#profile-status').textContent=err.message;}finally{b.disabled=false;}
  };
  async function blockMember(id){
    if(!user){openAuth();return;}if(!uuid(id)||id===user.id)return;
    if(!confirm('Hide this member\'s posts and replies from your view? They can still see public content.'))return;
    try{ok(await db.from('community_blocks').insert({blocker_id:user.id,blocked_id:id}));blocks.push(id);await load();await refreshInbox();notify('Member hidden. You can undo this in My business.');}catch(err){notify(err.message);}
  }
  $('#manage-blocks').onclick=async()=>{
    const container=$('#blocked-list');container.replaceChildren();if(!blocks.length){container.append(el('p','','No members hidden.'));return;}
    try{
      const data=ok(await db.from('business_profiles').select('*').in('user_id',blocks));data.forEach(p=>profiles[p.user_id]=p);
      blocks.forEach(id=>{const row=el('div','notification');row.append(el('span','',profiles[id]?.business||'Community member'),button('Unhide','text-button',async()=>{try{ok(await db.from('community_blocks').delete().eq('blocker_id',user.id).eq('blocked_id',id));blocks=blocks.filter(x=>x!==id);row.remove();await load();notify('Member is visible again.');}catch(err){notify(err.message);}}));container.append(row);});
    }catch(err){notify(err.message);}
  };
  function openReport(target){if(!user){openAuth();return;}reportTarget=target;$('#report-reason').value='';$('#report-status').textContent='';$('#report').showModal();}
  $('#report-form').onsubmit=async e=>{
    e.preventDefault();if(!user||!reportTarget)return;const b=e.submitter||$('#report-form button[type="submit"]');b.disabled=true;
    try{const reason=$('#report-reason').value.trim();if(reason.length<5)throw Error('Please describe the issue in at least 5 characters.');ok(await db.from('community_reports').insert({...reportTarget,reporter_id:user.id,reason}));$('#report').close();notify('Your report has been saved for moderator review.');}catch(err){$('#report-status').textContent=err.message;}finally{b.disabled=false;}
  };
  async function refreshInbox(){
    if(!user||!db)return;
    const id=user.id;
    try{
      const data=ok(await hideBlocked(db.from('community_notifications').select('*,milestones(headline),milestone_comments(author_name)').eq('recipient_id',id),'actor_id').order('created_at',{ascending:false}).limit(50));
      if(user?.id!==id)return;inbox=data;const unread=data.filter(n=>!n.read_at).length;$('#unread-count').textContent=unread?'('+unread+')':'';
      const container=$('#notification-list');container.replaceChildren();
      if(!data.length)container.append(el('p','','No reply notifications yet. Join a conversation or share a milestone to get started.'));
      data.forEach(n=>{const row=el('div','notification'+(!n.read_at?' unread':''));const a=el('a','',(n.milestone_comments?.author_name||'A community member')+' replied to '+(n.milestones?.headline||'a milestone'));a.href='./community.html?post='+encodeURIComponent(n.post_id);row.append(a,el('time','',date(n.created_at)));container.append(row);});
    }catch(err){if($('#inbox').open)notify('Notifications could not load: '+err.message);}
  }
  $('#inbox-button').onclick=async()=>{$('#inbox').showModal();await refreshInbox();};$('#refresh-inbox').onclick=refreshInbox;
  $('#read-inbox').onclick=async()=>{
    if(!user)return;const ids=inbox.filter(n=>!n.read_at).map(n=>n.id);if(!ids.length)return;
    try{ok(await db.from('community_notifications').update({read_at:new Date().toISOString()}).in('id',ids));await refreshInbox();}catch(err){notify(err.message);}
  };
  function updateFilters(){document.querySelectorAll('[data-filter]').forEach(b=>{const active=b.dataset.filter===filter;b.classList.toggle('selected',active);b.setAttribute('aria-pressed',String(active));});}
  document.querySelectorAll('[data-filter]').forEach(b=>b.onclick=()=>{filter=b.dataset.filter;updateFilters();load();});
  $('#search').oninput=()=>{clearTimeout(searchTimer);searchTimer=setTimeout(()=>load(),300);};$('#refresh').onclick=()=>load();$('#more').onclick=()=>load(false);
  if(!live){
    const p=readJSON(previewKey,{});if(Array.isArray(p.posts))preview.posts=p.posts.filter(p=>p&&uuid(p.id)&&typeof p.business==='string'&&typeof p.headline==='string'&&typeof p.story==='string'&&categories.includes(p.category)&&Number.isFinite(Date.parse(p.created_at)));if(Array.isArray(p.comments))preview.comments=p.comments.filter(c=>c&&uuid(c.id)&&typeof c.post_id==='string'&&typeof c.body==='string'&&typeof c.author_name==='string'&&Number.isFinite(Date.parse(c.created_at)));
    $('#connection').textContent='LOCAL PREVIEW / Posts and replies stay in this browser and are not visible to other people. Public accounts and business profiles are not connected.';$('#post-hint').textContent='Saved on this device only. This does not publish a public post.';restoreDraft();updateAccount();updateComposer();await load();return;
  }
  try{
    if(!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(config.supabaseUrl))throw Error('Invalid community service address.');
    await new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.95.3/dist/umd/supabase.js';s.onload=resolve;s.onerror=()=>reject(Error('The sign-in service could not load. Please refresh.'));document.head.append(s);});
    db=window.supabase.createClient(config.supabaseUrl,config.supabasePublishableKey);
    const result=await db.auth.getSession();
    if(result.error){notify('The sign-in link could not be used. Please request a new link.');user=null;}else user=result.data.session?.user||null;
    try{const destination=localStorage.getItem('fd-service-return');if(user&&destination&&/^(brief|requests|review|index|about|privacy|assessment|dashboard)\.html(?:\?[^#]*)?$/.test(destination)){localStorage.removeItem('fd-service-return');location.replace(new URL(destination,location.href).href);return;}}catch{}
    db.auth.onAuthStateChange((_event,session)=>{
      const next=session?.user||null;if(next?.id===user?.id)return;
      user=next;updateAccount();if(user&&$('#auth').open)$('#auth').close();
      setTimeout(async()=>{if(!user){ownProfile=null;blocks=[];inbox=[];resetComposer(true);}await identity();await load();},0);
    });
    if(location.hash.includes('access_token')||location.hash.includes('error_description'))history.replaceState(null,'',location.pathname+location.search);
    restoreDraft();await identity();
    $('#connection').hidden=true;updateAccount();updateComposer();await load();
    setInterval(()=>{if(!document.hidden&&user)refreshInbox();},60000);
  }catch(err){$('#connection').textContent='The community is temporarily unavailable. Please refresh to try again.';$('#publish').disabled=true;$('#account').disabled=true;$('#refresh').disabled=true;$('#posts').replaceChildren(el('div','empty','The public community could not load.'));notify(err.message);}
})();
