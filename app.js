'use strict';
/* Powerwave Services tracker - simple lists (4-7 key columns), everything else in a tap-to-open detail panel. Data shape: see build_data.py. */
let D=null;const app=document.getElementById('app');
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const TODAY=()=>{const d=new Date();d.setHours(0,0,0,0);return d};
const pd=s=>{let m=/^(\d{4})-(\d\d)-(\d\d)/.exec(s||'');if(m)return new Date(+m[1],m[2]-1,+m[3]);m=/^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(s||'');return m?new Date(+m[3],m[1]-1,+m[2]):null};
const days=(a,b)=>Math.round((b-a)/864e5);
const blank=v=>v==null||(typeof v==='number'&&isNaN(v))||(Array.isArray(v)&&!v.length)||/^\s*(nan|none|null|—|-|n\/a)?\s*$/i.test(String(v));
const usd=n=>n==null||isNaN(n)?'':'$'+Math.round(n).toLocaleString('en-US');
const usd2=n=>n==null||isNaN(n)?'':'$'+n.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
const fD=s=>{if(blank(s))return '';const d=pd(String(s));return d&&/^\d{4}-\d\d-\d\d$|^\d{1,2}\/\d{1,2}\/\d{4}$/.test(String(s).trim())?d.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}):String(s)};
const TAGC={JAN:'jan',MAY:'may',SEP:'sep'};
const tagHTML=t=>t?`<span class="ctag ${TAGC[t]||''}">${t==='JAN'?'JAN · red':t==='MAY'?'MAY · blue':'SEP · green'}</span>`:'';
const ORD=/\b(O[RSE]\d{6}|SRV\d{5}|RSR\d{5}|SR\d{6}|RS\d{6})\b/g;
const oLink=no=>no?`<a href="#order=${esc(no)}" class="ord" data-o="${esc(no)}">${esc(no)}</a>`:'';
const linkOrders=t=>esc(t).replace(ORD,m=>oLink(m));
const typ=no=>({OR:'Rental',OE:'Exchange',OS:'Sale',SR:'Service',RS:'Service (RSR)'})[String(no).slice(0,2)]||'';
/* Person colors: deterministic hash into a curated palette (no pure red/amber/green, which mean status). Admin overrides: edit PERSON_COLORS (UPPERCASE name -> hex). */
const PERSON_COLORS={};
const PAL=['#5e35b1','#00838f','#6d4c41','#3949ab','#ad1457','#00695c','#7b1fa2','#0277bd','#4e342e','#c2185b','#455a64','#1e88e5','#8e24aa','#00897b','#5d4037','#283593','#d81b60','#006064','#546e7a','#6a1b9a'];
const pKey=n=>String(n||'').trim().toUpperCase().replace(/\s+/g,' ');
const NOPERSON=/^(|MISSING|\(NONE\)|\(UNKNOWN\)|NONE|UNASSIGNED|-)$/;
/* Admin-edited colors + aliases come from Supabase table person_colors (Admin tab); PERSON_COLORS stays the fallback default. */
let PC_DB={},PC_ALIAS={},PC_ROWS=[];
/* Seed = same rows as the person_colors table was pre-filled with; used offline / before the table loads. */
const PC_SEED=[['Allister Moreno','ALLISTER'],['Corey Palmer'],['David Villalobos','DAVID'],['Didier UsCan','DIDIER|Didier UsCan / PowerWave Svc'],['Jet Garza','JET'],['Jimmy Crawley','JIMMY|Jimmy Crawley / PowerWave Svcs'],['Joe Garza','JOE'],['Kaleb Luttrell','KALEB'],['Kyle Shircliffe','KYLE'],['Laura Shircliffe'],['Matt Bellott'],['Matt Castro'],['Mike Gallagher'],['Nitashanta Hagans','NIT'],['Olivia Hennig','OLIVIA'],['Patrick Arreaga','PATRICK'],['Scott Butler','SCOTT'],['Tristen Jacobs','TRISTEN|Tristan Jacobs|Tristen Jacobs / PowerWave Svcs']].map(([name,a])=>({name,color:null,aliases:a?a.split('|'):[]}));
function setPersonColors(rows){PC_ROWS=rows||[];PC_DB={};PC_ALIAS={};PC_ROWS.forEach(r=>{const k=pKey(r.name);if(r.color)PC_DB[k]=r.color;(r.aliases||[]).forEach(a=>{PC_ALIAS[pKey(a)]=k})})}
setPersonColors(PC_SEED);
const pCanon=n=>{const k=pKey(n);return PC_ALIAS[k]||k};
const pColor=n=>{const k=pCanon(n);if(NOPERSON.test(k))return '';if(PC_DB[k])return PC_DB[k];if(/^(OFFICE|AT OFFICE|LEASE|DAMAGED)\b/.test(k))return '';if(PERSON_COLORS[k])return PERSON_COLORS[k];let h=0;for(const c of k)h=(h*31+c.charCodeAt(0))>>>0;return PAL[h%PAL.length]};
const placeLabel=n=>{const s=String(n||''),k=pKey(s);if(/^AT OFFICE\b/.test(k))return s.replace(/^AT OFFICE/i,'At office');if(/^OFFICE\b/.test(k))return /^OFFICE(?:\s*\/\s*SPARE)?$/.test(k)?'At office':s.replace(/^OFFICE(?:\s*\/\s*spare)?/i,'At office');return s};
const statusLabel=e=>{const lab=e['Status label']||'';if(/^AT OFFICE\b/i.test(lab))return lab.replace(/^AT OFFICE/i,'At office');return e.Status!=='CONFIRMED'&&lab?lab:(e.Status==='MISSING'?'Missing':e.Status==='NOT CONFIRMED'?'Not confirmed':'Confirmed')};
const who=n=>{const label=placeLabel(n),c=pColor(n);return c?`<span class="who" style="--pc:${c}">${esc(label)}</span>`:esc(label||'')};
/* Cal tag: tracker field first; else nearest Jan/May/Sep cycle from the cal date month (marked est.) */
const TAGM={1:'JAN',2:'JAN',12:'JAN',11:'JAN',4:'MAY',5:'MAY',6:'MAY',3:'MAY',8:'SEP',9:'SEP',10:'SEP',7:'SEP'};
const tagOf=e=>{if(e['Cal tag'])return {t:e['Cal tag'],est:false};const m=+String(e['Cal date']||'').slice(5,7);return m?{t:TAGM[m],est:true}:{t:'',est:false}};
const TAGN={JAN:'Red',MAY:'Blue',SEP:'Green'};
const tagDot=e=>{const g=tagOf(e);return g.t?`<span class="tdot ${TAGC[g.t]}" title="${g.t} cycle · ${TAGN[g.t]} tag${g.est?' (estimated from cal date)':''}"></span>${TAGN[g.t]}${g.est?'<small class="s"> est.</small>':''}`:'<span class="s">—</span>'};
const legend=(people)=>{const d=document.createElement('div');d.className='legend';
 d.innerHTML=`<span class="s">Tag:</span> <span><span class="tdot jan"></span>Red = Jan</span> <span><span class="tdot may"></span>Blue = May</span> <span><span class="tdot sep"></span>Green = Sep</span>${people&&people.length?` <span class="s">· People:</span> ${(()=>{const m={};people.filter(n=>pColor(n)).forEach(n=>{const k=pCanon(n);const row=PC_ROWS.find(r=>pKey(r.name)===k);m[k]=m[k]||(row?row.name:n)});return Object.values(m).sort()})().map(who).join(' ')}`:''}`;return d};
const pill=(t,c)=>t?`<span class="pill ${c}">${esc(t)}</span>`:'';
const isOn=r=>String(r.Status).startsWith('ON RENT');
const stPill=r=>pill(isOn(r)?'On rent':r.Status==='RETURNED'?'Returned':/LIKELY/.test(r.Status)?'Likely returned':r.Status,isOn(r)?'red':r.Status==='RETURNED'?'green':'amber');
const narrow=()=>window.matchMedia('(max-width:900px)').matches;

/* ---------- rental math (live from today) ---------- */
function rentalCalc(r){const out=pd(r['Out date']);const end=pd(r['Return/close date'])||(isOn(r)?TODAY():null);
 const d=out&&end?Math.max(1,days(out,end)):null;let spent=null,basis=r['Price basis'];
 if(r.Invoiced!=null)spent=r.Invoiced;
 else if(r['Net daily']!=null&&d!=null){const dl=r['Net daily'],mo=r['Net monthly']||dl*20;spent=Math.floor(d/28)*mo+Math.min((d%28)*dl,mo)}
 else if(r['Net daily']!=null)basis='rate known, return date unknown';
 return {days:d,spent,basis,est:r['Spend kind']!=='actual'}}
let R=[],OI={},PDFX=null;   // PDFX: live bucket listing (order no -> [file names]) or null offline   // rentals with calc; order index
function prep(){R=D.rentals.map((r,i)=>({...r,_i:i,_c:rentalCalc(r)}));OI={};
 const get=no=>OI[no]||(OI[no]={no,o:null,lines:[]});
 (D.orders||[]).forEach(o=>get(o.Order).o=o);R.forEach(r=>get(r.Order).lines.push(r));
 Object.values(OI).forEach(x=>{const o=x.o||{},L=x.lines;const f=k=>L.map(r=>r[k]).find(v=>!blank(v)&&v!=='(unknown)');
  x.type=o.Type||f('Type')||typ(x.no);x.who=(!blank(o['Ordered by'])&&o['Ordered by'])||f('Placed by')||f('Who (ordered by)')||'';
  x.where=[f('Job'),f('Ship to')||o['Ship to']||f('Where (ship to / job)')].filter(Boolean).filter((v,i,a)=>a.indexOf(v)===i).join(' · ')||(o['Intellirent facility']?'Intellirent '+o['Intellirent facility']:'');
  x.date=o['Order date']||o['Ship date']||L.map(r=>r['Out date']).filter(Boolean).sort()[0]||'';
  x.actual=L.filter(r=>!r._c.est&&r._c.spent!=null).reduce((a,r)=>a+r._c.spent,0);x.estimate=L.filter(r=>r._c.est&&r._c.spent!=null).reduce((a,r)=>a+r._c.spent,0);
  x.total=L.some(r=>r._c.spent!=null)?x.actual+x.estimate:(o['Invoice total']??o['Sale/misc total']??null);
  // Live bucket listing is source of truth when available (uploaded.json can be stale).
  x.pdfs=PDFX?[...((PDFX[x.no])||[])]:[...(o['PDF files']||[])];
  x.status=L.some(isOn)?'On rent':o.Status||(L.length&&L.every(r=>r.Status==='RETURNED')?'Returned':o.Board||'');})}

