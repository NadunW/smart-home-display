// Shared helpers, the Supabase client and the state everything else reads.
const $=s=>document.querySelector(s);
const pad=n=>String(n).padStart(2,'0');
const ymd=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const weekKey=d=>{const t=new Date(d);t.setHours(0,0,0,0);t.setDate(t.getDate()+3-(t.getDay()+6)%7);const w1=new Date(t.getFullYear(),0,4);return t.getFullYear()+'-W'+(1+Math.round(((t-w1)/864e5-3+(w1.getDay()+6)%7)/7))};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const now=()=>new Date();
const C=window.APP_CONFIG||{};
if(!C.supabaseUrl||/YOUR-PROJECT/.test(C.supabaseUrl)){document.body.innerHTML='<p style="padding:24px;font-size:18px">Add your Supabase URL and key to config.js to start.</p>';throw new Error('config.js not filled in')}
const sb=window.supabase.createClient(C.supabaseUrl,C.supabaseKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});

let user=null,hh=null,people=[],items=[],bus={list:[],err:''},wx=null,chan=null,editing=null,kind='task',signUp=false,timers=[];
const show=id=>{for(const v of ['vAuth','vReset','vSetup','vBoard'])$('#'+v).hidden=v!==id};
const status=t=>$('#status').textContent=t;
const msg=(el,t,err)=>{el.textContent=t||'';el.classList.toggle('err',!!err)};
const errText=e=>(e&&(e.message||e.error_description))||'Something went wrong';

