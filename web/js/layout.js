// Arrange: the 12-column board on each tab, drag to move and resize.
/* ---------- board layout ---------- */
// Each tab has its own board: a 12-column grid. Each box has a position and size in cells, kept per device
// (like the theme), so the wall tablet and a laptop can each have their own. Boxes float up to fill gaps and
// push others down when they would overlap. Phones show one column in the same order.
// Every box lives on one tab; the defaults fill a landscape tablet (about 8 rows under the header).
const COLS=12,LYK='fhd.layout2';
const WDEF={today:{tab:'today',x:0,y:0,w:6,h:8,mw:3,mh:2},soon:{tab:'today',x:6,y:0,w:6,h:5,mw:3,mh:2},rems:{tab:'today',x:6,y:5,w:6,h:3,mw:3,mh:2},
  bus:{tab:'bus',x:0,y:0,w:5,h:8,mw:3,mh:3},trips:{tab:'bus',x:5,y:0,w:7,h:8,mw:4,mh:3},tasks:{tab:'tasks',x:0,y:0,w:12,h:8,mw:3,mh:3},rw:{tab:'rw',x:0,y:0,w:12,h:8,mw:3,mh:2},
  wxw:{tab:'wx',x:0,y:0,w:12,h:5,mw:4,mh:3}};
const board=$('#board'),wEls=()=>[...board.querySelectorAll('.wgt')],wEl=id=>board.querySelector(`.wgt[data-w="${id}"]`);
const narrow=matchMedia('(max-width:699px)'),calm=matchMedia('(prefers-reduced-motion: reduce)');
const fit=({id,x,y,w,h})=>{const d=WDEF[id];w=Math.min(COLS,Math.max(d.mw,Math.round(w)||d.w));h=Math.min(40,Math.max(d.mh,Math.round(h)||d.h));
  return{id,w,h,x:Math.min(COLS-w,Math.max(0,Math.round(x)||0)),y:Math.max(0,Math.round(y)||0)}};
const hit=(a,b)=>a.x<b.x+b.w&&b.x<a.x+a.w&&a.y<b.y+b.h&&b.y<a.y+a.h;
// Settle boxes top to bottom, each as high as it fits. The box being moved or resized (lead) keeps its
// column; a box it overlaps goes first if the lead has moved past that box's middle, otherwise after it.
function settle(list,leadId,down){const L=list.map(b=>({...b})),lead=L.find(b=>b.id===leadId);
  const key=b=>{if(!lead)return b.y*2;if(b===lead)return b.y*2-1;if(!hit(b,lead))return b.y*2;
    const first=down?lead.y+lead.h<=b.y+b.h/2:lead.y<b.y+b.h/2;return first?Math.max(b.y*2,lead.y*2):Math.min(b.y*2,lead.y*2-2)};
  const K=new Map(L.map(b=>[b,key(b)]));L.sort((a,b)=>K.get(a)-K.get(b)||a.x-b.x);
  const out=[];for(const b of L){b.y=0;for(let c;(c=out.find(o=>hit(o,b)));)b.y=c.y+c.h;out.push(b)}return out}
function loadLayout(){let s=[];try{s=JSON.parse(localStorage.getItem(LYK)||'[]')}catch(e){}if(!Array.isArray(s))s=[];
  // Saved before Trips existed: give the Bus tab its new default so Trips sits beside the departures.
  if(s.some(b=>b?.id==='bus')&&!s.some(b=>b?.id==='trips'))s=s.filter(b=>b?.id!=='bus');
  const all=Object.keys(WDEF).map(id=>fit({...WDEF[id],...(s.find(b=>b&&b.id===id)||{}),id}));
  return[...new Set(Object.values(WDEF).map(d=>d.tab))].flatMap(t=>settle(all.filter(b=>WDEF[b.id].tab===t)))}