/* ---------- simple list: search + <=3 filters (+ More filters), table on desktop, cards on phones ---------- */
const state={};
function listView(key,rows,cfg){
 const st=state[key]||(state[key]={q:'',f:{},sort:cfg.sort||null,dir:cfg.dir||1,n:100,more:false});
 const wrap=document.createElement('section');wrap.className='tv';const fv=(r,c)=>c.v?c.v(r):r[c.k];
 const sel=c=>{const vals=[...new Set(rows.map(r=>String(fv(r,c)??'')).filter(v=>!blank(v)))].sort(Combo.numCmp);
  return `<label class="fl"><span>${esc(c.label||c.k)}</span><select data-f="${esc(c.label||c.k)}"><option value="">All</option>${vals.map(v=>`<option ${st.f[c.label||c.k]===v?'selected':''}>${esc(v)}</option>`).join('')}</select></label>`};
 const F=[...(cfg.filters||[]),...(cfg.more||[])];
 wrap.innerHTML=`${cfg.title?`<h2>${esc(cfg.title)}</h2>`:''}<div class="bar"><input type="search" class="q" placeholder="Search ${esc(cfg.what||'')}…" value="${esc(st.q)}">${(cfg.filters||[]).map(sel).join('')}
  ${cfg.more&&cfg.more.length?`<button class="sec sm mf">${st.more?'Fewer filters':'More filters'}</button>`:''}<span class="cnt"></span></div>
  ${cfg.more&&cfg.more.length?`<div class="bar moref" ${st.more?'':'hidden'}>${cfg.more.map(sel).join('')}<button class="sec sm csv">Export CSV</button></div>`:''}<div class="tw"></div>`;
 const tw=wrap.querySelector('.tw'),cnt=wrap.querySelector('.cnt');
 function cur(){const terms=st.q.toLowerCase().split(/\s+/).filter(Boolean);
  let r=rows.filter(x=>F.every(c=>{const v=st.f[c.label||c.k];return !v||String(fv(x,c)??'')===v}));
  if(terms.length)r=r.filter(x=>{const t=(cfg.cols.map(c=>fv(x,c)).join(' ')+' '+JSON.stringify(x)).toLowerCase();return terms.every(w=>t.includes(w))});
  if(st.sort){const c=cfg.cols.find(c=>(c.label||c.k)===st.sort)||{k:st.sort};const sv=c.s||c.v||(x=>x[c.k]);r=[...r].sort((a,b)=>{const A=sv(a),B=sv(b);if(A===B)return 0;if(blank(A))return 1;if(blank(B))return -1;
   return (typeof A==='number'&&typeof B==='number'?A-B:Combo.numCmp(String(A),String(B)))*st.dir})}
  if(cfg.pre)r=cfg.pre(r);return r}
 const cell=(x,c)=>{const v=c.html?c.html(x):esc(fD(fv(x,c))??'');return blank(v)?'':v};
 function draw(){const r=cur(),show=r.slice(0,st.n);cnt.textContent=`${r.length} of ${rows.length}`;
  if(narrow())tw.innerHTML=`<div class="cards">${show.map((x,i)=>{const [a,...rest]=cfg.cols;const meta=rest.map(c=>{const v=cell(x,c);return v?`<span><em>${esc(c.label||c.k)}</em> ${v}</span>`:''}).join('');
   return `<div class="crd ${cfg.rowClass?cfg.rowClass(x):''}" data-i="${i}" tabindex="0"><div class="ct">${cell(x,a)}</div><div class="cm">${meta}</div></div>`}).join('')||'<p class="s">No matches</p>'}</div>`;
  else tw.innerHTML=`<table><thead><tr>${cfg.cols.map(c=>`<th data-k="${esc(c.label||c.k)}" class="${st.sort===(c.label||c.k)?(st.dir>0?'asc':'desc'):''}">${esc(c.label||c.k)}</th>`).join('')}</tr></thead>
   <tbody>${show.map((x,i)=>`<tr data-i="${i}" class="${cfg.rowClass?cfg.rowClass(x):''}" tabindex="0">${cfg.cols.map(c=>`<td>${cell(x,c)}</td>`).join('')}</tr>`).join('')||`<tr><td colspan="${cfg.cols.length}" class="s">No matches</td></tr>`}</tbody></table>`;
  if(r.length>st.n)tw.insertAdjacentHTML('beforeend',`<div class="more"><button class="sec sm" data-more>Show more (${r.length-st.n} left)</button></div>`);
  tw.querySelectorAll('th').forEach(th=>th.onclick=()=>{const k=th.dataset.k;if(st.sort===k)st.dir*=-1;else{st.sort=k;st.dir=1}draw()});
  tw.querySelectorAll('[data-i]').forEach(el=>{const open=e=>{if(e.target.closest('a.ord'))return;cfg.open&&cfg.open(show[+el.dataset.i])};el.onclick=open;el.onkeydown=e=>{if(e.key==='Enter')open(e)}});
  const m=tw.querySelector('[data-more]');if(m)m.onclick=()=>{st.n+=200;draw()}}
 wrap.querySelector('.q').oninput=e=>{st.q=e.target.value;st.n=100;draw()};
 wrap.querySelectorAll('select[data-f]').forEach(s=>s.onchange=()=>{st.f[s.dataset.f]=s.value;st.n=100;draw()});
 const mf=wrap.querySelector('.mf');if(mf)mf.onclick=()=>{st.more=!st.more;wrap.querySelector('.moref').hidden=!st.more;mf.textContent=st.more?'Fewer filters':'More filters';Combo.scan()};
 const cv=wrap.querySelector('.csv');if(cv)cv.onclick=()=>csv(key,cur(),cfg.cols);
 draw();return wrap}
