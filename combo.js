'use strict';
/* Searchable combobox: every <select> (unless data-plain) becomes tap-to-open + type-to-filter, and
   Combo.attach(input, optionsFn) adds the same list to free-text inputs. The original <select>/<input> stays in
   the DOM and keeps the value, so reading .value, change/input listeners and saving are unchanged. */
const Combo=(()=>{
 const lc=s=>String(s==null?'':s).toLowerCase();
 const loose=s=>lc(s).replace(/[^a-z0-9]/g,'').replace(/([a-z])0+(?=\d)/g,'$1'); // "UT14" ~ "UT014"
 const reEsc=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
 const numCmp=(a,b)=>String(a).localeCompare(String(b),undefined,{numeric:true});
 let pop=null,cur=null,uid=0;
 const valSet=Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value');

 /* ---- matching: every typed word must match (plain substring, or loosely ignoring punctuation / zero padding) ---- */
 function rank(o,q){const terms=lc(q).trim().split(/\s+/).filter(Boolean);if(!terms.length)return 0;
  const L=lc(o.label),all=L+' '+lc(o.search||''),Ll=loose(o.label),alll=loose(o.label+' '+(o.search||''));let r=0;
  for(let i=0;i<terms.length;i++){const t=terms[i],tl=loose(t);let s;
   if(L.startsWith(t)||(tl&&Ll.startsWith(tl)))s=0;
   else if(new RegExp('(^|[^a-z0-9])'+reEsc(t)).test(L))s=1;
   else if(L.includes(t)||(tl&&Ll.includes(tl)))s=2;
   else if(all.includes(t)||(tl&&alll.includes(tl)))s=3;
   else return -1;
   if(i===0)r=s;else r=Math.max(r,Math.min(s,2))}
  return r}

 function ensurePop(){if(pop)return pop;pop=document.createElement('div');pop.className='cb-pop';pop.setAttribute('role','listbox');pop.hidden=true;pop.id='cb-pop';
  pop.addEventListener('mousedown',e=>e.preventDefault()); // keep focus in the input so a tap never blurs before click
  pop.addEventListener('click',e=>{const r=e.target.closest('.cb-o');if(!r||!cur)return;const it=cur.items[+r.dataset.i];if(it&&!it.none)choose(it,true)});
  document.body.append(pop);return pop}

 /* ---- options ---- */
 function allOpts(c){
  if(c.sel){return Array.from(c.sel.options).map(o=>({value:o.value,label:o.textContent,short:o.dataset.short,search:o.dataset.s||'',blank:o.value==='',action:o.value.slice(0,2)==='__'}))}
  const seen=new Set();return c.opts().map(String).filter(s=>s!==''&&!seen.has(s)&&seen.add(s)).map(s=>({value:s,label:s}))}
 function build(c){
  const q=c.typed?c.el.value:'',opts=allOpts(c);let items=[];
  const blank=opts.find(o=>o.blank),acts=opts.filter(o=>o.action),norm=opts.filter(o=>!o.blank&&!o.action);
  const m=norm.map((o,i)=>({o,i,r:rank(o,q)})).filter(x=>x.r>=0).sort((a,b)=>a.r-b.r||a.i-b.i).map(x=>x.o);
  if(blank&&(!q.trim()||rank({label:blank.label},q)>=0))items.push({...blank,cls:'blank',label:blank.label||'(none)'});
  items.push(...m);
  if(!c.sel&&c.add&&q.trim()&&!norm.some(o=>lc(o.label)===lc(q.trim())))items.push({value:q.trim(),label:c.add+' “'+q.trim()+'”',cls:'add',useText:true});
  if(!m.length&&!(blank&&items.length)&&!(c.add&&q.trim()))items.push({none:true,cls:'none',label:'No matches'});
  acts.forEach(o=>items.push({...o,cls:'add'}));
  c.items=items;
  const curVal=c.sel?c.sel.value:c.el.value;
  c.active=c.typed&&c.sel?items.findIndex(i=>!i.none&&!i.blank&&!i.action):items.findIndex(i=>!i.none&&!i.useText&&!i.action&&i.value===curVal&&(c.sel?true:lc(i.value)===lc(curVal)));
  if(c.typed&&c.sel&&c.active<0)c.active=items.findIndex(i=>!i.none);
  if(c.typed&&!c.sel)c.active=-1;
  return items}
 function paint(c,scroll){ensurePop();const curVal=c.sel?c.sel.value:c.el.value;
  pop.innerHTML='';items:for(let i=0;i<c.items.length;i++){const it=c.items[i],d=document.createElement('div');
   d.className='cb-o '+(it.cls||'')+(i===c.active?' act':'')+(!it.none&&!it.useText&&!it.action&&it.value===curVal&&(c.sel||true)&&it.value!==''?' sel':'');
   d.id='cb-o'+i;d.dataset.i=i;d.setAttribute('role','option');d.textContent=it.label;pop.append(d)}
  c.el.setAttribute('aria-activedescendant',c.active>=0?'cb-o'+c.active:'');
  if(scroll)keepVisible()}
 function keepVisible(){const a=pop.querySelector('.cb-o.act')||pop.querySelector('.cb-o.sel');if(!a)return;
  const t=a.offsetTop,b=t+a.offsetHeight;if(t<pop.scrollTop)pop.scrollTop=t;else if(b>pop.scrollTop+pop.clientHeight)pop.scrollTop=b-pop.clientHeight}

 /* ---- placement: below the field, or above it when there is no room; never taller than the visible area (keyboard aware) ---- */
 function place(){if(!cur||pop.hidden)return;if(!cur.el.isConnected)return close();
  const w=cur.wrap.getBoundingClientRect(),vv=window.visualViewport,vt=vv?vv.offsetTop:0,vl=vv?vv.offsetLeft:0,vh=vv?vv.height:innerHeight,vw=vv?vv.width:innerWidth;
  const host=cur.el.closest('dialog');if(pop.parentNode!==(host||document.body))(host||document.body).append(pop);
  let bottom=vt+vh;const nav=document.querySelector('nav');
  if(!host&&nav&&getComputedStyle(nav).position==='fixed'){const nt=nav.getBoundingClientRect().top;if(nt>w.bottom)bottom=Math.min(bottom,nt)}
  const below=bottom-w.bottom-8,above=w.top-vt-8,up=below<220&&above>below;
  const max=Math.max(110,Math.min(400,up?above:below));
  const width=Math.min(Math.max(w.width,200),vw-16);let left=Math.min(Math.max(w.left,vl+8),vl+vw-width-8);
  Object.assign(pop.style,{maxHeight:max+'px',width:width+'px',left:left+'px',top:'0px'});
  const h=pop.offsetHeight;pop.style.top=Math.round(up?Math.max(vt+4,w.top-h-4):w.bottom+4)+'px';pop.classList.toggle('up',up)}

 /* ---- open / close / choose ---- */
 function open(c){if(cur&&cur!==c)close();cur=c;c.typed=c.typed&&document.activeElement===c.el;ensurePop();build(c);
  pop.hidden=false;pop.setAttribute('aria-label',c.label||'Options');c.wrap.classList.add('open');c.el.setAttribute('aria-expanded','true');paint(c,true);place();keepVisible();place()}
 function close(revert){if(!cur)return;const c=cur;cur=null;if(pop)pop.hidden=true;c.wrap.classList.remove('open');c.el.setAttribute('aria-expanded','false');c.typed=false;if(revert&&c.sel)c.sync();c.upd()}
 function choose(it,pointer){const c=cur;if(!c)return;
  if(c.sel){c.sel.value=it.value;c.sel.dispatchEvent(new Event('change',{bubbles:true}))}
  else{c.el.value=it.value;c.el.dispatchEvent(new Event('input',{bubbles:true}));c.el.dispatchEvent(new Event('change',{bubbles:true}))}
  close();c.sync();if(pointer&&matchMedia('(pointer:coarse)').matches)c.el.blur()}
 function commitTyped(c){ // on leaving the field: exact label match selects it, empty clears (when blank is allowed), otherwise revert
  if(!c.sel)return;const t=c.el.value.trim(),opts=allOpts(c);
  if(!t){const b=opts.find(o=>o.blank);if(b&&c.sel.value!==''){c.sel.value='';c.sel.dispatchEvent(new Event('change',{bubbles:true}))}return}
  const hit=opts.find(o=>!o.blank&&!o.action&&(lc(o.label)===lc(t)||lc(o.short)===lc(t)));
  if(hit&&hit.value!==c.sel.value){c.sel.value=hit.value;c.sel.dispatchEvent(new Event('change',{bubbles:true}))}}

 /* ---- wiring ---- */
 function make(el,sel,o){
  const wrap=document.createElement('span');wrap.className='cb'+(sel?' cb-sel':'');el.parentNode.insertBefore(wrap,sel||el);
  const input=sel?document.createElement('input'):el;
  if(sel){input.type='text';input.className=sel.className;sel.dataset.cb='1';sel.style.display='none';wrap.append(input,sel)}else{wrap.append(input);input.dataset.cb='1';input.removeAttribute('list')}
  const lab=(sel||input).previousElementSibling,lt=lab&&lab.tagName==='LABEL'?lab.textContent.trim():'';
  Object.assign(input,{autocomplete:'off',spellcheck:false});input.setAttribute('autocapitalize','off');input.setAttribute('autocorrect','off');input.setAttribute('enterkeyhint','done');
  input.setAttribute('role','combobox');input.setAttribute('aria-autocomplete','list');input.setAttribute('aria-expanded','false');input.setAttribute('aria-controls','cb-pop');if(lt)input.setAttribute('aria-label',lt);
  const x=document.createElement('button'),ar=document.createElement('button');
  [x,ar].forEach(b=>{b.type='button';b.tabIndex=-1;b.className='cb-btn';b.addEventListener('mousedown',e=>e.preventDefault())});
  x.classList.add('cb-x');x.textContent='✕';x.setAttribute('aria-label','Clear');ar.classList.add('cb-ar');ar.setAttribute('aria-label','Show list');
  wrap.append(x,ar);
  const c={el:input,sel,wrap,opts:o&&o.opts,add:o&&o.add,label:lt,items:[],active:-1,typed:false};
  c.upd=()=>{const has=sel?(sel.value!==''&&!!Array.from(sel.options).some(op=>op.value==='')):input.value!=='';wrap.classList.toggle('hasx',has)};
  c.sync=()=>{if(!sel){c.upd();return}if(cur===c&&c.typed)return;const op=sel.selectedOptions[0],blank=Array.from(sel.options).find(p=>p.value==='');
   input.value=op&&op.value!==''?(op.dataset.short||op.textContent):'';
   input.placeholder=blank?(blank.textContent.trim().length>1?blank.textContent.trim():'Tap or type to choose'):(sel.options.length?'Tap or type to choose':'No options');c.upd()};
  if(sel){const d=Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value');
   Object.defineProperty(sel,'value',{configurable:true,get(){return d.get.call(this)},set(v){d.set.call(this,v);c.sync()}});
   new MutationObserver(()=>c.sync()).observe(sel,{childList:true,subtree:true,attributes:true,attributeFilter:['selected']});c.sync()}
  else{if(!input.placeholder)input.placeholder='Type or tap to choose';c.upd()}
  input.addEventListener('focus',()=>{c.typed=false;open(c);setTimeout(()=>{try{input.setSelectionRange(0,input.value.length)}catch(e){}},0)});
  input.addEventListener('click',()=>{if(cur!==c)open(c)});
  input.addEventListener('input',()=>{c.typed=true;open(c);c.upd();if(!sel)c.wrap.classList.add('hasx')});
  input.addEventListener('blur',()=>{if(cur===c){close();commitTyped(c);c.sync()}});
  input.addEventListener('keydown',e=>{const k=e.key,isOpen=cur===c;
   if(k==='ArrowDown'||k==='ArrowUp'){e.preventDefault();if(!isOpen){open(c);return}const n=c.items.length;if(!n)return;let i=c.active,dir=k==='ArrowDown'?1:-1;
    for(let t=0;t<n;t++){i=(i+dir+n)%n;if(i<0)i=n-1;if(!c.items[i].none)break}c.active=i;paint(c,true);place()}
   else if(k==='Enter'){if(isOpen){e.preventDefault();const it=c.items[c.active];if(it&&!it.none)choose(it);else{close();commitTyped(c);c.sync()}}}
   else if(k==='Escape'){if(isOpen){e.preventDefault();e.stopPropagation();close(true);c.upd()}}
   else if(k==='Tab'&&isOpen){const it=c.items[c.active];if(c.sel&&c.typed&&it&&!it.none&&!it.blank&&!it.action&&it.value!==sel.value){choose(it)}}});
  ar.addEventListener('click',()=>{if(cur===c){close();return}input.focus();if(cur!==c)open(c)});
  x.addEventListener('click',()=>{if(sel){sel.value='';sel.dispatchEvent(new Event('change',{bubbles:true}))}else{input.value='';input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}))}
   close();c.sync();c.upd();if(document.activeElement===input&&!sel)open(c)});
  input._cb=c;return c}
 function enhance(sel){if(sel.dataset.cb||sel.multiple||sel.hasAttribute('data-plain'))return;make(sel,sel)}
 function attach(input,opts,o){if(!input||input.dataset.cb)return;make(input,null,{...(o||{}),opts})}
 function scan(){document.querySelectorAll('select:not([data-cb]):not([data-plain])').forEach(enhance);if(cur&&!cur.el.isConnected)close()}
 new MutationObserver(scan).observe(document.documentElement,{childList:true,subtree:true});
 document.addEventListener('DOMContentLoaded',scan);
 const rp=e=>{if(cur&&!(e&&e.target&&pop&&pop.contains&&e.target instanceof Node&&pop.contains(e.target)))place()};
 addEventListener('scroll',rp,true);addEventListener('resize',rp);if(window.visualViewport){visualViewport.addEventListener('resize',rp);visualViewport.addEventListener('scroll',rp)}
 document.addEventListener('cancel',e=>{if(cur)e.preventDefault()},true); // Esc closes the list, not the dialog
 return {attach,enhance,scan,close,rank,numCmp,get isOpen(){return !!cur}}
})();
