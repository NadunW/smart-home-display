// Wall screen brightness (Android app) and keeping the tablet awake.
/* ---------- wall screen (Android app only) ---------- */
// The app exposes window.FamilyDisplay.setBrightness(level). The rules live here because this is
// where the family's appointments are. Settings are kept per device.
const isApp=!!(window.FamilyDisplay&&window.FamilyDisplay.setBrightness);
const SCK='fhd.screen',SC_DEF={dayFrom:'17:00',dayTo:'19:30',busFrom:'06:45',busTo:'08:15',nightFrom:'22:00',nightTo:'06:30',lead:15,idle:3,dim:12};
let sc={...SC_DEF};try{sc={...SC_DEF,...JSON.parse(localStorage.getItem(SCK)||'{}')}}catch(e){}
let lastTouch=Date.now(),screenLevel=null,screenOn=true,swallowUntil=0,previewUntil=0,previewTimer=0;
const toMin=t=>{if(!t)return null;const[h,m]=String(t).split(':').map(Number);return h*60+m};
const inWindow=(m,a,b)=>{a=toMin(a);b=toMin(b);if(a==null||b==null||a===b)return false;return a<b?m>=a&&m<b:(m>=a||m<b)};
function screenReason(){const d=now(),m=d.getHours()*60+d.getMinutes(),wd=d.getDay()>=1&&d.getDay()<=5;
  if(Date.now()-lastTouch<(+sc.idle||3)*6e4)return{on:true,why:'someone tapped the screen'};
  if(hh&&+sc.lead>0){const t=ymd(d);
    for(const i of items){if(i.date!==t||!i.time||(i.type==='task'&&isDone(i)))continue;const im=toMin(i.time);
      if(m>=im-sc.lead&&m<=im+10)return{on:true,why:i.title+' at '+i.time}}}
  if(wd&&inWindow(m,sc.busFrom,sc.busTo))return{on:true,why:'bus time'};
  if(inWindow(m,sc.dayFrom,sc.dayTo))return{on:true,why:'bright hours'};
  if(inWindow(m,sc.nightFrom,sc.nightTo))return{on:false,night:true,why:'night'};
  return{on:false,why:'nothing coming up'}}
function applyScreen(){if(!isApp||Date.now()<previewUntil)return;const r=screenReason(),lvl=r.on?-1:r.night?0:(+sc.dim||12)/100;
  screenOn=r.on;document.body.classList.toggle('night',!!r.night);
  if(lvl!==screenLevel){screenLevel=lvl;try{window.FamilyDisplay.setBrightness(lvl)}catch(e){}}
  const el=$('#scNow');if(el)el.textContent=(r.on?'Bright now: ':r.night?'Night mode: ':'Dimmed: ')+r.why+'.'}
// A tap on a dimmed screen only wakes it; it doesn't press whatever was under the finger.
document.addEventListener('pointerdown',e=>{if(!isApp)return;const wasDim=!screenOn;lastTouch=Date.now();
  if(wasDim){swallowUntil=Date.now()+700;e.preventDefault();e.stopPropagation();applyScreen()}},true);
document.addEventListener('click',e=>{if(Date.now()<swallowUntil){e.preventDefault();e.stopPropagation()}},true);
const SC_FIELDS={scDayFrom:'dayFrom',scDayTo:'dayTo',scBusFrom:'busFrom',scBusTo:'busTo',scNightFrom:'nightFrom',scNightTo:'nightTo',scLead:'lead',scIdle:'idle',scDim:'dim'};
function fillScreenSettings(){$('#screenSet').hidden=!isApp;if(!isApp)return;for(const[id,k]of Object.entries(SC_FIELDS))$('#'+id).value=sc[k]??'';applyScreen()}
for(const[id,k]of Object.entries(SC_FIELDS))$('#'+id).addEventListener('input',e=>{const v=e.target.value;
  sc[k]=e.target.type==='number'||e.target.type==='range'?(v===''?0:+v):v;try{localStorage.setItem(SCK,JSON.stringify(sc))}catch(err){}
  if(id==='scDim')previewDim();else applyScreen()});
// Moving the slider means someone is touching the screen, so it is bright. Show the dimmed level for a
// moment so the change can be seen, then go back to whatever the rules say.
function previewDim(){const lvl=(+sc.dim||12)/100;previewUntil=Date.now()+2500;screenLevel=null;
  try{window.FamilyDisplay.setBrightness(lvl)}catch(e){}
  const el=$('#scNow');if(el)el.textContent='Preview: this is how the dimmed screen looks ('+Math.round(lvl*100)+'%).';
  clearTimeout(previewTimer);previewTimer=setTimeout(()=>{previewUntil=0;screenLevel=null;applyScreen()},2500)}

/* ---------- keep a wall tablet awake ---------- */
let lock=null;const wake=async()=>{try{if('wakeLock' in navigator&&!lock){lock=await navigator.wakeLock.request('screen');lock.addEventListener('release',()=>lock=null)}}catch(e){}};
document.addEventListener('click',wake);document.addEventListener('visibilitychange',()=>{if(!document.hidden)wake()});

