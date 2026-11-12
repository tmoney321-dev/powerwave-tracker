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
  el.querySelector('#lin').onclick=async()=>{const [e,p]=v();const {error}=await sb.auth.signInWithPassword({email:e,password:p});if(error)say(error.message);else{currentPw=p;start().then(resolve)}};
  el.querySelector('#lup').onclick=async()=>{const [e,p]=v();if(p.length<10)return say('Choose a password of 10+ characters.');const {error}=await sb.auth.signUp({email:e,password:p});say(error?error.message:'Account requested. Confirm your email if asked, then an admin must approve you.')};
  el.querySelector('#lfg').onclick=async()=>{const [e]=v();const {error}=await sb.auth.resetPasswordForEmail(e,{redirectTo:location.href.split('#')[0]});say(error?error.message:'Reset email sent.')};}
 let currentPw=null;
 function needsNewPassword(user){return !!(user&&user.user_metadata&&user.user_metadata.must_change_password===true)}
 function showSetPassword(resolve){const el=lg();el.hidden=false;el.innerHTML=`<div class="lbox"><h2>Set a new password</h2>
  <p class="s">You must choose a new password before continuing. Use at least 8 characters, and don't reuse your current password.</p>
  <input id="np1" type="password" placeholder="New password" autocomplete="new-password">
  <input id="np2" type="password" placeholder="Confirm new password" autocomplete="new-password">
  <div class="row"><button id="nsave">Save and continue</button><button class="sec" id="lout">Sign out</button></div>
  <p class="s" id="lmsg"></p></div>`;
  const say=t=>el.querySelector('#lmsg').textContent=t;
  el.querySelector('#lout').onclick=signOut;
  const save=async()=>{const a=el.querySelector('#np1').value,b=el.querySelector('#np2').value;
   if(a.length<8)return say('Use at least 8 characters.');
   if(a!==b)return say('The two passwords do not match.');
   if(currentPw!=null&&a===currentPw)return say('Choose a different password from your current one.');
   const {error}=await sb.auth.updateUser({password:a,data:{must_change_password:false}});
   if(error)return say(error.message);
   currentPw=null;start().then(resolve)};
  el.querySelector('#nsave').onclick=save;
  el.querySelectorAll('#np1,#np2').forEach(i=>i.addEventListener('keydown',e=>{if(e.key==='Enter')save()}));}
 async function start(){
  if(!live){if(C.LOCAL_DEV){role='admin';email='local-dev';document.getElementById('banner').innerHTML='<div class="warn">LOCAL DEV MODE: no login, data read from ./data/site_data.json. Never host this build.</div>';
    const r=await fetch('data/site_data.json',{cache:'no-store'});return r.json()}
   lg().hidden=false;lg().innerHTML='<div class="lbox"><h2>Not configured</h2><p>Set SUPABASE_URL and SUPABASE_ANON_KEY in config.js.</p></div>';return new Promise(()=>{})}
  const {data:{session}}=await sb.auth.getSession();
  if(!session)return new Promise(res=>showLogin('',res));
  email=session.user.email;
  let user=session.user;
  try{const r=await sb.auth.getUser();if(r.data&&r.data.user)user=r.data.user}catch(e){}
  if(needsNewPassword(user))return new Promise(res=>showSetPassword(res));
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
 /* Short-lived signed URL for a PDF in the PRIVATE 'order-pdfs' bucket (storage RLS: admin SELECT only — PDFs contain prices). */
 async function pdfUrl(name){if(role!=='admin')throw new Error('PDFs are admin-only');const {data,error}=await sb.storage.from('order-pdfs').createSignedUrl(name,600);if(error)throw error;return data.signedUrl}
 async function certUrl(path){const {data,error}=await sb.functions.invoke('cert-url',{body:{path}});if(error){let m=error.message;try{m=(await error.context.json()).error||m}catch(e){}throw new Error(m)}if(data&&data.error)throw new Error(data.error);if(!data||!data.url)throw new Error('No cert URL');return data.url}
 /* Person colors (table person_colors: authenticated read, admin write) */
 async function colors(){if(!sb)return [];const {data,error}=await sb.from('person_colors').select('name,color,aliases').order('name');if(error)throw error;return data||[]}
 async function saveColor(row){const {error}=await sb.from('person_colors').upsert({...row,updated_at:new Date().toISOString()});if(error)throw error}
 async function delColor(name){const {error}=await sb.from('person_colors').delete().eq('name',name);if(error)throw error}
 /* Order PDF index straight from the bucket (so new uploads show without a data rebuild); admin upload (storage RLS: admin insert/update). */
 async function pdfList(){if(!sb)return null;const out=[];for(let off=0;;off+=1000){const {data,error}=await sb.storage.from('order-pdfs').list('',{limit:1000,offset:off,sortBy:{column:'name',order:'asc'}});if(error)throw error;out.push(...data.filter(f=>f.id));if(data.length<1000)break}return out}
 async function pdfUpload(name,file,overwrite){const {error}=await sb.storage.from('order-pdfs').upload(name,file,{contentType:'application/pdf',upsert:!!overwrite});if(error)throw error}
 /* Admin-only rental spend (table public.admin_spend; RLS: my_role()='admin'). Never stored in site_data. */
 async function adminSpend(){
  if(!live){if(C.LOCAL_DEV){try{const r=await fetch('data/admin_spend.json',{cache:'no-store'});if(r.ok)return r.json()}catch(e){}return null}
   return null}
  if(role!=='admin')return null;
  const {data,error}=await sb.from('admin_spend').select('data,built_at').eq('id','current').maybeSingle();
  if(error)throw error;return data?data.data:null}
 return {start,signOut,admin,changePw,pdfUrl,certUrl,colors,saveColor,delColor,pdfList,pdfUpload,adminSpend,get live(){return live},get role(){return role},get email(){return email},get isAdmin(){return role==='admin'}};
})();
