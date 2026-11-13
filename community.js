'use strict';
(async function () {
  const $ = (selector) => document.querySelector(selector);
  const config = window.FOUNDERDNA_COMMUNITY || {};
  const live = Boolean(config.supabaseUrl && config.supabasePublishableKey);
  const storageKey = 'founderdna-community-preview-v1';
  const categories = ['Launch', 'Customers', 'Product', 'Team', 'Funding', 'Learning'];
  const samples = [
    {id:'sample-1',business:'Northline Studio',category:'Launch',headline:'From side project to opening day.',story:'After six months of testing, our independent design studio is open. Three projects, a tiny team, and a lot to learn.\n\nIf you have launched a service business, what helped you find your first customers?',author_name:'Alex / Founder',created_at:'2026-11-13T09:00:00Z',sample:true},
    {id:'sample-2',business:'Goodroot',category:'Customers',headline:'Our first 50 customers. Every conversation mattered.',story:'We started with a simple idea: make it easier for small cafes to source locally. Today, 50 cafes use our directory.\n\nThe biggest lesson? Pick up the phone before building another feature.',author_name:'Sam / Co-founder',created_at:'2026-11-12T10:00:00Z',sample:true},
    {id:'sample-3',business:'Parallel Works',category:'Product',headline:'The beta is out in the world.',story:'We sent the first version of our planning tool to 12 small teams. It is early, and the feedback is already changing our roadmap.\n\nHow do you decide which feedback to act on first?',author_name:'Jordan / Builder',created_at:'2026-11-11T10:00:00Z',sample:true}
  ];
  let db, user, posts = [], filter = 'All', offset = 0, hasMore = false, loading = false;
  let preview = {posts:[],comments:[]};
  let toastTimer;
  function notify(message) { $('#toast').textContent = message; $('#toast').hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => { $('#toast').hidden = true; }, 7000); }
  function node(tag, className, text) { const n = document.createElement(tag); if (className) n.className = className; if (text !== undefined) n.textContent = text; return n; }
  function date(value) { return new Date(value).toLocaleDateString(undefined, {month:'short',day:'numeric',year:'numeric'}); }
  function savePreview() { try { localStorage.setItem(storageKey, JSON.stringify(preview)); } catch { throw new Error('Browser storage is unavailable or full. Your change was not saved.'); } }
  function readPreview() {
    try {
      const data = JSON.parse(localStorage.getItem(storageKey) || 'null');
      if (data && Array.isArray(data.posts) && Array.isArray(data.comments)) {
        preview.posts = data.posts.filter(p => p && typeof p.id === 'string' && typeof p.business === 'string' && typeof p.headline === 'string' && typeof p.story === 'string' && categories.includes(p.category) && Number.isFinite(Date.parse(p.created_at)));
        preview.comments = data.comments.filter(c => c && typeof c.id === 'string' && typeof c.post_id === 'string' && typeof c.body === 'string' && typeof c.author_name === 'string' && Number.isFinite(Date.parse(c.created_at)));
      }
    } catch { notify('Browser storage is unavailable. Preview changes may not survive a refresh.'); }
  }
  function updateAccount() { $('#account').textContent = live && user ? 'Sign out' : live ? 'Sign in' : 'Preview mode'; }
  function openAuth() { $('#auth-status').textContent = ''; $('#auth').showModal(); }
  $('#auth .close').onclick = () => $('#auth').close();
  $('#account').onclick = async () => {
    if (!live) { notify('This is a local preview. Public accounts become available when Supabase is connected.'); return; }
    if (user) { const {error} = await db.auth.signOut(); if (error) notify(error.message); else {user = null; updateAccount(); render(); notify('Signed out.');} } else openAuth();
  };
  $('#auth-form').onsubmit = async (event) => {
    event.preventDefault();
    if (!db) return;
    const button = event.submitter; button.disabled = true;
    try {
      const name = $('#display-name').value.trim(); if (!name) throw new Error('Please enter your name.');
      const {error} = await db.auth.signInWithOtp({email:$('#email').value.trim(),options:{emailRedirectTo:location.origin + location.pathname,data:{display_name:name}}});
      if (error) throw error;
      $('#auth-status').textContent = 'Check your inbox for a sign-in link. Your email stays private; your name appears with posts and replies.';
    } catch (error) { $('#auth-status').textContent = error.message; } finally { button.disabled = false; }
  };
  async function load(reset = true) {
    if (loading) return;
    loading = true; $('#refresh').disabled = true; $('#more').disabled = true;
    try {
      if (live) {
        const start = reset ? 0 : offset;
        const {data,error} = await db.from('milestones').select('*').order('created_at',{ascending:false}).order('id',{ascending:false}).range(start,start+29);
        if (error) throw error;
        posts = reset ? data : [...posts,...data.filter(p => !posts.some(old => old.id === p.id))]; offset = start + data.length; hasMore = data.length === 30;
      } else { posts = [...preview.posts,...samples].sort((a,b) => new Date(b.created_at)-new Date(a.created_at)); }
      render();
    } catch (error) { if (!posts.length) $('#posts').replaceChildren(node('div','empty','The feed could not load. Use Refresh to try again.')); notify('Could not load milestones: '+error.message); }
    finally { loading = false; $('#refresh').disabled = false; $('#more').disabled = false; }
  }
  function render() {
    const q = $('#search').value.trim().toLowerCase();
    const visible = posts.filter(p => (filter === 'All' || p.category === filter) && [p.business,p.headline,p.story].join(' ').toLowerCase().includes(q));
    $('#posts').replaceChildren(...visible.map(postCard));
    if (!visible.length) $('#posts').append(node('div','empty',posts.length ? 'No matches in the loaded milestones. Try another search or load more.' : 'Be the first to share a milestone. Every step counts.'));
    $('#more').hidden = !live || !hasMore;
  }
  function postCard(post) {
    const article = node('article','panel post');
    const top = node('div','post-top');
    const identity = node('div','post-identity'); identity.append(node('strong','',post.business));
    identity.append(node('div','post-meta',(post.sample?'Fictional example':post.author_name || 'Community member')+' · '+date(post.created_at)));
    top.append(node('div','avatar business-avatar',post.business.slice(0,2).toUpperCase()),identity,node('span','badge',post.category));
    article.append(top,node('h3','',post.headline),node('p','post-body',post.story));
    const actions = node('div','post-actions'); const toggle = node('button','conversation-button','Join the conversation ↗'); toggle.type = 'button'; toggle.setAttribute('aria-expanded','false');
    const thread = node('div','thread'); thread.hidden = true; thread.id = 'thread-'+post.id; toggle.setAttribute('aria-controls',thread.id);
    toggle.onclick = async () => { thread.hidden = !thread.hidden; toggle.setAttribute('aria-expanded',String(!thread.hidden)); if (!thread.hidden) await loadThread(thread,post); };
    actions.append(toggle);
    if (!post.sample && (!live || user?.id === post.user_id)) {
      const remove = node('button','text-button','Delete post'); remove.type = 'button';
      remove.onclick = async () => {
        if (!confirm('Delete this milestone and its replies?')) return;
        remove.disabled = true;
        try {
          if (live) { const {error} = await db.from('milestones').delete().eq('id',post.id); if (error) throw error; }
          else { const before = structuredClone(preview); preview.posts = preview.posts.filter(p => p.id !== post.id); preview.comments = preview.comments.filter(c => c.post_id !== post.id); try { savePreview(); } catch (e) { preview = before; throw e; } }
          await load(); notify('Milestone deleted.');
        } catch (error) { notify(error.message); remove.disabled = false; }
      }; actions.append(remove);
    }
    article.append(actions,thread); return article;
  }
  async function loadThread(thread,post) {
    thread.replaceChildren(node('p','','Loading conversation...'));
    try {
      let comments;
      if (live) { const {data,error} = await db.from('milestone_comments').select('*').eq('post_id',post.id).order('created_at',{ascending:true}).limit(200); if (error) throw error; comments = data; }
      else comments = preview.comments.filter(c => c.post_id === post.id);
      thread.replaceChildren();
      if (!comments.length) thread.append(node('p','','No replies yet. Start the conversation.'));
      if (comments.length === 200) thread.append(node('p','','Showing the first 200 replies.'));
      for (const comment of comments) {
        const reply = node('div','reply'); reply.append(node('strong','',comment.author_name),node('p','',comment.body));
        const time = node('time','',date(comment.created_at)); time.dateTime = comment.created_at; reply.append(time);
        if (!live || user?.id === comment.user_id) {
          const remove = node('button','text-button','Delete reply'); remove.type = 'button'; remove.onclick = async () => {
            remove.disabled = true;
            try {
              if (live) { const {error} = await db.from('milestone_comments').delete().eq('id',comment.id); if (error) throw error; }
              else { const before = structuredClone(preview); preview.comments = preview.comments.filter(c => c.id !== comment.id); try { savePreview(); } catch(e) { preview = before; throw e; } }
              await loadThread(thread,post);
            } catch(error) { notify(error.message); remove.disabled = false; }
          }; reply.append(remove);
        }
        thread.append(reply);
      }
      if (live && !user) { const signIn = node('button','outline','Sign in to reply'); signIn.type = 'button'; signIn.onclick = openAuth; thread.append(signIn); return; }
      const form = node('form','reply-form');
      if (!live) { const label = node('label','','Your name'); const input = node('input'); input.name = 'author'; input.required = true; input.maxLength = 60; input.autocomplete = 'name'; label.append(input); form.append(label); }
      const label = node('label','',live ? 'Add to the conversation' : 'Try a reply (saved only in this browser)');
      const body = node('textarea'); body.required = true; body.maxLength = 1000; body.name = 'body'; body.rows = 2; label.append(body);
      const send = node('button','primary',live?'Post reply':'Save preview reply'); send.type = 'submit'; form.append(label,send);
      form.onsubmit = async (event) => {
        event.preventDefault(); const text = body.value.trim(); if (!text) {body.focus(); return;} send.disabled = true;
        try {
          const author = live ? (user.user_metadata?.display_name || 'Community member') : form.elements.author.value.trim(); if (!author) throw new Error('Please enter your name.');
          const comment = {post_id:post.id,body:text,author_name:author};
          if (live) { const {error} = await db.from('milestone_comments').insert({...comment,user_id:user.id}); if (error) throw error; }
          else { preview.comments.push({...comment,id:crypto.randomUUID(),created_at:new Date().toISOString()}); try {savePreview();} catch(e) {preview.comments.pop(); throw e;} }
          await loadThread(thread,post); notify(live?'Reply posted.':'Preview reply saved in this browser only.');
        } catch(error) { notify(error.message); send.disabled = false; }
      }; thread.append(form);
    } catch(error) { thread.replaceChildren(node('p','','Could not load replies. Close and reopen the conversation to retry.')); notify(error.message); }
  }
  $('#post-form').onsubmit = async (event) => {
    event.preventDefault();
    if (live && !user) {openAuth(); return;}
    const post = {business:$('#business').value.trim(),category:$('#category').value,headline:$('#headline').value.trim(),story:$('#story').value.trim()};
    if (!post.business || !post.headline || !post.story) { notify('Please complete your business name, headline, and story.'); return; }
    $('#publish').disabled = true;
    try {
      if (live) { const {error} = await db.from('milestones').insert({...post,user_id:user.id,author_name:user.user_metadata?.display_name || 'Community member'}); if (error) throw error; }
      else { preview.posts.unshift({...post,id:crypto.randomUUID(),created_at:new Date().toISOString(),author_name:'You / Local preview'}); try {savePreview();} catch(e) {preview.posts.shift(); throw e;} }
      $('#headline').value = ''; $('#story').value = ''; filter = 'All'; $('#search').value = ''; updateFilters(); await load(); $('#feed').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'auto':'smooth'}); notify(live?'Your milestone is now public.':'Preview milestone saved in this browser only.');
    } catch(error) { notify('Could not save milestone: '+error.message); } finally { $('#publish').disabled = false; }
  };
  function updateFilters() { document.querySelectorAll('[data-filter]').forEach(b => {b.classList.toggle('selected',b.dataset.filter === filter); b.setAttribute('aria-pressed',String(b.dataset.filter === filter));}); }
  document.querySelectorAll('[data-filter]').forEach(b => {b.onclick = () => {filter = b.dataset.filter; updateFilters(); render();};});
  $('#search').oninput = render; $('#refresh').onclick = () => load(); $('#more').onclick = () => load(false);
  if (!live) {
    readPreview(); $('#connection').textContent = 'LOCAL PREVIEW / Example businesses are fictional. Your posts and replies stay in this browser and are not visible to other people. Public posting and sign-in are not connected yet.';
    $('#publish').textContent = 'Save preview milestone ↗'; $('#post-hint').textContent = 'Saved on this device only. This does not publish a public post.'; updateAccount(); await load(); return;
  }
  try {
    if (!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(config.supabaseUrl)) throw new Error('Check the Supabase project URL in community-config.js.');
    await new Promise((resolve,reject) => {const script = document.createElement('script'); script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.95.3/dist/umd/supabase.js'; script.onload = resolve; script.onerror = () => reject(new Error('The sign-in service could not load. Please refresh.')); document.head.append(script);});
    db = window.supabase.createClient(config.supabaseUrl,config.supabasePublishableKey);
    const {data,error} = await db.auth.getSession(); if (error) throw error; user = data.session?.user || null;
    db.auth.onAuthStateChange((_event,session) => {user = session?.user || null; updateAccount(); if (user && $('#auth').open) $('#auth').close();});
    // The SDK consumes the email link before the token fragment is removed.
    if (location.hash.includes('access_token') || location.hash.includes('error_description')) history.replaceState(null,'',location.pathname+location.search);
    $('#connection').textContent = 'PUBLIC COMMUNITY / Milestones and replies are visible to everyone. Sign in to post. Your email address is never shown.'; $('#connection').classList.add('live'); updateAccount(); await load();
  } catch(error) {
    $('#connection').textContent = 'Community connection unavailable: '+error.message; $('#publish').disabled = true; $('#account').disabled = true; $('#refresh').disabled = true; $('#posts').replaceChildren(node('div','empty','The public community is temporarily unavailable. Please try again later.'));
  }
})();
