// Starts the clock and timers, checks for new versions and waits for sign-in. Loaded last.
/* ---------- go ---------- */
applyTheme();tick();applyScreen();setInterval(()=>{tick();renderBus();renderTrips();applyTheme();applyScreen();sizeRows()},15000);
let lastDay=ymd(now());setInterval(()=>{if(ymd(now())!==lastDay){lastDay=ymd(now());render()}},6e4);
// ---------- auto-update ----------
// The deploy workflow stamps BUILD and writes version.txt. Every 2 minutes the page checks
// version.txt; when a new version is out it refreshes the cached files and reloads, but only
// while nobody is in the middle of something (a dialog, Arrange, typing).
// Footer, right side: "Version 1.4.12 · updated today 09:51". Hidden on a local copy (no stamp).
function showVersion(){if(VER.startsWith('__'))return;const d=new Date(BUILT);if(isNaN(d))return;
  const hm=pad(d.getHours())+':'+pad(d.getMinutes()),day=dayLabel(ymd(d));
  $('#ver').textContent=`Version ${VER} · updated ${/^(Today|Yesterday)$/.test(day)?day.toLowerCase():day} ${hm}`;
  $('#ver').title='Build '+BUILD.slice(0,7)}
showVersion();setInterval(showVersion,6e4);
const busy=()=>arranging||!!document.querySelector('.ov.on')||/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName||'');
let updating=false;
async function checkUpdate(){
  if(updating||BUILD.startsWith('__')||!navigator.onLine)return;
  try{const r=await fetch('version.txt?t='+Date.now(),{cache:'no-store'});if(!r.ok)return;
    const v=(await r.text()).trim();if(!v||v===BUILD)return;
    if(busy())return;  // try again next round
    let tries=0;try{tries=+sessionStorage.getItem('fhd.upd.'+v)||0;sessionStorage.setItem('fhd.upd.'+v,tries+1)}catch(e){}
    if(tries>=3)return;  // the server still hands out the old page; don't loop
    updating=true;
    await Promise.all(['./','index.html','config.js'].map(u=>fetch(u,{cache:'reload'}).catch(()=>{})));
    const u=new URL(location.href);u.searchParams.set('v',v.slice(0,8));
    if(tries)location.replace(u.href);else location.reload();
  }catch(e){updating=false}}
setInterval(checkUpdate,12e4);setTimeout(checkUpdate,15000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)checkUpdate()});
let started=false;
sb.auth.onAuthStateChange((ev,session)=>{
  if(ev==='PASSWORD_RECOVERY'){show('vReset');return}
  const uid=session?.user?.id||null;
  if(ev==='SIGNED_OUT'||(ev==='SIGNED_IN'&&uid!==user?.id)||!started){started=true;setTimeout(start,0)}});
