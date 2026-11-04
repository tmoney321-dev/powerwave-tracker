'use strict';
/* Powerwave Services tracker - one-stop searchable view of all tracker data. Data shape: see build_data.py. */
let D=null;const app=document.getElementById('app');
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const TODAY=()=>{const d=new Date();d.setHours(0,0,0,0);return d};
const pd=s=>{const m=/^(\d{4})-(\d\d)-(\d\d)/.exec(s||'');return m?new Date(+m[1],m[2]-1,+m[3]):null};
const days=(a,b)=>Math.round((b-a)/864e5);
const usd=n=>n==null||isNaN(n)?'':'$'+n.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
const fmtD=s=>{const d=pd(s);return d?`${d.getMonth()+1}/${d.getDate()}/${d.getFullYear()}`:esc(s||'')};
const TAGC={JAN:'jan',MAY:'may',SEP:'sep'};
const tagHTML=t=>t?`<span class="ctag ${TAGC[t]||''}">${t==='JAN'?'JAN · red':t==='MAY'?'MAY · blue':'SEP · green'}</span>`:'';
const pathHTML=p=>p?`<span class="path" title="Dropbox/box path">${esc(p)}</span>`:'';

/* ---------- rental math (live from today) ---------- */
function rentalCalc(r){const out=pd(r['Out date']);const end=pd(r['Return/close date'])||(String(r.Status).startsWith('ON RENT')?TODAY():null);
 const d=out&&end?Math.max(1,days(out,end)):null;/* cheaper of daily×days or months×monthly+partial days */let spent=null,basis=r['Price basis'];
 if(r.Invoiced!=null)spent=r.Invoiced;
 else if(r['Net daily']!=null&&d!=null){const dl=r['Net daily'],mo=r['Net monthly']||dl*20;spent=Math.floor(d/28)*mo+Math.min((d%28)*dl,mo)}
 else if(r['Net daily']!=null)basis='rate known, return date unknown';
 return {days:d,spent,basis}}

/* ---------- generic searchable / filterable / sortable table ---------- */
const state={};
function tableView(key,rows,cols,opt={}){
 const st=state[key]||(state[key]={q:'',f:{},sort:opt.sort||null,dir:opt.dir||1});
 const id='t_'+key;const wrap=document.createElement('section');wrap.className='tv';
 const filt=(opt.filters||[]).map(c=>{const vals=[...new Set(rows.map(r=>String(colVal(r,c)??'')).filter(Boolean))].sort(Combo.numCmp);
  return `<label class="fl"><span>${esc(c.label||c.k)}</span><select data-f="${esc(c.k)}"><option value="">All</option>${vals.map(v=>`<option ${st.f[c.k]===v?'selected':''}>${esc(v)}</option>`).join('')}</select></label>`}).join('');
 wrap.innerHTML=`${opt.title?`<h2>${esc(opt.title)}</h2>`:''}${opt.note?`<p class="s">${opt.note}</p>`:''}
  <div class="bar"><input type="search" class="q" placeholder="Search ${esc(opt.what||'rows')}…" value="${esc(st.q)}">${filt}<button class="sec csv">Export CSV</button><span class="cnt"></span></div><div class="tw"></div>`;
 const tw=wrap.querySelector('.tw'),cnt=wrap.querySelector('.cnt');
 function cur(){const terms=st.q.toLowerCase().split(/\s+/).filter(Boolean);
  let r=rows.filter(x=>Object.entries(st.f).every(([k,v])=>!v||String(colVal(x,cols.find(c=>c.k===k)||{k}))===v));
  if(terms.length)r=r.filter(x=>{const t=cols.map(c=>colText(x,c)).join(' ').toLowerCase()+' '+JSON.stringify(x).toLowerCase();return terms.every(w=>t.includes(w))});
  if(st.sort){const c=cols.find(c=>c.k===st.sort);if(c)r=[...r].sort((a,b)=>{const A=colVal(a,c),B=colVal(b,c);if(A===B)return 0;if(A==null||A==='')return 1;if(B==null||B==='')return -1;
   return (typeof A==='number'&&typeof B==='number'?A-B:Combo.numCmp(A,B))*st.dir})}
  return r}
 function draw(){const r=cur();cnt.textContent=`${r.length} of ${rows.length}`;
  tw.innerHTML=`<table><thead><tr>${cols.map(c=>`<th data-k="${esc(c.k)}" class="${st.sort===c.k?(st.dir>0?'asc':'desc'):''}">${esc(c.label||c.k)}</th>`).join('')}</tr></thead>
  <tbody>${r.map(x=>`<tr class="${opt.rowClass?opt.rowClass(x):''}">${cols.map(c=>`<td data-l="${esc(c.label||c.k)}">${c.html?c.html(x):esc(colVal(x,c))}</td>`).join('')}</tr>`).join('')||`<tr><td colspan="${cols.length}" class="s">No matches</td></tr>`}</tbody></table>`;
  tw.querySelectorAll('th').forEach(th=>th.onclick=()=>{const k=th.dataset.k;if(st.sort===k)st.dir*=-1;else{st.sort=k;st.dir=1}draw()})}
 wrap.querySelector('.q').oninput=e=>{st.q=e.target.value;draw()};
 wrap.querySelectorAll('select[data-f]').forEach(s=>s.onchange=()=>{st.f[s.dataset.f]=s.value;draw()});
 wrap.querySelector('.csv').onclick=()=>csv(key,cur(),cols);
 draw();return wrap}