function csv(name,rows,cols){const q=v=>{v=v==null?'':Array.isArray(v)?v.join(' | '):String(v);return /[",\n]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v};
 const t=[cols.map(c=>q(c.label||c.k)).join(','),...rows.map(r=>cols.map(c=>q(c.v?c.v(r):r[c.k])).join(','))].join('\n');
 const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([t],{type:'text/csv'}));a.download=`powerwave_${name}_${new Date().toISOString().slice(0,10)}.csv`;a.click()}
const fold=(title,el,open)=>{const d=document.createElement('details');d.className='fold';d.open=!!open;d.innerHTML=`<summary>${esc(title)}</summary>`;d.append(el);return d};
const sortedUnique=a=>[...new Set((a||[]).filter(Boolean))].sort(Combo.numCmp);

/* ---------- detail panel (full-screen sheet on phones, side panel on desktop) ---------- */
const HIDE=/^(_|Sources?$|Source$|Email source|ConversationID|Conversation ID|PDF$|PDF files|Date basis|Tracker check|Price basis|Spend kind|Sources)/i;
function kv(obj,skip=[]){return `<dl class="kv">${Object.entries(obj).filter(([k,v])=>!HIDE.test(k)&&!skip.includes(k)&&!blank(v)).map(([k,v])=>{
 const val=Array.isArray(v)?v.map(x=>esc(x)).join('<br>'):typeof v==='number'&&/rate|daily|monthly|invoic|total|price|spent/i.test(k)?usd2(v):linkOrders(fD(v));
 return `<dt>${esc(k)}</dt><dd>${val}</dd>`}).join('')}</dl>`}
let lastHash='';
function openPanel(title,html,hash){const p=document.getElementById('panel');p.innerHTML=`<div class="pbg"></div><aside class="pbox" role="dialog" aria-modal="true" aria-label="${esc(title)}">
 <div class="ph"><h2>${esc(title)}</h2><button class="sec sm px" aria-label="Close">✕</button></div><div class="pb">${html}</div></aside>`;p.hidden=false;document.body.classList.add('noscroll');
 p.querySelector('.px').onclick=closePanel;p.querySelector('.pbg').onclick=closePanel;p.querySelector('.px').focus();
 if(hash&&location.hash!=='#'+hash){lastHash=location.hash||'#'+tab;history.pushState(null,'','#'+hash)}return p}
function closePanel(){const p=document.getElementById('panel');if(p.hidden)return;p.hidden=true;p.innerHTML='';document.body.classList.remove('noscroll');
 if(/^#(order|unit|rental|job)=/.test(location.hash))history.pushState(null,'',lastHash&&!/=/.test(lastHash)?lastHash:'#'+tab)}
document.addEventListener('keydown',e=>{if(e.key==='Escape')closePanel()});
document.addEventListener('click',e=>{const a=e.target.closest('a.ord');if(a){e.preventDefault();e.stopPropagation();openOrder(a.dataset.o)}});

function openOrder(no){no=String(no||'').toUpperCase();const x=OI[no];if(!x){toast('No data for '+no);return}
 const o=x.o||{},L=x.lines,adm=!!Auth.isAdmin;
 const hdr={'Order':no,'Type':x.type,'Status':x.status,'Order date':o['Order date']||x.date,'Ship date':o['Ship date']||L.map(r=>r['Out date']).filter(Boolean).sort()[0],
  'Returned':L.some(isOn)?(L.some(r=>!isOn(r)&&r['Return/close date'])?'partly - '+L.filter(isOn).length+' item(s) still on rent':''):L.map(r=>r['Return/close date']).filter(Boolean).sort().slice(-1)[0],'Billed through':L.map(r=>r['Billed through']).filter(Boolean).sort().slice(-1)[0],
  'Placed by':x.who,'PO':L.map(r=>r.PO).find(v=>!blank(v)),'Job':L.map(r=>r.Job).find(v=>!blank(v)),'Ship to':L.map(r=>r['Ship to']).find(v=>!blank(v))||o['Ship to']||L.map(r=>r['Where (ship to / job)']).find(v=>!blank(v)),
  'Intellirent facility':o['Intellirent facility']||L.map(r=>r['Intellirent facility']).find(v=>!blank(v)),'Board':o.Board,'Assets':o.Assets,'Note':o.Note};
 const lines=L.map(r=>{const c=r._c;const certs=[...(r.Certs||[]),...((D.equipment||[]).filter(e=>e.Serial&&(e.Serial===r.Serial)).flatMap(e=>e.Certs||[]))];
  const money=adm?`<div class="lm">${[r['Net daily']!=null&&usd2(r['Net daily'])+'/day',r['Net monthly']!=null&&usd2(r['Net monthly'])+'/mo',r['List daily']&&r['Net daily']==null&&'list '+usd2(r['List daily'])+'/day'].filter(Boolean).join(' · ')}</div>
  <div class="lm">${c.spent!=null?`<b>${usd2(c.spent)}</b> ${c.est?pill('estimate','amber'):pill('actual invoiced','green')}`:'<span class="unk">price unknown</span>'}${r['History scope']==='Carried over'?' <span class="s">carried over, may be partial</span>':''}</div>`:'';
  const calBits=[r['Cal date']&&('cal '+fD(r['Cal date'])),noCal(r)?(r['Cal status']||'No cal required'):(r['Cal exp']&&('due '+fD(r['Cal exp'])))].filter(Boolean).join(' · ');
  const certBtn=(adm&&r['Cert PDF']&&Auth.live&&Auth.pdfUrl)?`<button type="button" class="btn sec cert-open" data-cert="${esc(r['Cert PDF'])}">Cal cert</button>`:'';
  const certPaths=certs.length?certs.map(p=>`<span class="path">${esc(p)}</span>`).join(' '):'';
  return `<div class="line ${isOn(r)?'r-on':''}"><div class="lt"><b>${esc(r.Item)}</b> ${stPill(r)}</div>
  <div class="lm">${[r.Barcode&&'Barcode '+esc(r.Barcode),r.Serial&&'S/N '+esc(r.Serial),c.days!=null&&c.days+' days',r['Out date']&&'out '+fD(r['Out date']),r['Return/close date']&&'back '+fD(r['Return/close date']),r['Billed through']&&'billed thru '+fD(r['Billed through'])].filter(Boolean).join(' · ')}</div>
  ${money}
  ${calBits||certBtn||certPaths?`<div class="lm cert-row">Cal cert: ${esc(calBits)||''} ${certBtn} ${certPaths}</div>`:''}</div>`}).join('');
 const quotes=(D.quotes||[]).filter(q=>(q.Source||'').includes(no)||q.Quote===no);
 const pdfs=x.pdfs||[];
 const moneyBlock=adm?`<div class="tots"><div><b>${usd2(x.actual)}</b><span>actual invoiced</span></div><div><b>${usd2(x.estimate)}</b><span>estimated</span></div><div><b>${L.length}</b><span>line(s)</span></div></div>`:`<div class="tots"><div><b>${L.length}</b><span>line(s)</span></div></div>`;
 const quoteBlock=adm&&quotes.length?`<h3>Quote lines</h3>${quotes.map(q=>`<div class="line"><b>${esc(q.Item)}</b> ${esc(q.Description||'')}<div class="lm">${esc(q.Quote)} · qty ${esc(q.Qty)} · ${esc(q['Line total']||q['Unit price'])}</div></div>`).join('')}`:'';
 // Order PDFs contain prices — admin only. Bucket listing (PDFX) decides "on file".
 const pdfSection=adm?`<h3>Original order PDF</h3><div class="pdfs">${
   !Auth.live||!Auth.pdfUrl?'<p class="s">PDF not available offline — open the live site while signed in as admin.</p>':
   !pdfs.length?'<p class="s">No PDF on file for this order.</p>':
   pdfs.map(n=>`<div class="pdf" data-n="${esc(n)}"><p class="s">Loading ${esc(n)}…</p></div>`).join('')
 }</div>`:'';
 const html=`${kv(hdr)}
  ${moneyBlock}
  <h3>Line items</h3>${lines||(o.Items?`<p>${esc(o.Items)}</p>`:'<p class="s">No line items on file.</p>')}
  ${o['Email lines']?`<h3>Order email lines</h3><p class="s">${esc(o['Email lines'])}</p>`:''}
  ${quoteBlock}
  ${pdfSection}`;
 const p=openPanel('Order '+no,html,'order='+no);
 if(adm){
  p.querySelectorAll('.pdf').forEach(el=>renderOrderPdf(el));
  p.querySelectorAll('.cert-open').forEach(btn=>btn.onclick=async()=>{
   try{
    const u=await Auth.pdfUrl(btn.dataset.cert);
    const w=window.open(u,'_blank','noopener'); if(!w) location.href=u;
   }catch(e){toast('Cal cert: '+(e.message||e))}
  });
 }
}
const isIOS=/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
async function renderOrderPdf(el){
 const name=el.dataset.n;
 try{
  const u=await Auth.pdfUrl(name);
  // iOS Safari often cannot render PDFs in iframes — open signed URL in a new tab.
  if(isIOS){
   el.innerHTML=`<div class="pdf-actions"><button type="button" class="btn pdf-open">View PDF</button>
    <a class="btn sec" href="${esc(u)}" target="_blank" rel="noopener">Open in new tab</a>
    <span class="s">${esc(name)} · link expires in 10 min</span></div>
    <p class="s">On iPhone, PDFs open in a new tab (Safari can’t show them inside this panel).</p>`;
   el.querySelector('.pdf-open').onclick=()=>{const w=window.open(u,'_blank','noopener');if(!w) location.href=u};
  }else{
   el.innerHTML=`<div class="pdf-actions"><button type="button" class="btn pdf-open">View PDF</button>
    <a class="btn sec" href="${esc(u)}" target="_blank" rel="noopener">Open in new tab</a>
    <span class="s">${esc(name)} · link expires in 10 min</span></div>
    <div class="pdf-frame"><iframe src="${esc(u)}#toolbar=1" title="${esc(name)}" loading="lazy"></iframe></div>`;
   el.querySelector('.pdf-open').onclick=()=>{const fr=el.querySelector('.pdf-frame');if(fr) fr.scrollIntoView({behavior:'smooth',block:'nearest'}); else window.open(u,'_blank','noopener')};
  }
 }catch(e){
  const msg=String(e.message||e);
  el.innerHTML=`<p class="s">${/not found|404|Object not found/i.test(msg)?'No PDF on file for this order.':('Could not load PDF: '+esc(msg))}</p>`;
 }
}
function openRental(r){const c=r._c;openPanel(r.Item,`<p>${stPill(r)} ${oLink(r.Order)}</p>
 <div class="tots"><div><b>${c.spent!=null?usd2(c.spent):'?'}</b><span>${c.spent==null?'price unknown':c.est?'estimate':'actual invoiced'}</span></div><div><b>${c.days??''}</b><span>days</span></div></div>
 ${kv({...r,'Days out':c.days},['Item','Status','Order','Who (ordered by)','Where (ship to / job)'])}<p class="s">${esc(c.basis||'')}</p>`,'rental='+r._i)}
function openUnit(e){const d=dueInfo(e);openPanel(e.Unit+' · '+e.Model,`<p>${pill(statusLabel(e),e.Status==='MISSING'?'red':e.Status==='NOT CONFIRMED'?'amber':'green')} ${recalBadge(e)} <span class="due ${d.k}">${esc(d.t)}</span> ${leftHTML(d)} ${tagDot(e)} ${who(e.Holder)}</p>
 ${kv(e,['Certs','Notes'])}${e.Notes?`<h3>Notes</h3><p class="note">${linkOrders(e.Notes)}</p>`:''}${(e.Certs||[]).length?`<h3>Cert file(s)</h3>${e.Certs.map(p=>`<span class="path">${esc(p)}</span>`).join('')}`:'<p class="s">No cert file found.</p>'}`,'unit='+encodeURIComponent(e.Unit+'|'+e.Serial))}
const openRow=(title,r)=>openPanel(title,kv(r));
function openJob(j){
 if(!j){toast('No job');return}
 const name=j.Job||'';
 const hdr={
  'Job':name,
  'Rentals':j.Rentals,
  'Models':j.Models,
  'Date range':(j.From&&j.To)?(j.From===j.To?j.From:j.From+' → '+j.To):(j.From||j.To||''),
  'On rent now':j['On rent'],
  'Who ordered':j['Ordered by summary']||(j['Ordered by']||[]).join(', '),
  'Ship to':j['Ship to summary']||(j['Ship to']||[]).join('; ')
 };
 const orders=j.Orders||[];
 const ordHtml=orders.map(o=>{
  const items=(o.Items||[]).map(it=>`<div class="line ${it.Status==='ON RENT'?'r-on':''}"><div class="lt"><b>${esc(it.Model||'')}</b> ${pill(it.Status,it.Status==='ON RENT'?'green':it.Status==='Returned'?'':'amber')}</div>
   <div class="lm">${[it.Serial&&('S/N '+esc(it.Serial)),it.Barcode&&('Barcode '+esc(it.Barcode)),it['Ship date']&&('out '+fD(it['Ship date'])),it['Return date']&&('back '+fD(it['Return date']))].filter(Boolean).join(' · ')}</div></div>`).join('');
  return `<div class="job-ord"><div class="lt">${oLink(o.Order)} <span class="s">${esc(o.Date||'')}</span> ${who(o['Ordered by'])} ${o['On rent']?pill(o['On rent']+' on rent','green'):''}</div>
   <div class="lm">${esc(o['Ship to']||'')}</div>${items}</div>`}).join('')||'<p class="s">No orders</p>';
 const pw=j['Powerwave equipment']||[];
 const pwHtml=pw.length?`<h3>Powerwave-owned equipment on this job</h3>${pw.map(e=>`<div class="line"><div class="lt"><b>${esc(e.Unit||e.Serial||'')}</b> ${esc(e.Model||'')} ${pill(statusLabel(e),e.Status==='MISSING'?'red':e.Status==='NOT CONFIRMED'?'amber':'green')}</div>
  <div class="lm">${[e.Serial&&('S/N '+esc(e.Serial)),e.Holder&&who(e.Holder)].filter(Boolean).join(' · ')}</div></div>`).join('')}`:'';
 const html=`${kv(hdr)}
  <p class="s">No dollar amounts on this tab.</p>
  <h3>Orders (${orders.length})</h3>${ordHtml}${pwHtml}`;
 openPanel(name==='Unassigned'?'Unassigned orders':('Job · '+name),html,'job='+encodeURIComponent(name));
}
function fromHash(){const h=decodeURIComponent(location.hash.slice(1));let m;
 if((m=/^order=(.+)$/.exec(h)))return openOrder(m[1]),true;
 if((m=/^job=(.+)$/.exec(h))){const name=m[1];const jb=(D.job_board&&D.job_board.jobs||[]).find(j=>j.Job===name);if(jb){if(tab!=='jobs'){tab='jobs';render()}return openJob(jb),true}toast('Job not found');return true}
 if((m=/^rental=(\d+)$/.exec(h))&&R[+m[1]])return openRental(R[+m[1]]),true;
 if((m=/^unit=(.*)\|(.*)$/.exec(h))){const e=D.equipment.find(e=>e.Unit===m[1]&&e.Serial===m[2]);if(e)return openUnit(e),true}
 return false}

/* ---------- tabs ---------- */
const TABS=[['myeq','My Equipment'],['rentals','Live Rentals'],['equipment','Equipment'],['tech','Tech Assignments'],['certsneeded','Certs Needed'],
 ['orders','Intellirent Orders'],['orderlist','Order List'],['jobs','Jobs'],['search','Global Search'],['spend','Rental Spend'],['admin','Admin'],['account','Account']];
const techOnly=()=>!!(Auth.live&&Auth.role==='user'&&!Auth.isAdmin);
const myTechName=()=>{const em=String(Auth.email||'').trim().toLowerCase();return (D&&D.tech_emails&&D.tech_emails[em])||null};
let tab=(location.hash||'#myeq').slice(1);if(/=/.test(tab))tab='myeq';if(tab==='users')tab='admin';if(tab==='rentals'&&!(location.hash||'').slice(1))tab='myeq';
function nav(){const tabs=TABS.filter(([k])=>{
  if(k==='account')return !!Auth.live;
  if(techOnly())return k==='myeq';
  if(k==='admin'||k==='spend')return !!Auth.isAdmin;
  return true});
 if(techOnly()&&tab!=='myeq'&&tab!=='account')tab='myeq';
 document.body.classList.toggle('tech-only',techOnly());
 document.getElementById('tabs').innerHTML=tabs.map(([k,l])=>`<button role="tab" class="${k===tab?'on':''}" data-t="${k}">${l}</button>`).join('');
 document.querySelectorAll('#tabs button').forEach(b=>b.onclick=()=>{tab=b.dataset.t;location.hash=tab;render()})}
function render(){nav();app.innerHTML='';(V[tab]||V.rentals)();Combo.scan();window.scrollTo(0,0)}
const fmtT=t=>t?new Date(t).toLocaleString('en-US',{timeZone:'America/Chicago',month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit'})+' CT':'';
const head=h=>{const d=document.createElement('div');d.className='hd';d.innerHTML=`<h1>${h}</h1><span class="s">Data as of ${fmtT(D.built)}</span>`;app.append(d)};
const noCal=e=>!!(e&&(e._no_cal||e['Cal required']===false||/no cal required/i.test(e['Cal status']||'')));
const needsRecal=e=>!!(e&&(e._recal||e['Needs recal']));
const recalBadge=e=>needsRecal(e)?`<span class="recal-badge" title="Send in for cal">Needs recal</span>`:'';
const dueInfo=e=>{if(noCal(e))return {k:'nocal',t:'No cal required',n:null};
 if(needsRecal(e))return {k:'recal',t:'Needs recal',n:-99999};
 const d=pd(e&&e['Due date']);if(!d)return {k:'nodate',t:'no due date',n:null};const n=days(TODAY(),d);
 return n<0?{k:'over',t:`overdue ${-n}d`,n}:n<=30?{k:'soon',t:`due in ${n}d`,n}:{k:'ok',t:`${n}d left`,n}};
const leftTxt=d=>d.k==='nocal'?'No cal required':d.k==='recal'?'Needs recal':d.n==null?'—':d.n<0?`Overdue ${-d.n} day${d.n===-1?'':'s'}`:d.n===0?'Due today':`${d.n} day${d.n===1?'':'s'}`;
const leftHTML=d=>`<span class="left ${d.k}"${d.k==='recal'?' title="Send in for cal"':''}>${leftTxt(d)}</span>`;
const dueWin=d=>d.k==='nocal'?'No cal required':d.k==='recal'||(d.n!=null&&d.n<0)?'Overdue':d.n==null?'No date':d.n<=30?'Due in 30 days':'Later';
const leftCol={k:'_left',label:'Days left',s:x=>x._d.n,v:x=>leftTxt(x._d),html:x=>leftHTML(x._d)};
const quickDue=(key,E)=>{const st=state[key]||(state[key]={q:'',f:{},sort:'Days left',dir:1,n:100,more:false});const cur=st.f['Due window']||'';
 const b=document.createElement('div');b.className='qf';b.innerHTML=['','Overdue','Due in 30 days'].map(v=>`<button class="${cur===v?'on':''}" data-v="${v}">${v||'All'} <small>${v?E.filter(e=>dueWin(e._d)===v||(v==='Due in 30 days'&&e._d.k==='soon')).length:E.length}</small></button>`).join('');
 b.querySelectorAll('button').forEach(x=>x.onclick=()=>{st.f['Due window']=x.dataset.v;render()});return b};
const kpis=items=>{const k=document.createElement('div');k.className='kpis';k.innerHTML=items.map(([v,l,w])=>`<div class="kpi ${w?'warnk':''}"><b>${v}</b><span>${l}</span></div>`).join('');app.append(k)};
const groupOrders=(title,L)=>{const nos=[...new Set(L.map(r=>r.Order))].map(n=>OI[n]).sort((a,b)=>String(b.date).localeCompare(String(a.date)));
 openPanel(title,`<p class="s">${nos.length} orders · tap one for detail</p>${nos.map(x=>`<div class="line"><div class="lt">${oLink(x.no)} <span class="s">${fD(x.date)}</span> <b style="float:right">${usd(x.total)}</b></div><div class="lm">${esc(x.who)} · ${esc(x.where)}</div></div>`).join('')}`)};

const V={
 rentals(){head('Live Rentals');
  const on=R.filter(isOn),now=TODAY(),yr=String(now.getFullYear()),ym=yr+'-'+String(now.getMonth()+1).padStart(2,'0');
  const tot=f=>{let a=0,e=0;R.forEach(r=>{if(!f(r)||r._c.spent==null)return;a+=r._c.spent;if(r._c.est)e+=r._c.spent});return [usd(a),e?`incl. ${usd(e)} est.`:'actual']};
  const all=tot(()=>true),y=tot(r=>String(r['Out date']).startsWith(yr)),m=tot(r=>String(r['Out date']).startsWith(ym));
  const accr=on.reduce((a,r)=>a+(r._c.spent||0),0),unk=on.filter(r=>r._c.spent==null).length;
  kpis([[all[0],'spent all-time · '+all[1]],[y[0],'spent in '+yr+' · '+y[1]],[m[0],'this month · '+m[1]],[on.length,`on rent now · ${usd(accr)} accrued (est.)${unk?` · ${unk} price unknown`:''}`,unk]]);
  const st=state.rentals||(state.rentals={q:'',f:{},sort:null,dir:-1,n:100,more:false});
  app.append(listView('rentals',R,{what:'item, order, person, serial',open:openRental,rowClass:r=>isOn(r)?'r-on':'',
   pre:r=>state.rentals.sort?r:[...r].sort((a,b)=>(isOn(b)-isOn(a))||String(b['Out date']).localeCompare(String(a['Out date']))),
   cols:[{k:'Item',html:r=>`<b>${esc(r.Item)}</b>`},{k:'Order',html:r=>oLink(r.Order)},{k:'Who',html:r=>who(r['Placed by']&&r['Placed by']!=='(unknown)'?r['Placed by']:(r['Who (ordered by)']!=='(unknown)'?r['Who (ordered by)']:'')),v:r=>r['Placed by']&&r['Placed by']!=='(unknown)'?r['Placed by']:(r['Who (ordered by)']!=='(unknown)'?r['Who (ordered by)']:'')},
    {k:'Where',v:r=>r.Job||r['Ship to']||r['Where (ship to / job)']||''},{k:'Days out',v:r=>r._c.days},
    {k:'$ spent',v:r=>r._c.spent,html:r=>r._c.spent!=null?`${usd(r._c.spent)}${r._c.est?' <small class="est">est.</small>':''}`:'<span class="unk">?</span>'},
    {k:'Status',v:r=>isOn(r)?'On rent':r.Status==='RETURNED'?'Returned':'Likely returned',html:stPill}],
   filters:[{k:'Status',v:r=>isOn(r)?'On rent':r.Status==='RETURNED'?'Returned':'Likely returned'},{k:'Who',v:r=>r['Placed by']||r['Who (ordered by)']},{k:'Year',v:r=>String(r['Out date']||'').slice(0,4)}],
   more:[{k:'Job'},{k:'Type'},{k:'Spend',v:r=>r._c.spent==null?'Price unknown':r._c.est?'Estimate':'Actual'},{k:'Intellirent facility',label:'IR facility'}]}));
  if(D.quotes&&D.quotes.length)app.append(fold('Quotes (not spend)',listView('quotes',D.quotes,{what:'quotes',open:q=>openRow('Quote '+q.Quote,q),cols:[{k:'Quote'},{k:'Item'},{k:'Line total'},{k:'Received',v:q=>fD(String(q.Received).slice(0,10))}]})));
  app.append(fold('How on-rent spend is estimated',Object.assign(document.createElement('p'),{className:'s',innerHTML:'Running totals for actual rental spend (by year, model, person, and job) live on the admin-only <b>Rental Spend</b> tab. Here, items still on rent without an invoiced amount are <b>estimates</b> from order rates (never invented). No rate on file = price unknown.'})));
 },

 myeq(){head('My Equipment');
  const people=(D.people_equipment||[]).map(p=>({...p,units:(p.units||[]).map(e=>({...e,_d:dueInfo(e)}))}));
  const mine=myTechName();
  let visible;
  if(techOnly()){
    visible=people.filter(p=>p.name===mine&&!p.location);
    if(!visible.length){
      app.insertAdjacentHTML('beforeend', mine
        ? `<p>No confirmed equipment is assigned to <b>${esc(mine)}</b> right now.</p>`
        : `<p>Your account is not linked to a technician name. Ask an admin to check the email mapping.</p>`);
      return;
    }
  }else{
    visible=people;
    if(!visible.length){app.insertAdjacentHTML('beforeend','<p>No confirmed equipment is assigned to anyone right now.</p>');return}
    const st=state.myeq||(state.myeq={person:mine&&visible.some(p=>p.name===mine)?mine:visible[0].name});
    if(!visible.some(p=>p.name===st.person))st.person=visible[0].name;
    const sw=document.createElement('div');sw.className='me-people';
    sw.innerHTML=visible.map(p=>`<button type="button" class="${p.name===st.person?'on':''}" data-p="${esc(p.name)}">${esc(p.name)} <small>${p.units.length}</small></button>`).join('');
    sw.querySelectorAll('button').forEach(b=>b.onclick=()=>{state.myeq.person=b.dataset.p;render()});
    app.append(sw);
    visible=visible.filter(p=>p.name===st.person);
  }
  const p=visible[0];
  p.units=[...p.units].sort((a,b)=>(a._d.n??9e9)-(b._d.n??9e9));
  const n=p.units.length, missing=p.units.filter(e=>!e['Cert PDF']).length, recals=p.units.filter(needsRecal).length;
  kpis([[n,'confirmed unit'+(n===1?'':'s'),false],[missing,'cert not on file',!!missing],[recals,'needs recal',!!recals]]);
  const list=document.createElement('div');list.className='me-list';
  list.innerHTML=p.units.map((e,i)=>{
    const d=e._d, tag=tagHTML(tagOf(e).t)||tagDot(e);
    const cert=e['Cert PDF']?`<div class="me-cert">Tap to open current cal cert</div>`:`<div class="me-cert missing">Cert not on file</div>`;
    return `<button type="button" class="me-card${needsRecal(e)?' needs-recal':''}" data-i="${i}">
      <div class="me-top"><b>${esc(e.Unit)}</b> <span>${esc(e.Model||'')}</span> ${recalBadge(e)}</div>
      <div class="me-meta"><span>S/N ${esc(e.Serial||'—')}</span>
        <span>Cal ${e['Cal date']?esc(fD(e['Cal date'])):'—'}</span>
        <span>Due ${noCal(e)?'—':(e['Due date']?`<span class="due ${d.k}">${esc(fD(e['Due date']))}</span>`:'—')}</span>
        ${leftHTML(d)} ${tag}</div>${cert}</button>`;
  }).join('');
  list.querySelectorAll('.me-card').forEach(btn=>btn.onclick=async()=>{
    const e=p.units[+btn.dataset.i];
    if(!e['Cert PDF']){toast('Cert not on file');return}
    if(!Auth.live||!Auth.certUrl){toast('Open the live site while signed in to view certs.');return}
    try{
      const u=await Auth.certUrl(e['Cert PDF']);
      window.open(u,'_blank','noopener');
    }catch(err){toast(err.message||'Could not open cert')}
  });
  app.append(list);
 },
 equipment(){head('Equipment');
  const E=D.equipment.map(e=>({...e,_d:dueInfo(e)}));const c=f=>E.filter(f).length;
  kpis([[E.length,'units'],[c(e=>e.Status==='MISSING'),'missing',1],[c(e=>e.Status==='NOT CONFIRMED'),'assigned, not confirmed',1],[c(e=>e._d.k==='over'||e._d.k==='recal'),'cal overdue',1],[c(e=>e._d.k==='soon'),'due within 30 days'],[c(needsRecal),'needs recal',c(needsRecal)]]);
  const dl=e=>({over:'Overdue',soon:'Due soon',ok:'OK',nodate:'No date',nocal:'No cal required',recal:'Needs recal'})[e._d.k];
  app.append(quickDue('equipment',E));app.append(legend(E.map(e=>e.Holder)));
  app.append(listView('equipment',E,{what:'unit, model, serial, holder',open:openUnit,rowClass:e=>(e.Status==='MISSING'?'r-miss ':'')+(needsRecal(e)?'r-recal ':'')+'tag-'+(TAGC[tagOf(e).t]||''),
   cols:[{k:'Unit',label:'Asset',html:e=>`<b>${esc(e.Unit)}</b>`},{k:'Model'},{k:'Holder',html:e=>who(e.Holder)},{k:'tag',label:'Tag color',s:e=>tagOf(e).t,v:e=>TAGN[tagOf(e).t]||'None',html:tagDot},{k:'Due date',label:'Cal due',s:e=>e['Due date'],v:e=>e['Due date'],html:e=>e['Due date']?`<span class="due ${e._d.k}">${fD(e['Due date'])}</span>`:''},leftCol,
    {k:'Status',html:e=>pill(statusLabel(e),e.Status==='MISSING'?'red':e.Status==='NOT CONFIRMED'?'amber':'green')}],
   filters:[{k:'Status'},{k:'Holder',v:e=>placeLabel(e.Holder)},{k:'due',label:'Cal due',v:dl},{k:'tag',label:'Tag color',v:e=>TAGN[tagOf(e).t]||'None'}],more:[{k:'Cal tag'},{k:'Model'},{k:'dw',label:'Due window',v:e=>e._d.k==='soon'?'Due in 30 days':dueWin(e._d)}]}));
 },
 tech(){head('Tech Assignments');
  const EU={};D.equipment.forEach(e=>{if(e.Unit&&!EU[e.Unit])EU[e.Unit]=e});
  const T=D.tech.map(r=>{const e=EU[r.Unit];return {...r,_tg:e?tagOf(e).t:r['Cal tag'],'Cal due':e?e['Due date']:'',_d:dueInfo(e||{})}});
  app.append(quickDue('tech',T));app.append(legend(T.map(r=>r.Technician)));
  app.append(listView('tech',T,{what:'tech, unit, item',open:r=>openRow(r.Technician+' · '+(r.Unit||''),r),
   cols:[{k:'Technician',label:'Tech',html:r=>`<b>${who(r.Technician)}</b>`},{k:'Item / note',label:'Equipment',v:r=>String(r['Item / note']||'').replace(/\s*\[(JAN|MAY|SEP)\]\s*$/,'')},{k:'Unit',label:'Asset'},{k:'tag',label:'Tag color',s:r=>r._tg,v:r=>TAGN[r._tg]||'None',html:r=>tagDot({'Cal tag':r._tg})},
    {k:'Cal due',s:r=>r['Cal due'],v:r=>r['Cal due'],html:r=>r['Cal due']?`<span class="due ${r._d.k}">${fD(r['Cal due'])}</span>`:''},leftCol],
   filters:[{k:'Technician',label:'Tech'},{k:'Category'},{k:'tag',label:'Tag color',v:r=>TAGN[r._tg]||'None'}],more:[{k:'Cal tag'},{k:'dw',label:'Due window',v:r=>r._d.k==='soon'?'Due in 30 days':dueWin(r._d)}]}));
  const cols=rows=>{const ks=[];rows.forEach(r=>Object.keys(r).forEach(k=>{if(!ks.includes(k)&&!HIDE.test(k))ks.push(k)}));return ks};
  if(D.tech_replies.length){const k=cols(D.tech_replies);app.append(fold('Tech replies ('+D.tech_replies.length+')',listView('replies',D.tech_replies,{what:'replies',open:r=>openRow(r[k[0]],r),cols:k.slice(0,3).map(x=>({k:x}))})))}
  if(D.roster.length)app.append(fold('Employee roster',listView('roster',D.roster,{what:'employees',cols:[{k:'Employee'}]})));
 },
 certsneeded(){head('Certs Needed');
  app.append(listView('cn',D.certs_needed,{what:'asset, model, serial',open:r=>openRow((r['Unit ID']||'')+' · '+(r['Make / Model']||''),r),
   rowClass:r=>/EXPIRED/i.test(r.Category)?'r-miss':/DONE/i.test(r.Category)?'r-ok':'',
   cols:[{k:'Unit ID',label:'Asset',html:r=>`<b>${esc(r['Unit ID'])}</b>`},{k:'Make / Model',label:'Item'},{k:'Category',label:'Status',v:r=>String(r.Category||'').replace(/^\d+\.\s*/,'')}],
   filters:[{k:'Category',label:'Status',v:r=>String(r.Category||'').replace(/^\d+\.\s*/,'')},{k:'Who has it'}]}));
 },
 orders(){head('Intellirent Orders');
  const O=Object.values(OI);
  app.append(listView('orders',O,{what:'order #, person, place, item',open:x=>openOrder(x.no),sort:'Date',dir:-1,rowClass:x=>x.status==='On rent'?'r-on':'',
   cols:[{k:'no',label:'Order',html:x=>oLink(x.no)},{k:'date',label:'Date',v:x=>x.date},{k:'who',label:'Who',html:x=>who(x.who)},{k:'where',label:'Where'},
    {k:'total',label:'Total',v:x=>x.total,html:x=>x.total!=null?usd(x.total)+(x.estimate?' <small class="est">est.</small>':''):''},{k:'status',label:'Status'}],
   filters:[{k:'type',label:'Type'},{k:'who',label:'Who'},{k:'status',label:'Status'}],more:[{k:'year',label:'Year',v:x=>String(x.date).slice(0,4)}]}));
 },
 orderlist(){head('Order List & Board');
  app.append(listView('board',D.board,{title:'Intellirent order board (cal tracker)',what:'board',open:r=>openOrder(r['Order No']),
   cols:[{k:'Order No',label:'Order',html:r=>oLink(r['Order No'])},{k:'Order Date',label:'Date'},{k:'Ordered By',label:'Who',html:r=>who(r['Ordered By'])},{k:'Board',label:'Status'}],filters:[{k:'Board',label:'Status'},{k:'Ordered By',label:'Who'}]}));
  app.append(listView('ol',D.order_list,{title:'PowerWave Order List',what:'order list',open:r=>OI[r['Order Number']]?openOrder(r['Order Number']):openRow(r['Order Number'],r),sort:'Date',dir:-1,
   cols:[{k:'Order Number',label:'Order',html:r=>oLink(r['Order Number'])},{k:'Order Date',label:'Date'},{k:'Ordered By',label:'Who',html:r=>who(r['Ordered By'])},{k:'Shipping Address',label:'Where'},{k:'Order Status',label:'Status'}],
   filters:[{k:'Order Status',label:'Status'},{k:'Ordered By',label:'Who'}]}));
 },
 search(){head('Global Search');const q=document.getElementById('gq').value.trim();
  const box=document.createElement('div');box.innerHTML=`<div class="bar"><input type="search" id="gs" placeholder="Type anything: unit, serial, tech, order #, model…" value="${esc(q)}"></div><div id="gres"></div>`;app.append(box);
  const inp=box.querySelector('#gs');inp.oninput=()=>{document.getElementById('gq').value=inp.value;gsearch(inp.value)};gsearch(q);inp.focus();
 },


 jobs(){head('Jobs');
  const JB=D.job_board||{};const all=JB.jobs||[];
  if(!all.length){app.insertAdjacentHTML('beforeend','<p class="warn">No job board published yet. Rebuild site data.</p>');return}
  const c=JB.counts||{};
  const top=document.createElement('div');top.className='kpis';
  top.innerHTML=[['jobs',c.jobs||0],['active (on rent)',c.active_jobs||0],['rental orders',c.orders||0],['unassigned orders',c.unassigned_orders||0]]
   .map(([l,v])=>`<div class="kpi"><b>${v}</b><span>${l}</span></div>`).join('');
  app.append(top);
  app.insertAdjacentHTML('beforeend',`<p class="s">No dollar amounts. Unmatched rentals show under Unassigned.</p>`);
  const yr=state.jobsYear||'all';
  const years=[...new Set(all.flatMap(j=>j.Years||[]))].sort((a,b)=>b-a);
  const filt=document.createElement('div');filt.className='qf';
  filt.innerHTML=[['all','All years'],...years.map(y=>[String(y),String(y)])].map(([v,l])=>`<button class="${yr===v?'on':''}" data-y="${v}">${l}</button>`).join('');
  filt.querySelectorAll('button').forEach(b=>b.onclick=()=>{state.jobsYear=b.dataset.y;render()});
  app.append(filt);
  let jobs=all;
  if(yr!=='all')jobs=all.map(j=>{
   const ol=(j.Orders||[]).filter(o=>String(o.Year)===String(yr));
   if(!ol.length)return null;
   const models=sortedUnique(ol.flatMap(o=>(o.Items||[]).map(i=>i.Model).filter(Boolean)));
   const whoL=sortedUnique(ol.flatMap(o=>o['Ordered by list']||[]));
   const ships=sortedUnique(ol.flatMap(o=>o['Ship to list']||[]));
   const dates=ol.map(o=>o.Date).filter(Boolean).sort();
   const on=ol.reduce((s,o)=>s+(o['On rent']||0),0);
   return {...j,Orders:ol,Rentals:ol.length,Models:models.length,'Model list':models,
    From:dates[0]||'',To:dates[dates.length-1]||'',
    'Ordered by':whoL,'Ordered by summary':whoL.slice(0,8).join(', ')+(whoL.length>8?'…':''),
    'Ship to':ships,'Ship to summary':ships.slice(0,3).join('; ')+(ships.length>3?'…':''),
    'On rent':on,Active:on>0,Years:[+yr],Sources:sortedUnique(ol.map(o=>o.Source))};
  }).filter(Boolean);
  const rows=jobs.map(j=>({...j,
   _active:j.Active?'Active (on rent)':'Inactive',
   _range:(j.From&&j.To)?(j.From===j.To?j.From:j.From+' → '+j.To):(j.From||j.To||''),
   _who:j['Ordered by summary']||'',
   _ship:j['Ship to summary']||''
  }));
  app.append(listView('jobs',rows,{title:'Jobs',what:'job, who, ship-to, model, order',sort:'On rent',dir:-1,
   open:r=>openJob(r),
   rowClass:r=>r.Job==='Unassigned'?'':(r.Active?'r-on':''),
   pre:r=>{const ua=r.filter(x=>x.Job==='Unassigned');return r.filter(x=>x.Job!=='Unassigned').concat(ua)},
   cols:[
    {k:'Job',html:r=>r.Job==='Unassigned'?`<span class="pill amber">Unassigned</span>`:`<b>${esc(r.Job)}</b>`},
    {k:'Rentals'},
    {k:'Models',html:r=>`<span title="${esc((r['Model list']||[]).join(', '))}">${r.Models}</span>`},
    {k:'_range',label:'Dates'},
    {k:'_who',label:'Who ordered',html:r=>who(r._who)},
    {k:'_ship',label:'Ship to'},
    {k:'On rent',label:'On rent',html:r=>r['On rent']?`<b>${r['On rent']}</b>`:'0'}
   ],
   filters:[{k:'_active',label:'Status'}]
  }));
 },
 spend(){head('Rental Spend');if(!Auth.isAdmin){app.insertAdjacentHTML('beforeend','<p>Admins only.</p>');return}
  const box=document.createElement('div');box.id='spendbox';box.innerHTML='<p class="s">Loading admin spend…</p>';app.append(box);
  (async()=>{
   let S=null;try{S=await Auth.adminSpend()}catch(e){box.innerHTML=`<p class="warn">Could not load spend: ${esc(e.message)}</p>`;return}
   if(!S){box.innerHTML='<p class="warn">No admin spend published yet (rebuild + publish admin_spend).</p>';return}
   const yr=state.spendYear||'all';
   const pick=(row)=>{if(yr==='all'||!row.years)return row;const y=row.years[yr];if(!y)return {...row,Rentals:0,'Rental days':0,Spend:0,'Avg monthly spend':0,'Peak units':0,Lines:0,'No invoice':0,'Zero invoice':0};
    return {...row,Rentals:y.Rentals,'Rental days':y['Rental days'],Spend:y.Spend,'Avg monthly spend':y['Avg monthly spend']||0,'Peak units':y['Peak units']||0,Lines:y.Lines,'No invoice':y['No invoice']||0,'Zero invoice':y['Zero invoice']||0}};
   const years=S.years||[];const all=S.all_time||{};
   box.innerHTML='';
   const top=document.createElement('div');top.className='kpis';
   top.innerHTML=[['known rental spend (all time)',usd2(all.spend)],['rental orders (OR/OE)',all.rentals],['rental days',all.rental_days.toLocaleString()],['avg / month (lifetime)',usd2(all.avg_monthly_spend)]]
     .map(([l,v])=>`<div class="kpi"><b>${v}</b><span>${l}</span></div>`).join('');
   box.append(top);
   const yc=document.createElement('div');yc.className='kpis';
   yc.innerHTML=years.map(y=>`<div class="kpi"><b>${usd2(y.spend)}</b><span>${y.year}${y.year===new Date().getFullYear()?' YTD':''} · ${y.rentals} rentals · ${y.rental_days.toLocaleString()} days<br>avg ${usd2(y.avg_monthly_spend)}/mo</span></div>`).join('');
   box.append(yc);
   // Year filter
   const filt=document.createElement('div');filt.className='qf';
   filt.innerHTML=[['all','All time'],...years.map(y=>[String(y.year),String(y.year)+(y.year===new Date().getFullYear()?' YTD':'')])].map(([v,l])=>`<button class="${yr===v?'on':''}" data-y="${v}">${l}</button>`).join('');
   filt.querySelectorAll('button').forEach(b=>b.onclick=()=>{state.spendYear=b.dataset.y;render()});
   box.append(filt);
   const models=(S.by_model||[]).map(pick).filter(r=>r.Lines||r.Rentals||r.Spend).sort((a,b)=>b.Spend-a.Spend);
   box.append(listView('spend_models',models,{title:'Spend by model',what:'model',sort:'Spend',dir:-1,
    cols:[{k:'Model',html:r=>`<b>${esc(r.Model)}</b>`},{k:'Rentals'},{k:'Rental days',label:'Days'},{k:'Spend',v:r=>r.Spend,html:r=>`<b>${usd2(r.Spend)}</b>`},
     {k:'Avg monthly spend',label:'Avg / mo',v:r=>r['Avg monthly spend'],html:r=>usd2(r['Avg monthly spend'])},{k:'Peak units',label:'Most out at once'}]}));
   const people=(S.by_person||[]).map(pick).filter(r=>r.Lines||r.Rentals||r.Spend).sort((a,b)=>b.Spend-a.Spend);
   box.append(listView('spend_people',people,{title:'Spend by person',what:'person',sort:'Spend',dir:-1,
    cols:[{k:'Key',label:'Person',html:r=>who(r.Key)},{k:'Rentals'},{k:'Rental days',label:'Days'},{k:'Spend',v:r=>r.Spend,html:r=>`<b>${usd2(r.Spend)}</b>`},{k:'Lines'}]}));
   // Jobs view (resolved job names; Unassigned last)
   const pickJob=row=>{if(yr==='all'||!row.years)return row;const y=row.years[yr];if(!y)return {...row,Rentals:0,'Rental days':0,Spend:0,'Items rented':0,'Ordered by summary':'',Lines:0};
    return {...row,Rentals:y.Rentals,'Rental days':y['Rental days'],Spend:y.Spend,'Items rented':y['Items rented']||0,'Ordered by summary':y['Ordered by summary']||'',Lines:y.Lines}};
   const jobs=(S.jobs||[]).map(pickJob).filter(r=>r.Lines||r.Rentals||r.Spend);
   const cov=S.job_coverage||{};
   const covEl=document.createElement('p');covEl.className='s';
   covEl.innerHTML=`Job assignment: <b>${usd2(cov.assigned_spend)}</b> of <b>${usd2(cov.total_spend)}</b> (`+
    `${cov.assigned_pct||0}%) linked to a job`+
    (cov.inferred_spend!=null?` · <b>${usd2(cov.inferred_spend)}</b> of that was inferred (order copy / ship-to / Desktop)`:'')+
    `. Unmatched stay <b>Unassigned</b> — never guessed.`+
    (cov.job_meta&&cov.job_meta.desktop_status==='offline'?' <span class="pill amber">Desktop offline</span>':'');
   box.append(covEl);
   box.append(listView('spend_jobs',jobs,{title:'Spend by job',what:'job',sort:'Spend',dir:-1,
    cols:[{k:'Job',html:r=>r.Job==='Unassigned'?`<span class="pill amber">Unassigned</span>`:`<b>${esc(r.Job)}</b>`},
     {k:'Rentals'},{k:'Rental days',label:'Days'},{k:'Spend',v:r=>r.Spend,html:r=>`<b>${usd2(r.Spend)}</b>`},
     {k:'Items rented',label:'Items'},{k:'Ordered by summary',label:'Who ordered'}],
    filters:[{k:'Job'}]}));
   // Order-level table with job filter
   let orders=(S.orders||[]).slice();
   if(yr!=='all')orders=orders.filter(o=>String(o.Year)===String(yr));
   box.append(listView('spend_orders',orders,{title:'Orders (who + job)',what:'order',sort:'Date',dir:-1,
    open:r=>typeof openOrder==='function'?openOrder(r.Order):null,
    cols:[{k:'Order',html:r=>oLink(r.Order)},{k:'Date'},{k:'Ordered by',html:r=>who(r['Ordered by'])},
     {k:'Job',html:r=>r.Job==='Unassigned'?`<span class="pill amber">Unassigned</span>`:esc(r.Job)},
     {k:'Source',html:r=>pill(r.Source,r.Source==='Intellirent'?'green':(r.Source||'').startsWith('inferred')?'amber':'')},
     {k:'Ship to'},{k:'Items'},{k:'Spend',v:r=>r.Spend,html:r=>`<b>${usd2(r.Spend)}</b>`}],
    filters:[{k:'Job'},{k:'Ordered by'},{k:'Source'}]}));
   if(S.service){const sv=S.service;box.append(fold('Service / calibration (excluded from rental spend)',Object.assign(document.createElement('p'),{className:'s',
    innerHTML:`${sv.orders||0} service orders · ${sv.lines||0} lines · invoiced ${usd2(sv.spend||0)}. ${esc(sv.note||'')}`})))}
   const cc=S.cross_check||{};
   box.append(fold('Source & cross-check',Object.assign(document.createElement('p'),{className:'s',innerHTML:
    `Source: Intellirent rental history (OR/OE only). Built ${esc(S.built||'')}. Known spend <b>${usd2(cc.history_known_spend)}</b> across <b>${cc.history_orders}</b> orders.`+
    (cc.explanation?`<br>${esc(cc.explanation)}`:'')+
    `<br>Sales (OS) and service/cal (SR/SRV) are excluded. Blank and $0 invoice lines add nothing to spend (never estimated).`+
    `<br>Jobs: Intellirent job field first; else ORDER COPIES Job # / Dropbox JOBS folder order PDFs; else ship-to only when that address already maps uniquely (≥2 orders); Desktop JOB FOLDERS when the PC is online. Otherwise Unassigned.`})));
   Combo.scan();
  })();
 },

 admin(){head('Admin');if(!Auth.isAdmin){app.insertAdjacentHTML('beforeend','<p>Admins only.</p>');return}
  const SUB=[['users','Users'],['colors','Employee colors'],['data','Data status'],['pdfs','Order PDFs']];const cur=SUB.some(x=>x[0]===state.adminSub)?state.adminSub:'users';
  const b=document.createElement('div');b.className='qf adm';b.innerHTML=SUB.map(([k,l])=>`<button class="${k===cur?'on':''}" data-s="${k}">${l}</button>`).join('');
  b.querySelectorAll('button').forEach(x=>x.onclick=()=>{state.adminSub=x.dataset.s;render()});app.append(b);
  if(!Auth.live&&cur!=='data')app.insertAdjacentHTML('beforeend','<p class="warn">Offline / local copy: this admin feature needs the live site (Supabase backend). Shown read-only.</p>');
  const box=document.createElement('div');box.className='admbox';app.append(box);A[cur](box)},
 account(){head('Account');app.insertAdjacentHTML('beforeend',`<p>Signed in as <b>${esc(Auth.email)}</b> · role <b>${esc(Auth.role)}</b></p><div class="row">${pwField('mypw','New password (10+)')}<button class="sec" id="cpw">Change my password</button><button class="sec" id="sout">Sign out</button></div>`);
  bindPw(app);document.getElementById('sout').onclick=Auth.signOut;document.getElementById('cpw').onclick=async()=>{try{await Auth.changePw(document.getElementById('mypw').value);toast('Password changed')}catch(e){toast(e.message)}}}
};
const pwField=(id,ph)=>`<span class="pwf"><input id="${id}" type="password" placeholder="${ph}" minlength="10" autocomplete="new-password"><button type="button" class="sec sm pwt" data-for="${id}" aria-label="Show password">Show</button></span>`;
function bindPw(root){root.querySelectorAll('.pwt').forEach(b=>b.onclick=()=>{const i=document.getElementById(b.dataset.for);const show=i.type==='password';i.type=show?'text':'password';b.textContent=show?'Hide':'Show'})}
async function act(action,body,ok){if(body.password!==undefined&&body.password.length<10)return toast('Password must be 10+ characters');
 if(!Auth.live)return toast('Needs the live site');try{await Auth.admin(action,body);toast(ok);render()}catch(e){toast('Failed: '+e.message)}}
/* ---------- Admin sub-views ---------- */
const COLORDEF=n=>{const k=pKey(n);let h=0;for(const c of k)h=(h*31+c.charCodeAt(0))>>>0;return PERSON_COLORS[k]||PAL[h%PAL.length]};
function peopleSeen(){const c={};const add=n=>{if(blank(n))return;const k=pKey(n);if(NOPERSON.test(k)||/^(OFFICE|LEASE|DAMAGED)/.test(k))return;c[n]=(c[n]||0)+1};
 (D.equipment||[]).forEach(e=>add(e.Holder));(D.tech||[]).forEach(r=>add(r.Technician));(D.roster||[]).forEach(r=>add(r.Employee));
 R.forEach(r=>{add(r['Placed by']);add(r['Who (ordered by)'])});(D.orders||[]).forEach(o=>add(o['Ordered by']));(D.board||[]).forEach(r=>add(r['Ordered By']));(D.order_list||[]).forEach(r=>add(r['Ordered By']));return c}
const A={
 async users(box){
  box.innerHTML=`<h2>Add user</h2><div class="bar"><input id="nu_e" type="email" placeholder="Email" autocomplete="off"><input id="nu_n" placeholder="Name (optional)">
   ${pwField('nu_p','Password (10+ chars)')}<label class="fl"><span>Role</span><select id="nu_r" data-plain><option>user</option><option>admin</option><option>pending</option></select></label><button id="nu_go">Add user</button></div>
   <p class="s">Roles: <b>admin</b> = data + Admin tab, <b>user</b> = data only, <b>pending</b> = no access (use to revoke). Admin-added users are pre-confirmed and sign in with the password you set. Disabled users cannot sign in.</p><h2>Users</h2><div id="ul">Loading…</div>`;
  bindPw(box);
  box.querySelector('#nu_go').onclick=()=>act('create',{email:box.querySelector('#nu_e').value.trim(),name:box.querySelector('#nu_n').value.trim(),password:box.querySelector('#nu_p').value,role:box.querySelector('#nu_r').value},'User added');
  if(!Auth.live){box.querySelector('#ul').textContent='(no backend - open the live site)';box.querySelectorAll('input,button,select').forEach(e=>e.disabled=true);return}
  try{const {users}=await Auth.admin('list');const me=Auth.email;
   box.querySelector('#ul').innerHTML=`<div class="tw"><table class="utab"><thead><tr><th>Name / email</th><th>Role</th><th>Last sign-in</th><th>Password</th><th></th></tr></thead><tbody>${users.map(p=>{const dis=p.banned_until&&new Date(p.banned_until)>new Date();const self=p.email===me;
    return `<tr class="ucard" data-uid="${p.id}" data-em="${esc(p.email)}"><td data-l="User"><b>${esc(p.name||'—')}</b> ${p.role==='pending'?'<span class="pill amber">NEEDS APPROVAL</span>':''}${dis?'<span class="pill red">DISABLED</span>':''}${self?'<span class="pill green">you</span>':''}<div class="s">${esc(p.email)}</div></td>
     <td data-l="Role"><select data-plain class="u_role" ${self?'disabled title="You cannot change your own role"':''}>${['admin','user','pending'].map(r=>`<option ${r===p.role?'selected':''}>${r}</option>`).join('')}</select></td>
     <td data-l="Last sign-in" class="s">${p.last_sign_in_at?fmtT(p.last_sign_in_at):'never'}</td>
     <td data-l="Password"><span class="row">${pwField('pw_'+p.id,'New password (10+)')}<button class="sec sm u_pw">Set</button></span></td>
     <td>${self?'':`<span class="row"><button class="sec sm u_dis">${dis?'Enable':'Disable'}</button><button class="sec sm danger u_del">Delete</button></span>`}</td></tr>`}).join('')}</tbody></table></div>`;
   bindPw(box);
   box.querySelectorAll('.ucard').forEach(c=>{const id=c.dataset.uid,em=c.dataset.em;
    c.querySelector('.u_role').onchange=e=>{if(confirm(`Change ${em} to ${e.target.value}?`))act('set_role',{user_id:id,role:e.target.value},'Role updated');else render()};
    c.querySelector('.u_pw').onclick=()=>act('set_password',{user_id:id,password:c.querySelector('#pw_'+CSS.escape(id)).value},'Password set for '+em);
    const d=c.querySelector('.u_dis');if(d)d.onclick=()=>{if(confirm(`${d.textContent} ${em}?`))act(d.textContent==='Disable'?'disable':'enable',{user_id:id},'Done')};
    const r=c.querySelector('.u_del');if(r)r.onclick=()=>{if(confirm(`Delete ${em} permanently? This cannot be undone.`))act('delete',{user_id:id},'User deleted')}})}
  catch(e){box.querySelector('#ul').textContent='Failed: '+e.message}},
 colors(box){const seen=peopleSeen();const rows=[...PC_ROWS.map(r=>({...r}))];const known=new Set();rows.forEach(r=>{known.add(pKey(r.name));(r.aliases||[]).forEach(a=>known.add(pKey(a)))});
  const unmapped=Object.keys(seen).filter(n=>!known.has(pKey(n))).sort();
  const cnt=r=>[r.name,...(r.aliases||[])].reduce((a,n)=>a+Object.entries(seen).filter(([k])=>pKey(k)===pKey(n)).reduce((x,[,v])=>x+v,0),0);
  box.innerHTML=`<p class="s">One row per person. Aliases (comma-separated) map other spellings - e.g. ALLISTER, Allister Moreno - to the same person and color. Saved to Supabase (everyone sees it on next load). Blank color = automatic default.</p>
   <div class="tw"><table class="ctab"><thead><tr><th>Person</th><th>Color</th><th>Aliases</th><th>Rows</th><th></th></tr></thead><tbody>${rows.map((r,i)=>`<tr data-i="${i}"><td data-l="Person"><span class="who" style="--pc:${r.color||COLORDEF(r.name)}">${esc(r.name)}</span></td>
    <td data-l="Color"><input type="color" class="c_col" value="${r.color||COLORDEF(r.name)}"> <button class="sec sm c_def" ${r.color?'':'disabled'}>Default</button></td>
    <td data-l="Aliases"><input class="c_al" value="${esc((r.aliases||[]).join(', '))}" placeholder="e.g. FIRST, Other Spelling"></td><td data-l="Rows" class="s">${cnt(r)}</td>
    <td><span class="row"><button class="sm c_save">Save</button><button class="sec sm danger c_del">Remove</button></span></td></tr>`).join('')}</tbody></table></div>
   <h3>Add person / alias</h3><div class="bar"><input id="np_n" placeholder="Person (canonical name)"><input type="color" id="np_c" value="#3949ab"><input id="np_a" placeholder="Aliases, comma-separated"><button id="np_go">Add</button></div>
   ${unmapped.length?`<h3>Names in the data not mapped yet (${unmapped.length})</h3><p class="s">Tap to add as a person, or copy into another person's aliases.</p><div class="legend">${unmapped.map(n=>`<button class="sec sm um" data-n="${esc(n)}">${esc(n)} <small>${seen[n]}</small></button>`).join(' ')}</div>`:''}`;
  const live=Auth.live;if(!live)box.querySelectorAll('input,button').forEach(e=>e.disabled=true);
  const save=async(row,msg)=>{try{await Auth.saveColor(row);setPersonColors(await Auth.colors());toast(msg||'Saved');render()}catch(e){toast('Failed: '+e.message)}};
  const al=v=>v.split(',').map(x=>x.trim()).filter(Boolean);
  box.querySelectorAll('tbody tr').forEach(tr=>{const r=rows[+tr.dataset.i];let dirty=false;tr.querySelector('.c_col').oninput=e=>{dirty=true;tr.querySelector('.who').style.setProperty('--pc',e.target.value)};
   tr.querySelector('.c_save').onclick=()=>save({name:r.name,color:dirty?tr.querySelector('.c_col').value:(r.color||null),aliases:al(tr.querySelector('.c_al').value)},'Saved '+r.name);
   tr.querySelector('.c_def').onclick=()=>save({name:r.name,color:null,aliases:r.aliases||[]},'Reset '+r.name);
   tr.querySelector('.c_del').onclick=async()=>{if(!confirm(`Remove ${r.name} and its aliases?`))return;try{await Auth.delColor(r.name);setPersonColors(await Auth.colors());render()}catch(e){toast('Failed: '+e.message)}}});
  box.querySelector('#np_go').onclick=()=>{const n=box.querySelector('#np_n').value.trim();if(!n)return toast('Enter a name');save({name:n,color:box.querySelector('#np_c').value,aliases:al(box.querySelector('#np_a').value)},'Added '+n)};
  box.querySelectorAll('.um').forEach(b=>b.onclick=()=>{box.querySelector('#np_n').value=b.dataset.n;box.querySelector('#np_n').focus()})},
 data(box){const ds=[['Equipment',D.equipment],['Live Rentals (lines)',D.rentals],['Intellirent orders',D.orders],['Order list',D.order_list],['Order board',D.board],['Tech assignments',D.tech],['Tech replies',D.tech_replies],['Employee roster',D.roster],['Certs needed',D.certs_needed],['Quotes',D.quotes],['Data gaps',D.gaps]];
  box.innerHTML=`<div class="kpis"><div class="kpi"><b>${fmtT(D.built)||'?'}</b><span>last snapshot / refresh</span></div><div class="kpi ${D.gaps&&D.gaps.length?'warnk':''}"><b>${(D.gaps||[]).length}</b><span>data gaps</span></div></div>
   <h3>Row counts</h3><div class="tw"><table><thead><tr><th>Dataset</th><th>Rows</th></tr></thead><tbody>${ds.map(([n,a])=>`<tr><td>${n}</td><td>${(a||[]).length.toLocaleString('en-US')}</td></tr>`).join('')}</tbody></table></div>`;
  box.append(fold('Sources & data gaps',sourcesEl(),true))},
 async pdfs(box){const O=Object.values(OI).filter(x=>/^(?:O[RSE]|SRV?|RSR?)/.test(x.no));const w=O.filter(x=>x.pdfs.length),wo=O.filter(x=>!x.pdfs.length);
  const files=PDFX?Object.values(PDFX).reduce((a,v)=>a+v.length,0):null;
  box.innerHTML=`<div class="kpis"><div class="kpi"><b>${w.length}</b><span>orders with a PDF</span></div><div class="kpi warnk"><b>${wo.length}</b><span>orders without a PDF</span></div><div class="kpi"><b>${files??'—'}</b><span>files in order-pdfs bucket${files==null?' (live only)':''}</span></div></div>
   <h3>Upload order PDFs</h3><p class="s">Name files <b>OR######.pdf</b> (extra copies <b>OR######_2.pdf</b>; OE/OS/SR/SRV/RSR too). They go to the private <b>order-pdfs</b> bucket and show on the order right away - no rebuild.</p>
   <div class="bar"><input type="file" id="pf" accept="application/pdf,.pdf" multiple><label class="fl"><span>If exists</span><select id="pov" data-plain><option value="">Skip</option><option value="1">Overwrite</option></select></label><button id="pgo">Upload</button></div><div id="plog"></div>
   <h3>Orders without a PDF</h3>`;
  box.append(listView('nopdf',wo,{what:'order #',open:x=>openOrder(x.no),sort:'Date',dir:-1,cols:[{k:'no',label:'Order',html:x=>oLink(x.no)},{k:'date',label:'Date',v:x=>x.date},{k:'who',label:'Who',html:x=>who(x.who)},{k:'status',label:'Status'}],filters:[{k:'type',label:'Type'},{k:'year',label:'Year',v:x=>String(x.date).slice(0,4)}]}));
  if(!Auth.live){box.querySelectorAll('#pf,#pov,#pgo').forEach(e=>e.disabled=true);return}
  box.querySelector('#pgo').onclick=async()=>{const fs=[...box.querySelector('#pf').files];const log=box.querySelector('#plog');if(!fs.length)return toast('Choose PDF file(s)');
   const ov=!!box.querySelector('#pov').value;let ok=0;log.innerHTML='';
   for(const f of fs){const n=f.name.trim().toUpperCase().replace(/\.PDF$/,'.pdf');const line=t=>log.insertAdjacentHTML('beforeend',`<p class="s">${esc(t)}</p>`);
    if(!/^(?:O[RSE]\d{6}|SRV\d{5}|SR\d{6}|RSR\d{5}|RS\d{6})(_\d+)?\.pdf$/.test(n)){line(`✗ ${f.name}: name must be OR######.pdf (or OE/OS/SR/SRV/RSR)`);continue}
    if(f.size>25e6){line(`✗ ${n}: larger than 25 MB`);continue}
    try{await Auth.pdfUpload(n,f,ov);ok++;line(`✓ ${n} uploaded`)}catch(e){line(`✗ ${n}: ${/exists|Duplicate/i.test(e.message)?'already exists (choose Overwrite)':e.message}`)}}
   if(ok){await loadPdfIndex();prep();toast(ok+' PDF(s) uploaded');const keep=log.innerHTML;render();const l2=document.getElementById('plog');if(l2)l2.innerHTML=keep}}}
};
async function loadPdfIndex(){if(!Auth.live)return;try{const L=await Auth.pdfList();PDFX={};L.forEach(f=>{const m=/^(O[RSE]\d{6}|SRV\d{5}|RSR\d{5}|SR\d{6}|RS\d{6})/.exec(f.name);if(m)(PDFX[m[1]]=PDFX[m[1]]||[]).push(f.name)})}catch(e){PDFX=null}}
function toast(t){const d=document.createElement('div');d.className='toast';d.textContent=t;document.body.append(d);setTimeout(()=>d.remove(),2500)}
function sourcesEl(){const d=document.createElement('div');
 d.innerHTML=`<h3>Sources</h3>${(D.sources||[]).map(s=>`<div class="line"><b>${esc(s.Source)}</b><div class="lm">${esc(fmtT(s.dropbox_modified||s.file_modified||s.fetched||''))}${s.present===false?' · not present':''}</div></div>`).join('')}
  <h3>Data gaps (${D.gaps.length})</h3>${D.gaps.map(g=>`<p class="s">${linkOrders(g)}</p>`).join('')}`;return d}

/* ---------- global search ---------- */
function gsets(){return [['Orders','o',Object.values(OI),x=>`${x.no} · ${x.type} · ${x.who} · ${x.where} · ${x.status}`,x=>openOrder(x.no)],
 ['Live Rentals','r',R,r=>`${r.Item} · ${r.Order} · ${isOn(r)?'On rent':'Returned'}`,openRental],['Equipment','e',D.equipment,r=>`${r.Unit} · ${r.Model} · S/N ${r.Serial} · ${r.Holder} · ${r.Status}`,openUnit],
 ['Tech Assignments','t',D.tech,r=>`${r.Technician} · ${r['Item / note']}`,r=>openRow(r.Technician,r)],['Tech Replies','tr',D.tech_replies,r=>Object.values(r)[0]+' · '+(Object.values(r)[1]||''),r=>openRow(Object.values(r)[0],r)],
 ['Certs Needed','c',D.certs_needed,r=>`${r['Unit ID']} · ${r['Make / Model']} · ${r.Category}`,r=>openRow(r['Unit ID'],r)]]}
function gsearch(q){const el=document.getElementById('gres');if(!el)return;const terms=q.toLowerCase().split(/\s+/).filter(Boolean);if(!terms.length){el.innerHTML='<p class="s">Searches orders, rentals, equipment, techs, replies and certs needed.</p>';return}
 let html='',total=0;const map={};for(const [name,id,rows,lab,open] of gsets()){const hits=rows.filter(r=>{const s=(lab(r)+' '+JSON.stringify(r,(k,v)=>k.startsWith('_')||k==='lines'?undefined:v)).toLowerCase();return terms.every(w=>s.includes(w))});if(!hits.length)continue;total+=hits.length;map[id]=[hits,open];
  html+=`<h3>${esc(name)} <span class="s">(${hits.length})</span></h3>`+hits.slice(0,25).map((r,i)=>`<div class="hit" data-g="${id}" data-i="${i}">${linkOrders(lab(r))}</div>`).join('')+(hits.length>25?`<p class="s">+${hits.length-25} more - refine the search</p>`:'')}
 el.innerHTML=total?html:'<p>No matches.</p>';
 el.querySelectorAll('.hit').forEach(h=>h.onclick=e=>{if(e.target.closest('a.ord'))return;const [hits,open]=map[h.dataset.g];open(hits[+h.dataset.i])})}
document.getElementById('gq').addEventListener('input',e=>{if(techOnly())return;if(tab!=='search'){tab='search';render()}else gsearch(e.target.value);const g=document.getElementById('gs');if(g&&document.activeElement!==e.target)g.value=e.target.value});
document.getElementById('gq').addEventListener('keydown',e=>{if(techOnly())return;if(e.key==='Enter'){tab='search';render()}});
let rz;window.addEventListener('resize',()=>{clearTimeout(rz);const w=narrow();rz=setTimeout(()=>{if(w!==window._nw){window._nw=w;if(D)render()}},200)});

(async()=>{D=await Auth.start();if(Auth.live){await Promise.all([Auth.colors().then(r=>{if(r.length)setPersonColors(r)}).catch(()=>{}),loadPdfIndex()])}prep();window._nw=narrow();document.getElementById('who').innerHTML=Auth.live?`<button class="sec sm" onclick="Auth.signOut()">Sign out</button>`:'';if(!(location.hash||'').slice(1)){tab='myeq';location.hash='myeq'}document.body.classList.toggle('tech-only',techOnly());render();fromHash();
 setInterval(()=>{if(tab==='rentals'&&document.getElementById('panel').hidden&&!document.activeElement.matches('input,select')){prep();render()}},6*3600e3)})();
window.addEventListener('hashchange',()=>{if(!D)return;if(fromHash())return;closePanel();const t=location.hash.slice(1);if(t&&!/=/.test(t)&&t!==tab){tab=t;render()}});
window.addEventListener('popstate',()=>{if(!D)return;if(!/^#(order|unit|rental|job)=/.test(location.hash)){const p=document.getElementById('panel');if(!p.hidden){p.hidden=true;p.innerHTML='';document.body.classList.remove('noscroll')}}else fromHash()});
// mark scroll areas that are at their right end (or don't overflow) so the fade hides
(()=>{const upd=el=>el.classList.toggle('end',el.scrollLeft+el.clientWidth>=el.scrollWidth-2);
const all=()=>document.querySelectorAll('.tw,nav').forEach(upd);
document.addEventListener('scroll',e=>{const t=e.target;if(t.classList&&(t.matches('.tw')||t.matches('nav')))upd(t)},true);
addEventListener('resize',all);new MutationObserver(()=>requestAnimationFrame(all)).observe(document.documentElement,{childList:true,subtree:true});all()})();
