// Tabs, the slideshow and Settings → Tabs.
/* ---------- tabs ---------- */
// The body shows one tab at a time. Tap a tab to switch; the choice is kept per device.
// Which tabs show, their order and how long each stays up in the slideshow are kept per device too.
const TABS=[['today','Today'],['bus','Bus'],['tasks','Tasks'],['rw','Rewards'],['wx','Weather']],TBK='fhd.tab',RTK='fhd.rotate';
const tabName=id=>(TABS.find(t=>t[0]===id)||[])[1]||id;
const RDEF={on:true,idle:60,order:TABS.map(t=>t[0]),tabs:{today:{on:true,s:20},bus:{on:true,s:20},tasks:{on:true,s:15},rw:{on:true,s:15},wx:{on:true,s:10}}};
let rot=JSON.parse(JSON.stringify(RDEF));
try{const v=JSON.parse(localStorage.getItem(RTK)||'{}')||{};rot.on=v.on!==false;if(+v.idle)rot.idle=+v.idle;
  if(Array.isArray(v.order))rot.order=[...new Set([...v.order.filter(id=>id in RDEF.tabs),...rot.order])];
  for(const id in rot.tabs)if(v.tabs?.[id])rot.tabs[id]={on:v.tabs[id].on!==false,s:Math.min(300,Math.max(5,+v.tabs[id].s||rot.tabs[id].s))}}catch(e){}
if(!rot.order.some(id=>rot.tabs[id].on))rot.tabs.today.on=true;
const saveRot=()=>{try{localStorage.setItem(RTK,JSON.stringify(rot))}catch(e){}};
let tab='today';try{tab=localStorage.getItem(TBK)||'today'}catch(e){}
const tabOk=id=>id in rot.tabs&&rot.tabs[id].on&&!(id==='rw'&&rOff);
function buildTabs(){$('#tabs').innerHTML=rot.order.map(id=>`<button type="button" role="tab" data-tab="${id}" id="tab-${id}">${tabName(id)}</button>`).join('')}
function applyTab(){if(!tabOk(tab))tab=rot.order.find(tabOk)||'today';
  $('#tabs').querySelectorAll('[data-tab]').forEach(b=>{const on=b.dataset.tab===tab;b.hidden=!tabOk(b.dataset.tab);b.setAttribute('aria-selected',on);b.tabIndex=on?0:-1});
  wEls().forEach(e=>{e.hidden=WDEF[e.dataset.w].tab!==tab||(e.dataset.w==='rw'&&rOff)});
  applyLayout()}
function setTab(id,focus){if(!tabOk(id))return;tab=id;if(id==='bus'&&Date.now()-tripAt>6e4)loadTrips(true);try{localStorage.setItem(TBK,id)}catch(e){}applyTab();if(focus)$('#tab-'+id).focus()}
$('#tabs').onclick=e=>{const b=e.target.closest('[data-tab]');if(b)setTab(b.dataset.tab)};
// Left/right arrow keys move between tabs.
$('#tabs').onkeydown=e=>{const d={ArrowLeft:-1,ArrowRight:1}[e.key];if(!d)return;e.preventDefault();
  const ids=rot.order.filter(tabOk),i=ids.indexOf(tab);setTab(ids[(i+d+ids.length)%ids.length],true)};
$('#busChip').onclick=()=>setTab('bus');
buildTabs();applyTab();

/* ---------- slideshow ---------- */
// On a wide screen the tabs change by themselves. A tap anywhere holds the current tab for a while
// (Settings → Tabs); a dialog, Arrange or typing holds it too. Tabs with nothing on them are skipped.
// The bar under the tabs fills up while a tab is showing. ⏸ Pause stops it on this device until ▶ Play.
let rotT=0,rotHeld=0;
const rotCan=()=>rot.on&&!narrow.matches&&!!hh&&!$('#vBoard').hidden;
function tabHasContent(id){const t=ymd(now()),lim=ymd(new Date(Date.now()+14*864e5));
  if(id==='today')return items.some(i=>i.type==='reminder'||(i.type==='event'&&i.date>=t&&i.date<=lim));
  if(id==='bus')return (!!hh?.vt_gid&&bus.list.length>0)||trips.length>0;
  if(id==='tasks')return items.some(i=>i.type==='task');
  if(id==='rw')return !rOff&&rwPeople().length>0;
  if(id==='wx')return !!wx;
  return true}
function nextTab(){const ids=rot.order.filter(tabOk),i=ids.indexOf(tab);
  for(let k=1;k<ids.length;k++){const id=ids[(i+k)%ids.length];if(tabHasContent(id))return id}return null}