const colVal=(x,c)=>c.v?c.v(x):x[c.k];
const colText=(x,c)=>{const v=colVal(x,c);return v==null?'':String(v)};
function csv(name,rows,cols){const q=v=>{v=v==null?'':Array.isArray(v)?v.join(' | '):String(v);return /[",\n]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v};
 const t=[cols.map(c=>q(c.label||c.k)).join(','),...rows.map(r=>cols.map(c=>q(colVal(r,c))).join(','))].join('\n');
 const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([t],{type:'text/csv'}));a.download=`powerwave_${name}_${new Date().toISOString().slice(0,10)}.csv`;a.click()}
const autoCols=rows=>{const ks=[];rows.forEach(r=>Object.keys(r).forEach(k=>{if(!ks.includes(k))ks.push(k)}));return ks.map(k=>({k}))};

/* ---------- tabs ---------- */
const TABS=[['rentals','Live Rentals'],['equipment','Equipment'],['tech','Tech Assignments'],['certsneeded','Certs Needed'],
 ['orders','Intellirent Orders'],['orderlist','Order List'],['search','Global Search'],['sources','Sources & Gaps'],['users','Users'],['account','Account']];
let tab=(location.hash||'#rentals').slice(1);
function nav(){document.getElementById('tabs').innerHTML=TABS.filter(([k])=>k!=='users'||Auth.isAdmin).filter(([k])=>k!=='account'||Auth.live)
 .map(([k,l])=>`<button role="tab" class="${k===tab?'on':''}" data-t="${k}">${l}</button>`).join('');
 document.querySelectorAll('#tabs button').forEach(b=>b.onclick=()=>{tab=b.dataset.t;location.hash=tab;render()})}
function render(){nav();app.innerHTML='';(V[tab]||V.rentals)();Combo.scan();window.scrollTo(0,0)}
const fmtT=t=>t?new Date(t).toLocaleString('en-US',{timeZone:'America/Chicago',dateStyle:'short',timeStyle:'short'})+' CT':'n/a';
const stamp=src=>{const s=(D.sources||[]).find(x=>x.Source.startsWith(src));if(!s)return '';const t=s.dropbox_modified||s.file_modified||s.fetched||'';
 return `<span class="stamp"><b>${esc(s.Source)}</b>: ${s.present===false?'not present yet':'updated '+fmtT(t)}</span>`};
const head=(h,src)=>{const d=document.createElement('div');d.innerHTML=`<h1>${h}</h1>${src.map(stamp).join('')}<span class="stamp">Site data built ${fmtT(D.built)}</span>`;app.append(d)};

const dueInfo=e=>{const d=pd(e['Due date']);if(!d)return {k:'nodate',t:'no due date',n:null};const n=days(TODAY(),d);
 return n<0?{k:'over',t:`OVERDUE ${-n}d`,n}:n<=30?{k:'soon',t:`due in ${n}d`,n}:{k:'ok',t:`${n}d left`,n}};

const V={
 rentals(){head('Live Rental Tracker',['Intellirent rental history','Intellirent Asset list','Cal tracker','Order PDFs','Outlook pricing']);
  const R=D.rentals.map(r=>({...r,_c:rentalCalc(r)}));const on=R.filter(r=>String(r.Status).startsWith('ON RENT'));
  const spentOn=on.reduce((a,r)=>a+(r._c.spent||0),0),unk=on.filter(r=>r._c.spent==null);
  const longest=on.filter(r=>r._c.days!=null).sort((a,b)=>b._c.days-a._c.days)[0];
  const unpricedOrders=[...new Set(unk.map(r=>r.Order))];
  const now=TODAY(),yr=String(now.getFullYear()),ym=yr+'-'+String(now.getMonth()+1).padStart(2,'0');
  const tot=f=>{let a=0,e=0;R.forEach(r=>{if(!f(r)||r._c.spent==null)return;a+=r._c.spent;if(r['Spend kind']!=='actual')e+=r._c.spent});return {a,e}};
  const kp=(t,lbl)=>`<div class="kpi"><b>${usd(t.a)}</b><span>${lbl}${t.e?` (incl. ${usd(t.e)} estimated)`:' (actual invoiced)'}</span></div>`;
  const mo=r=>String(r['Out date']||'');
  const k=document.createElement('div');k.className='kpis';k.innerHTML=`
   ${kp(tot(()=>true),'spent all-time')}
   ${kp(tot(r=>mo(r).startsWith(yr)),'spent in '+yr)}
   ${kp(tot(r=>mo(r).startsWith(ym)),'spent this month (went out '+ym+')')}
   <div class="kpi"><b>${on.length}</b><span>items on rent now · ${usd(spentOn)} accrued so far (estimate, pre-tax; ${unk.length} price unknown)</span></div>
   <div class="kpi"><b>${longest?longest._c.days+' days':'-'}</b><span>longest out${longest?': '+esc(longest.Item)+' ('+esc(longest.Order)+')':''}</span></div>
   <div class="kpi warnk"><b>${unpricedOrders.length}</b><span>on-rent orders with price unknown: ${esc(unpricedOrders.join(', '))}</span></div>`;app.append(k);
  const st=state.rentals||(state.rentals={q:'',f:{Status:''},sort:'days',dir:-1});
  app.append(tableView('rentals',R,[
   {k:'Status',html:r=>`<span class="pill ${String(r.Status).startsWith('ON RENT')?'red':r.Status==='RETURNED'?'green':'amber'}">${esc(r.Status)}</span>`},
   {k:'Item',html:r=>`<b>${esc(r.Item)}</b>${r.Barcode?`<div class="s">${esc(r.Barcode)}${r.Serial?' · S/N '+esc(r.Serial):''}</div>`:''}`},
   {k:'Who (ordered by)',label:'Who'},{k:'Where (ship to / job)',label:'Where',v:r=>r['Where (ship to / job)']||(r['Intellirent facility']?'Intellirent '+r['Intellirent facility']:'')},
   {k:'Out date',label:'Went out',html:r=>`${fmtD(r['Out date'])}${r['Date basis']==='order'?' <span class="s">(order date)</span>':''}`},
   {k:'days',label:'Days out',v:r=>r._c.days},
   {k:'Return/close date',label:'Returned',html:r=>fmtD(r['Return/close date'])},
   {k:'Billed through',label:'Billed thru',html:r=>fmtD(r['Billed through'])},{k:'Job'},{k:'PO'},{k:'Type'},
   {k:'rate',label:'Rate (net)',v:r=>r['Net daily']!=null?`${usd(r['Net daily'])}/day · ${usd(r['Net monthly'])}/mo`:''},
   {k:'spent',label:'Spent so far',v:r=>r._c.spent,html:r=>r._c.spent!=null?`<b>${usd(r._c.spent)}</b><div class="s">${esc(r._c.basis)}</div>`:`<span class="unk">price unknown</span><div class="s">${esc(r._c.basis)}</div>`},
   {k:'Order',html:r=>`<b>${esc(r.Order)}</b>${r.PDF?pathHTML(r.PDF):'<div class="s">no PDF on file</div>'}`},
   {k:'Intellirent facility',label:'IR facility'}],
   {what:'rentals (item, tech, order, serial…)',filters:[{k:'Status'},{k:'Who (ordered by)',label:'Who'},{k:'Job'},{k:'Spend kind',label:'Actual/estimate'},{k:'Type'},{k:'Order'}],
    sort:'days',dir:-1,rowClass:r=>String(r.Status).startsWith('ON RENT')?'r-on':'',
    note:'<b>Primary source: Intellirent rental history</b> (actual invoiced $, return dates, placed by, ship to, job, PO, billed through). Lines from that report are <b>actual</b>; carried-over-only lines may be partial. ON RENT = in Intellirent\'s 11/4 asset list (or an unidentified item on an open board order); those, and any line without an invoiced amount, are <b>ESTIMATES</b>: net rate from the latest order email (else order PDF), cheaper of net daily × days or 28-day months × net monthly + leftover days, pre-tax, live to today. No rate on file = "price unknown" (never guessed). Monthly/yearly totals are by the date the item went out.'}));
  const SS=D.spend_summary||{};const sc=[{k:'Key',label:'Group'},{k:'Invoiced',v:r=>r.Invoiced,html:r=>`<b>${usd(r.Invoiced)}</b>`},{k:'Orders'},{k:'Lines'}];
  [['by_job','Spend by job / facility (actual invoiced)'],['by_person','Spend by person who placed the order (actual invoiced)'],['by_month','Spend by month the item went out (actual invoiced)']].forEach(([key,t])=>{
   if(SS[key]&&SS[key].length)app.append(tableView('ss_'+key,SS[key],sc,{title:t,what:'groups',sort:key==='by_month'?'Key':'Invoiced',dir:-1}))});
  if(D.quotes&&D.quotes.length)app.append(tableView('quotes',D.quotes,autoCols(D.quotes),{title:'Quotes (not spend)',what:'quotes'}));
 },
 equipment(){head('Owned Equipment',['Cal tracker']);
  const E=D.equipment.map(e=>({...e,_d:dueInfo(e)}));
  const k=document.createElement('div');k.className='kpis';const c=f=>E.filter(f).length;
  k.innerHTML=`<div class="kpi"><b>${E.length}</b><span>units</span></div><div class="kpi warnk"><b>${c(e=>e.Status==='MISSING')}</b><span>MISSING (not confirmed)</span></div>
   <div class="kpi warnk"><b>${c(e=>e._d.k==='over')}</b><span>overdue</span></div><div class="kpi"><b>${c(e=>e._d.k==='soon')}</b><span>due ≤30 days</span></div>
   <div class="kpi"><span>Cal tags: ${tagHTML('JAN')} ${tagHTML('MAY')} ${tagHTML('SEP')}</span></div>`;app.append(k);
  app.append(tableView('equipment',E,[
   {k:'Status',html:e=>`<span class="pill ${e.Status==='MISSING'?'red':'green'}">${e.Status}</span>`},
   {k:'Unit',html:e=>`<b>${esc(e.Unit)}</b>`},{k:'Model'},{k:'Serial'},{k:'Holder'},
   {k:'Cal date',html:e=>fmtD(e['Cal date'])},{k:'Due date',v:e=>e['Due date'],html:e=>`<span class="due ${e._d.k}">${fmtD(e['Due date'])}<br><small>${e._d.t}</small></span>`},
   {k:'due',label:'Due status',v:e=>({over:'Overdue',soon:'Due soon',ok:'OK',nodate:'No date'})[e._d.k]},
   {k:'Cal tag',html:e=>tagHTML(e['Cal tag'])},{k:'AirTag'},
   {k:'Intellirent facility',label:'At Intellirent',v:e=>[e['Intellirent facility'],e['Intellirent last order']].filter(Boolean).join(' · ')},
   {k:'Certs',label:'Cert file(s)',v:e=>e.Certs.join(' | '),html:e=>e.Certs.length?e.Certs.map(pathHTML).join(''):'<span class="unk">no cert found</span>'},
   {k:'Notes',html:e=>`<div class="note">${esc(e.Notes)}</div>`}],
   {what:'equipment (unit, serial, holder, notes…)',filters:[{k:'Status'},{k:'Holder'},{k:'due',label:'Due status',v:e=>({over:'Overdue',soon:'Due soon',ok:'OK',nodate:'No date'})[e._d.k]},{k:'Cal tag'}],
    rowClass:e=>(e.Status==='MISSING'?'r-miss ':'')+'tag-'+(TAGC[e['Cal tag']]||''),
    note:'Rule: equipment is <b>MISSING unless confirmed</b> by a named holder in the tracker. Due color: red = overdue, amber = due within 30 days, green = OK.'}));
 },
 tech(){head('Tech Assignments',['Cal tracker']);
  app.append(tableView('tech',D.tech,[{k:'Technician'},{k:'Category'},{k:'Unit'},{k:'Cal tag',html:r=>tagHTML(r['Cal tag'])},{k:'Item / note',html:r=>`<div class="note">${esc(r['Item / note'])}</div>`}],
   {title:'Equipment Distribution',what:'assignments',filters:[{k:'Technician'},{k:'Category'},{k:'Cal tag'}],rowClass:r=>'tag-'+(TAGC[r['Cal tag']]||'')}));
  app.append(tableView('replies',D.tech_replies,autoCols(D.tech_replies).map(c=>({...c,html:r=>`<div class="note">${esc(r[c.k])}</div>`})),{title:'Tech Replies',what:'replies',filters:[{k:'Replied (Y/N)'}]}));
  if(D.roster.length)app.append(tableView('roster',D.roster,autoCols(D.roster),{title:'Employee roster (Sheet1 side list)',what:'employees'}));
 },
 certsneeded(){head('Certs Needed',['Cal tracker']);
  app.append(tableView('cn',D.certs_needed,autoCols(D.certs_needed).map(c=>({...c,html:r=>/date|due|cal/i.test(c.k)?fmtD(r[c.k]):`<div class="note">${esc(r[c.k])}</div>`})),
   {what:'certs needed',filters:[{k:'Category'},{k:'Who has it'}],rowClass:r=>/EXPIRED/i.test(r.Category)?'r-miss':/DONE/i.test(r.Category)?'r-ok':''}));
 },
 orders(){head('Intellirent Orders',['Cal tracker','PowerWave Order List','Order PDFs','Intellirent Order list']);
  app.append(tableView('orders',D.orders,[{k:'Order',html:o=>`<b>${esc(o.Order)}</b>${o.Board?`<span class="pill amber">${esc(o.Board)}</span>`:''}`},{k:'Type'},{k:'Ordered by'},
   {k:'Order date',html:o=>fmtD(o['Order date'])},{k:'Ship date',html:o=>fmtD(o['Ship date'])},{k:'Status'},{k:'Status date',html:o=>fmtD(o['Status date'])},
   {k:'Intellirent facility',label:'IR facility'},{k:'Ship to'},{k:'Assets'},{k:'Items',html:o=>`<div class="note">${esc(o.Items)}</div>`},
   {k:'Daily total',label:'Net/day',html:o=>usd(o['Daily total'])},{k:'Monthly total',label:'Net/mo',html:o=>usd(o['Monthly total'])},
   {k:'Email lines',label:'Email order lines (latest)',html:o=>`<div class="note">${esc(o['Email lines']||'')}</div>`},{k:'Invoice total',label:'Invoice',html:o=>usd(o['Invoice total'])||usd(o['Sale/misc total'])},{k:'PDF',html:o=>o.PDF?pathHTML(o.PDF):'<span class="s">none</span>'},{k:'Note'}],
   {what:'orders',filters:[{k:'Type'},{k:'Status'},{k:'Board'},{k:'Ordered by'}],sort:'Order date',dir:-1,note:'Merged from the cal tracker\'s Intellirent Orders board (11/4), PowerWave Order List.xlsx, the Intellirent Order list CSV and order PDFs.'}));
 },
 orderlist(){head('Order List & Board (raw)',['PowerWave Order List','Cal tracker']);
  app.append(tableView('board',D.board,autoCols(D.board),{title:'Intellirent order board (cal tracker tab, as of 11/4)',what:'board',filters:[{k:'Board'},{k:'Type'},{k:'Ordered By'}]}));
  app.append(tableView('ol',D.order_list,autoCols(D.order_list).map(c=>({...c,html:r=>/Date/.test(c.k)?fmtD(r[c.k]):esc(r[c.k])})),{title:'PowerWave Order List.xlsx',what:'order list',filters:[{k:'Order Status'},{k:'Ordered By'}]}));
 },
 search(){head('Global Search',[]);const q=document.getElementById('gq').value.trim();
  const box=document.createElement('div');box.innerHTML=`<div class="bar"><input type="search" id="gs" placeholder="Type anything: unit, serial, tech, order #, model…" value="${esc(q)}"></div><div id="gres"></div>`;app.append(box);
  const inp=box.querySelector('#gs');inp.oninput=()=>{document.getElementById('gq').value=inp.value;gsearch(inp.value)};gsearch(q);inp.focus();
 },
 sources(){head('Sources & Data Gaps',[]);
  app.append(tableView('src',D.sources.map(s=>({Source:s.Source,Path:s.dropbox_path||s.box_path||'',Updated:s.dropbox_modified||s.file_modified||'',Fetched:s.fetched||'',Info:Object.entries(s).filter(([k])=>!['Source','dropbox_path','box_path','dropbox_modified','file_modified','fetched'].includes(k)).map(([k,v])=>k+': '+v).join(', ')})),
   [{k:'Source'},{k:'Path',html:r=>pathHTML(r.Path)},{k:'Updated'},{k:'Fetched'},{k:'Info'}],{title:'Sources (read-only)',what:'sources'}));
  app.append(tableView('gaps',D.gaps.map(g=>({Gap:g})),[{k:'Gap'}],{title:'Data gaps & conflicts found by build_data.py',what:'gaps'}));
 },
 async users(){head('Users',[]);if(!Auth.isAdmin){app.insertAdjacentHTML('beforeend','<p>Admins only.</p>');return}
  if(!Auth.live){app.insertAdjacentHTML('beforeend','<p class="s">User management needs the Supabase backend (config.js + admin-users Edge Function). In LOCAL DEV mode there are no accounts.</p>')}
  const box=document.createElement('div');app.append(box);
  box.innerHTML=`<h2>Create user</h2><div class="bar"><input id="nu_e" type="email" placeholder="Email" autocomplete="off"><input id="nu_n" placeholder="Name (optional)">
   ${pwField('nu_p','Password (10+ chars)')}<label class="fl"><span>Role</span><select id="nu_r" data-plain><option>user</option><option>admin</option><option>pending</option></select></label><button id="nu_go">Create</button></div>
   <p class="s">Roles: <b>admin</b> = data + user management, <b>user</b> = data only, <b>pending</b> = no access (use to revoke). Disabled users cannot sign in.</p><h2>Users</h2><div id="ul">Loading…</div>`;
  bindPw(box);
  box.querySelector('#nu_go').onclick=()=>act('create',{email:box.querySelector('#nu_e').value.trim(),name:box.querySelector('#nu_n').value.trim(),password:box.querySelector('#nu_p').value,role:box.querySelector('#nu_r').value},'User created');
  if(!Auth.live){box.querySelector('#ul').textContent='(no backend configured)';return}
  try{const {users}=await Auth.admin('list');const me=Auth.email;
   box.querySelector('#ul').innerHTML=users.map(p=>{const dis=p.banned_until&&new Date(p.banned_until)>new Date();const self=p.email===me;
    return `<div class="card ucard" data-uid="${p.id}"><div><b>${esc(p.name||p.email)}</b> ${p.role==='pending'?'<span class="pill amber">NEEDS APPROVAL</span>':''}${dis?'<span class="pill red">DISABLED</span>':''}${self?'<span class="pill green">you</span>':''}
     <div class="s">${esc(p.email)} · last sign-in ${p.last_sign_in_at?fmtT(p.last_sign_in_at):'never'}</div></div>
     <div class="row"><select data-plain class="u_role" ${self?'disabled':''}>${['admin','user','pending'].map(r=>`<option ${r===p.role?'selected':''}>${r}</option>`).join('')}</select>
     ${pwField('pw_'+p.id,'New password (10+)')}<button class="sec u_pw">Set password</button>
     ${self?'':`<button class="sec u_dis">${dis?'Enable':'Disable'}</button><button class="sec u_del">Remove</button>`}</div></div>`}).join('');
   bindPw(box);
   box.querySelectorAll('.ucard').forEach(c=>{const id=c.dataset.uid;
    c.querySelector('.u_role').onchange=e=>act('set_role',{user_id:id,role:e.target.value},'Role updated');
    c.querySelector('.u_pw').onclick=()=>act('set_password',{user_id:id,password:c.querySelector('#pw_'+CSS.escape(id)).value},'Password changed');
    const d=c.querySelector('.u_dis');if(d)d.onclick=()=>act(d.textContent==='Disable'?'disable':'enable',{user_id:id},'Done');
    const r=c.querySelector('.u_del');if(r)r.onclick=()=>{if(confirm('Remove this user permanently?'))act('delete',{user_id:id},'User removed')}})}
  catch(e){box.querySelector('#ul').textContent='Failed: '+e.message}
 },
 account(){head('Account',[]);app.insertAdjacentHTML('beforeend',`<p>Signed in as <b>${esc(Auth.email)}</b> · role <b>${esc(Auth.role)}</b></p><div class="row">${pwField('mypw','New password (10+)')}<button class="sec" id="cpw">Change my password</button><button class="sec" id="sout">Sign out</button></div>`);
  bindPw(app);document.getElementById('sout').onclick=Auth.signOut;document.getElementById('cpw').onclick=async()=>{try{await Auth.changePw(document.getElementById('mypw').value);toast('Password changed')}catch(e){toast(e.message)}}}
};
const pwField=(id,ph)=>`<span class="pwf"><input id="${id}" type="password" placeholder="${ph}" minlength="10" autocomplete="new-password"><button type="button" class="sec sm pwt" data-for="${id}" aria-label="Show password">Show</button></span>`;
function bindPw(root){root.querySelectorAll('.pwt').forEach(b=>b.onclick=()=>{const i=document.getElementById(b.dataset.for);const show=i.type==='password';i.type=show?'text':'password';b.textContent=show?'Hide':'Show'})}
async function act(action,body,ok){if(body.password!==undefined&&body.password.length<10)return toast('Password must be 10+ characters');
 if(!Auth.live)return toast('No backend configured (LOCAL DEV)');try{await Auth.admin(action,body);toast(ok);V.users()}catch(e){toast('Failed: '+e.message)}}
function toast(t){const d=document.createElement('div');d.className='toast';d.textContent=t;document.body.append(d);setTimeout(()=>d.remove(),2500)}

/* ---------- global search across every dataset ---------- */
function gsets(){const S=[['Live Rentals','rentals',D.rentals,r=>`${r.Item} · ${r.Order} · ${r.Status}`],['Equipment','equipment',D.equipment,r=>`${r.Unit} · ${r.Model} · S/N ${r.Serial} · ${r.Holder} · ${r.Status}`],
  ['Tech Assignments','tech',D.tech,r=>`${r.Technician} · ${r.Category} · ${r['Item / note']}`],['Tech Replies','tech',D.tech_replies,r=>Object.values(r)[0]+' · '+(Object.values(r)[3]||'')],
  ['Certs Needed','certsneeded',D.certs_needed,r=>Object.values(r).slice(0,5).join(' · ')],
  ['Intellirent Orders','orders',D.orders,r=>`${r.Order} · ${r.Type} · ${r['Ordered by']} · ${r.Status||r.Board} · ${r.Items||''}`]];return S}
function gsearch(q){const el=document.getElementById('gres');if(!el)return;const terms=q.toLowerCase().split(/\s+/).filter(Boolean);if(!terms.length){el.innerHTML='<p class="s">Searches rentals, equipment, techs, replies, certs needed, orders and every other tracker tab.</p>';return}
 let html='',total=0;for(const [name,t,rows,lab] of gsets()){const hits=rows.filter(r=>{const s=JSON.stringify(r).toLowerCase();return terms.every(w=>s.includes(w))});if(!hits.length)continue;total+=hits.length;
  html+=`<h3>${esc(name)} <span class="s">(${hits.length})</span></h3>`+hits.slice(0,25).map(r=>`<div class="hit" data-t="${t}" data-q="${esc(q)}">${esc(lab(r))}</div>`).join('')+(hits.length>25?`<p class="s">+${hits.length-25} more - open the tab</p>`:'')}
 el.innerHTML=total?html:'<p>No matches.</p>';
 el.querySelectorAll('.hit').forEach(h=>h.onclick=()=>{tab=h.dataset.t;const k={rentals:'rentals',equipment:'equipment',tech:'tech',certsneeded:'cn',orders:'orders'}[tab];
  state[k]=state[k]||{q:'',f:{},sort:null,dir:1};state[k].q=h.dataset.q;location.hash=tab;render()})}
document.getElementById('gq').addEventListener('input',e=>{if(tab!=='search'){tab='search';render()}else gsearch(e.target.value);const g=document.getElementById('gs');if(g&&document.activeElement!==e.target)g.value=e.target.value});
document.getElementById('gq').addEventListener('keydown',e=>{if(e.key==='Enter'){tab='search';render()}});

(async()=>{D=await Auth.start();document.getElementById('who').innerHTML=Auth.live?`<button class="sec sm" onclick="Auth.signOut()">Sign out</button>`:'';render();
 setInterval(()=>{if(tab==='rentals'&&!document.activeElement.matches('input,select'))render()},6*3600e3)})();
window.addEventListener('hashchange',()=>{const t=location.hash.slice(1);if(t&&t!==tab){tab=t;render()}});
