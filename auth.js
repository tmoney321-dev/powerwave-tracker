'use strict';
/* Auth layer: Supabase email+password, roles in public.profiles (admin/user/pending), enforced by RLS server-side.
   Data comes from table public.site_data (row id='current'), readable only by admin/user. */
const Auth=(()=>{
 const C=window.PW_CONFIG||{};const live=!!(C.SUPABASE_URL&&C.SUPABASE_ANON_KEY);
 const sb=live?window.supabase.createClient(C.SUPABASE_URL,C.SUPABASE_ANON_KEY,{auth:{persistSession:true,autoRefreshToken:true,storageKey:'pws-auth'}}):null;
 let role=null,email=null,name=null;
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const lg=()=>document.getElementById('login');
 function loginHTML(msg){return `<div class="lbox"><h2>Powerwave Services Tracker</h2><p class="s">Company data - sign in to continue.</p>
  <input id="le" type="email" placeholder="Email" autocomplete="username"><input id="lp" type="password" placeholder="Password" autocomplete="current-password">
  <div class="row"><button id="lin">Sign in</button><button class="sec" id="lup">Request access</button><button class="sec" id="lfg">Forgot password</button></div><p class="s" id="lmsg">${esc(msg||'')}</p></div>`}
 function showLogin(msg,resolve){const el=lg();el.hidden=false;el.innerHTML=loginHTML(msg);const v=()=>[el.querySelector('#le').value.trim(),el.querySelector('#lp').value];
  const say=t=>el.querySelector('#lmsg').textContent=t;
  el.querySelector('#lin').onclick=async()=>{const [e,p]=v();const {error}=await sb.auth.signInWithPassword({email:e,password:p});if(error)say(error.message);else start().then(resolve)};
  el.querySelector('#lup').onclick=async()=>{const [e,p]=v();if(p.length<10)return say('Choose a password of 10+ characters.');const {error}=await sb.auth.signUp({email:e,password:p});say(error?error.message:'Account requested. Confirm your email if asked, then an admin must approve you.')};
  el.querySelector('#lfg').onclick=async()=>{const [e]=v();const {error}=await sb.auth.resetPasswordForEmail(e,{redirectTo:location.href.split('#')[0]});say(error?error.message:'Reset email sent.')};}
 async function start(){
  if(!live){if(C.LOCAL_DEV){role='admin';email='local-dev';document.getElementById('banner').innerHTML='<div class="warn">LOCAL DEV MODE: no login, data read from ./data/site_data.json. Never host this build.</div>';
    const r=await fetch('data/site_data.json',{cache:'no-store'});return r.json()}
   lg().hidden=false;lg().innerHTML='<div class="lbox"><h2>Not configured</h2><p>Set SUPABASE_URL and SUPABASE_ANON_KEY in config.js.</p></div>';return new Promise(()=>{})}
  const {data:{session}}=await sb.auth.getSession();
  if(!session)return new Promise(res=>showLogin('',res));
  email=session.user.email;
  const {data:p}=await sb.from('profiles').select('role,name').eq('id',session.user.id).maybeSingle();role=p?p.role:'pending';name=p&&p.name;
  if(role!=='admin'&&role!=='user'){lg().hidden=false;lg().innerHTML=`<div class="lbox"><h2>Waiting for approval</h2><p>Signed in as <b>${esc(email)}</b>. An admin must approve your account before you can see any data.</p><div class="row"><button id="lchk">Check again</button><button class="sec" id="lout">Sign out</button></div></div>`;
   return new Promise(res=>{lg().querySelector('#lchk').onclick=()=>start().then(res);lg().querySelector('#lout').onclick=signOut})}
  const {data,error}=await sb.from('site_data').select('data,built_at').eq('id','current').maybeSingle();
  if(error||!data){lg().hidden=false;lg().innerHTML=`<div class="lbox"><h2>No data</h2><p>${esc(error?error.message:'Nothing published yet (run publish_data.py).')}</p></div>`;return new Promise(()=>{})}
  lg().hidden=true;return data.data}
 async function signOut(){if(sb)await sb.auth.signOut();location.reload()}
 /* Admin actions go through the admin-users Edge Function (service role stays server-side; it re-checks admin role). */
 async function admin(action,body={}){const {data,error}=await sb.functions.invoke('admin-users',{body:{action,...body}});
  if(error){let m=error.message;try{m=(await error.context.json()).error||m}catch(e){}throw new Error(m)}if(data&&data.error)throw new Error(data.error);return data}
 async function changePw(p){if(p.length<10)throw new Error('Password must be 10+ characters');const {error}=await sb.auth.updateUser({password:p});if(error)throw error}
 return {start,signOut,admin,changePw,get live(){return live},get role(){return role},get email(){return email},get isAdmin(){return role==='admin'}};
})();