function rotBar(ms){const b=$('#rotBar'),i=b.firstElementChild;i.style.transition='none';i.style.width='0';b.classList.toggle('off',!ms);
  if(ms){void i.offsetWidth;i.style.transition=`width ${ms}ms linear`;i.style.width='100%'}}
function rotUi(){const b=$('#rotBtn'),held=rot.on&&rotHeld>Date.now();
  b.textContent=!rot.on?'▶ Play':held?'▶ Resume':'⏸ Pause';b.setAttribute('aria-pressed',rot.on&&!held);
  b.title=!rot.on?'Change tabs by themselves':held?'Paused after a tap. Resume now':'Stop changing tabs by themselves'}
function rotSchedule(){clearTimeout(rotT);rotT=0;rotUi();
  if(!rotCan()){rotBar(0);return}
  if(rotHeld>Date.now()){rotBar(0);rotT=setTimeout(rotSchedule,rotHeld-Date.now()+50);return}
  // Nothing else to show: check again in a bit.
  if(!nextTab()){rotBar(0);rotT=setTimeout(rotSchedule,15000);return}
  const ms=(rot.tabs[tab]?.s||20)*1000;rotBar(ms);rotT=setTimeout(rotAdvance,ms)}
function rotAdvance(){rotT=0;if(!rotCan())return rotSchedule();
  if(busy()){rotT=setTimeout(rotAdvance,5000);return}
  const n=nextTab();if(n&&n!==tab){setTab(n);if(!calm.matches){board.classList.remove('fade');void board.offsetWidth;board.classList.add('fade')}}
  rotSchedule()}
function rotHold(){if(!rot.on)return;rotHeld=Date.now()+(+rot.idle||60)*1000;rotSchedule()}
document.addEventListener('pointerdown',e=>{if(!e.target.closest?.('#rotBtn'))rotHold()},true);
document.addEventListener('keydown',rotHold,true);
$('#rotBtn').onclick=()=>{if(!rot.on){rot.on=true;rotHeld=0;saveRot()}else if(rotHeld>Date.now())rotHeld=0;else rot.on=false;saveRot();rotSchedule()};
narrow.addEventListener('change',rotSchedule);
// Start once the board is showing (after sign-in), and keep it going if it ever stopped.
setInterval(()=>{if(!rotT)rotSchedule()},15000);

// Settings → Tabs. Changes apply straight away, like the theme.
function drawRot(){$('#rotOn').checked=rot.on;$('#rotIdle').value=rot.idle;
  $('#rotList').innerHTML=rot.order.map((id,i)=>{const c=rot.tabs[id],n=esc(tabName(id));
    return `<div class="rrow"><label class="ck"><input type="checkbox" data-ron="${id}"${c.on?' checked':''}> ${n}${id==='rw'&&rOff?' <small class="msg">(not set up)</small>':''}</label><label class="sec"><input type="number" min="5" max="300" value="${c.s}" data-rs="${id}" aria-label="Seconds on ${n}" inputmode="numeric"> s</label>`+
      `<button type="button" class="btn" data-rmv="${i}" data-d="-1" aria-label="Move ${n} up"${i?'':' disabled'}>↑</button><button type="button" class="btn" data-rmv="${i}" data-d="1" aria-label="Move ${n} down"${i<rot.order.length-1?'':' disabled'}>↓</button></div>`}).join('')}
const rotChanged=()=>{saveRot();buildTabs();applyTab();rotSchedule()};
$('#rotList').addEventListener('change',e=>{const t=e.target;
  if(t.dataset.ron){const id=t.dataset.ron;
    if(!t.checked&&!rot.order.some(x=>x!==id&&rot.tabs[x].on)){t.checked=true;return}  // keep at least one tab
    rot.tabs[id].on=t.checked}
  if(t.dataset.rs){const v=Math.min(300,Math.max(5,parseInt(t.value,10)||rot.tabs[t.dataset.rs].s));rot.tabs[t.dataset.rs].s=v;t.value=v}
  rotChanged()});
$('#rotList').addEventListener('click',e=>{const b=e.target.closest('[data-rmv]');if(!b)return;const i=+b.dataset.rmv,j=i+(+b.dataset.d);
  if(j<0||j>=rot.order.length)return;[rot.order[i],rot.order[j]]=[rot.order[j],rot.order[i]];rotChanged();drawRot();
  $(`#rotList [data-rmv="${j}"][data-d="${b.dataset.d}"]`)?.focus()});
$('#rotOn').onchange=e=>{rot.on=e.target.checked;rotHeld=0;rotChanged()};
$('#rotIdle').onchange=e=>{rot.idle=Math.min(600,Math.max(10,parseInt(e.target.value,10)||60));e.target.value=rot.idle;saveRot()};

