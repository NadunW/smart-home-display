// Light and dark theme.
/* ---------- theme ---------- */
// Automatic: light between sunrise and sunset at the family's town, dark otherwise.
// Times come with the weather; the last known times (minutes past midnight) are kept for the sign-in screen.
let sun=null;
const THK='fhd.theme';
const themePref=()=>{try{return localStorage.getItem(THK)||'sun'}catch(e){return'sun'}};
function sunWindow(){if(sun)return{rise:sun.rise.getHours()*60+sun.rise.getMinutes(),set:sun.set.getHours()*60+sun.set.getMinutes()};
  try{return JSON.parse(localStorage.getItem('fhd.sun')||'null')}catch(e){return null}}
function applyTheme(){const p=themePref();let t='';
  if(p==='light'||p==='dark')t=p;
  else if(p==='sun'){const w=sunWindow();if(w){const d=now(),m=d.getHours()*60+d.getMinutes();t=m>=w.rise&&m<w.set?'light':'dark'}}
  const root=document.documentElement;if(t){if(root.dataset.theme!==t)root.dataset.theme=t}else delete root.dataset.theme;
  const dark=t?t==='dark':matchMedia('(prefers-color-scheme: dark)').matches;
  $('meta[name=theme-color]').content=dark?'#121116':'#ffffff';
  const b=$('#thBtn'),l=dark?'Switch to light':'Switch to dark';b.classList.toggle('dk',dark);b.title=l;b.setAttribute('aria-label',l)}
try{matchMedia('(prefers-color-scheme: dark)').addEventListener('change',applyTheme)}catch(e){}
$('#sTheme').onchange=e=>{try{localStorage.setItem(THK,e.target.value)}catch(err){}applyTheme()};
// Quick switch in the header: flips to the opposite of what's showing and keeps it (Always light / Always dark).
// Settings → Theme goes back to automatic.
$('#thBtn').onclick=()=>{const t=document.documentElement.dataset.theme||(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');
  const n=t==='dark'?'light':'dark';try{localStorage.setItem(THK,n)}catch(e){}$('#sTheme').value=n;applyTheme()};

