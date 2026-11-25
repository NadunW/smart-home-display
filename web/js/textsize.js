// Text size in the boxes (Settings → Display, per device).
/* ---------- text size ---------- */
// Automatic makes each box's contents as big as fits without scrolling, so a box with little on it
// (one appointment, two reminders) uses its empty space instead of leaving it blank. Never smaller
// than Normal and at most 1.8×. The fixed sizes scale every box by the same amount. The whole box
// body is scaled with CSS zoom, so icons, line badges and spacing grow along with the text.
// Names that would be cut short (…) stop it growing.
// The reward chart has its own size setting (rewards.js) and is left alone here.
// Phones stack the boxes at their natural height, so Automatic does nothing there.
const TSK='fhd.textsize',TS_MAX=1.8,tsPref=()=>{try{return localStorage.getItem(TSK)||'auto'}catch(e){return'auto'}};
const tsBodies=()=>[...board.querySelectorAll('.wgt>.wb')].filter(b=>b.id!=='rw');
function fitText(el){const pref=tsPref(),set=v=>{el.style.zoom=v===1?'':v};
  if(pref!=='auto')return set(+pref||1);
  if(narrow.matches||!el.clientHeight||el.closest('[hidden]'))return set(1);
  // Names that end in … when too long (destinations, trip routes) must not get cut more than at Normal.
  // Zoomed text can render a little wider than measured, so a name in a wider slot keeps a few pixels
  // to spare; a name whose slot is as wide as its text (r≈1 at Normal) is checked exactly.
  const ell=[...el.querySelectorAll('*')].filter(e=>getComputedStyle(e).textOverflow==='ellipsis');
  const rg=document.createRange(),ratio=e=>{const w=e.getBoundingClientRect().width;rg.selectNodeContents(e);return w?[rg.getBoundingClientRect().width/w,w]:[0,1]};
  let base=[];const cut=()=>ell.reduce((n,e,i)=>{const[r,w]=ratio(e);return n+(r>(base[i]>.99?1.005:.97-4/w))},0);
  const fits=v=>{set(v);return el.scrollHeight<=el.clientHeight+1&&el.scrollWidth<=el.clientWidth+1&&cut()<=cut1};
  set(1);base=ell.map(e=>ratio(e)[0]);const cut1=cut();if(!fits(1))return;let lo=1,hi=TS_MAX;if(fits(hi))return;
  for(let k=0;k<6;k++){const m=(lo+hi)/2;if(fits(m))lo=m;else hi=m}set(Math.floor(lo*100)/100)}
// Refit a box when what's in it changes or its size changes (resize, Arrange, switching tabs).
// Batched to once per frame; the box (.wgt) is watched rather than the body, whose zoom we change.
const tsDue=new Set();let tsRaf=0;
function tsQueue(el){tsDue.add(el);if(!tsRaf)tsRaf=requestAnimationFrame(()=>{tsRaf=0;const l=[...tsDue];tsDue.clear();l.forEach(fitText)})}
const fitAllText=()=>tsBodies().forEach(tsQueue);
try{const ro=new ResizeObserver(es=>es.forEach(e=>{const b=e.target.querySelector(':scope>.wb');if(b&&b.id!=='rw')tsQueue(b)}));
  const mo=new MutationObserver(ms=>ms.forEach(m=>{const b=(m.target.nodeType===1?m.target:m.target.parentElement)?.closest('.wgt>.wb');if(b&&b.id!=='rw')tsQueue(b)}));
  for(const b of tsBodies()){ro.observe(b.parentElement);mo.observe(b,{childList:true,subtree:true,characterData:true})}}catch(e){}
narrow.addEventListener('change',fitAllText);
document.fonts?.ready.then(fitAllText);
$('#sTextSize').onchange=e=>{try{localStorage.setItem(TSK,e.target.value)}catch(err){}fitAllText()};