let layout=loadLayout(),arranging=false,drag=null,cellRows=0;
const shown=()=>settle(layout.filter(b=>!wEl(b.id).hidden));
function placeEls(L,from){const anim=arranging&&!calm.matches,els=wEls().filter(e=>!e.hidden);
  const before=anim?new Map(els.map(e=>[e,from?.el===e?from.rect:e.getBoundingClientRect()])):null,order=[...L].sort((a,b)=>a.y-b.y||a.x-b.x);
  for(const e of els){const b=L.find(v=>v.id===e.dataset.w);if(!b)continue;const s=e.style;
    s.setProperty('--c',b.x+1);s.setProperty('--r',b.y+1);s.setProperty('--w',b.w);s.setProperty('--h',b.h);s.setProperty('--o',order.indexOf(b))}
  if(anim)for(const e of els){if(drag?.el===e&&drag.mode==='move')continue;const a=before.get(e),n=e.getBoundingClientRect(),dx=a.left-n.left,dy=a.top-n.top;
    if(!dx&&!dy)continue;e.style.transition='none';e.style.transform=`translate(${dx}px,${dy}px)`;void e.offsetWidth;
    e.style.transition='transform .2s ease';e.style.transform='';e.addEventListener('transitionend',()=>e.style.transition='',{once:true})}
  drawCells(L)}
function drawCells(L){const rows=arranging?Math.max(8,...L.map(b=>b.y+b.h))+3:0;if(rows===cellRows)return;cellRows=rows;
  board.querySelectorAll('.cell').forEach(c=>c.remove());let h='';
  for(let r=1;r<=rows;r++)for(let c=1;c<=COLS;c++)h+=`<i class="cell" style="--c:${c};--r:${r}"></i>`;board.insertAdjacentHTML('afterbegin',h)}
// Rows stretch so that 8 rows fill the screen under the header (52px rows on a small screen).
const ROWS=8;
function sizeRows(){if(narrow.matches){board.style.gridAutoRows='';return}const cs=getComputedStyle(board),g=parseFloat(cs.rowGap)||16;
  const avail=innerHeight-(board.getBoundingClientRect().top+scrollY)-parseFloat(cs.paddingTop)-parseFloat(cs.paddingBottom)-$('footer.status').offsetHeight;
  const rh=Math.max(52,Math.min(110,Math.floor((avail-(ROWS-1)*g)/ROWS)))+'px';if(board.style.gridAutoRows!==rh)board.style.gridAutoRows=rh}
addEventListener('resize',()=>{sizeRows()});
function applyLayout(){if(!drag){sizeRows();placeEls(shown())}}
function commit(vis,from){layout=[...vis.map(fit),...layout.filter(b=>!vis.some(v=>v.id===b.id))];
  try{localStorage.setItem(LYK,JSON.stringify(layout))}catch(e){}placeEls(vis,from)}
function setArranging(on){arranging=!!on&&!narrow.matches;document.body.classList.toggle('arranging',arranging);$('#arrBar').hidden=!arranging;
  $('#arrBtn').setAttribute('aria-pressed',arranging);cellRows=-1;applyLayout()}
wEls().forEach(e=>e.insertAdjacentHTML('beforeend',`<div class="wcov" tabindex="0" role="button" aria-label="${esc(e.querySelector('h2').textContent)}. Drag to move, or use the arrow keys. Shift and arrow keys change the size."></div><div class="wrs" aria-hidden="true"></div>`));
$('#arrBtn').onclick=()=>setArranging(!arranging);$('#arrDone').onclick=()=>setArranging(false);
// Reset puts back the default layout of the tab that's showing; the other tabs keep theirs.
$('#arrReset').onclick=()=>commit(settle(shown().map(b=>fit({...WDEF[b.id],id:b.id}))));
narrow.addEventListener('change',()=>{if(narrow.matches)setArranging(false);applyLayout()});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&arranging&&!document.querySelector('.ov.on'))setArranging(false)});

// Drag the box to move it, drag the corner to resize. The box follows the finger; a dashed outline
// shows where it will land, and the others make room as it goes.
const setPh=b=>{const s=drag.ph.style;s.setProperty('--c',b.x+1);s.setProperty('--r',b.y+1);s.setProperty('--w',b.w);s.setProperty('--h',b.h)};
function pitch(){const cs=getComputedStyle(board),g=parseFloat(cs.columnGap)||16,rh=parseFloat(cs.gridAutoRows)||52;
  return{x:(board.clientWidth-parseFloat(cs.paddingLeft)-parseFloat(cs.paddingRight)+g)/COLS,y:rh+g}}
board.addEventListener('pointerdown',e=>{if(!arranging||drag||e.button>0)return;const h=e.target.closest('.wrs,.wcov');if(!h)return;
  const el=h.closest('.wgt'),base=shown(),b=base.find(v=>v.id===el.dataset.w);if(!b)return;
  e.preventDefault();h.setPointerCapture(e.pointerId);
  drag={el,id:b.id,mode:h.classList.contains('wrs')?'size':'move',pid:e.pointerId,sx:e.clientX,sy:e.clientY,b0:b,base,cur:base,t:b,p:pitch(),ph:null};
  el.classList.add('drag');if(drag.mode==='move'){drag.ph=document.createElement('div');drag.ph.className='wph';board.appendChild(drag.ph);setPh(b)}});
board.addEventListener('pointermove',e=>{if(!drag||e.pointerId!==drag.pid)return;const{p,b0,t:o}=drag,d=WDEF[drag.id],dx=e.clientX-drag.sx,dy=e.clientY-drag.sy;
  let t;if(drag.mode==='move'){drag.el.style.transform=`translate(${dx}px,${dy}px)`;
    t={...b0,x:Math.min(COLS-b0.w,Math.max(0,b0.x+Math.round(dx/p.x))),y:Math.max(0,b0.y+Math.round(dy/p.y))}}
  else t={...b0,w:Math.min(COLS-b0.x,Math.max(d.mw,b0.w+Math.round(dx/p.x))),h:Math.min(40,Math.max(d.mh,b0.h+Math.round(dy/p.y)))};
  if(t.x===o.x&&t.y===o.y&&t.w===o.w&&t.h===o.h)return;drag.t=t;
  drag.cur=settle(drag.base.map(v=>v.id===t.id?t:v),t.id,t.y>b0.y);
  if(drag.mode==='move'){placeEls(drag.cur.map(v=>v.id===t.id?b0:v));setPh(drag.cur.find(v=>v.id===t.id))}else placeEls(drag.cur)});
function endDrag(e){if(!drag||e.pointerId!==drag.pid)return;const{el,ph,cur}=drag,rect=el.getBoundingClientRect();
  el.classList.remove('drag');el.style.transform='';ph?.remove();drag=null;commit(settle(cur),{el,rect})}
board.addEventListener('pointerup',endDrag);board.addEventListener('pointercancel',endDrag);
// Keyboard: arrow keys move the focused box one step (up/down hop past the neighbouring box), Shift+arrows resize.
board.addEventListener('keydown',e=>{const cv=e.target.closest('.wcov'),k={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[e.key];
  if(!cv||!arranging||!k)return;e.preventDefault();const base=shown(),b={...base.find(v=>v.id===cv.closest('.wgt').dataset.w)},d=WDEF[b.id];
  const cols=o=>o.id!==b.id&&o.x<b.x+b.w&&b.x<o.x+o.w;
  if(e.shiftKey){b.w=Math.min(COLS-b.x,Math.max(d.mw,b.w+k[0]));b.h=Math.min(40,Math.max(d.mh,b.h+k[1]))}
  else if(k[0])b.x=Math.min(COLS-b.w,Math.max(0,b.x+k[0]));
  else if(k[1]<0){const o=base.filter(o=>cols(o)&&o.y+o.h<=b.y).sort((a,c)=>c.y-a.y)[0];if(!o)return;b.y=Math.max(0,Math.ceil(o.y+o.h/2)-1)}
  else{const o=base.filter(o=>cols(o)&&o.y>=b.y+b.h).sort((a,c)=>a.y-c.y)[0];if(!o)return;b.y=Math.floor(o.y+o.h/2-b.h)+1}
  commit(settle(base.map(v=>v.id===b.id?b:v),b.id,k[1]>0))});

