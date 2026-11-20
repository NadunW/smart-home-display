// Sign-in, creating or joining a family, loading everything and live updates.
/* ---------- auth ---------- */
function authMode(up){signUp=up;$('#authH').textContent=up?'Create account':'Sign in';$('#aGo').textContent=up?'Create account':'Sign in';
  $('#aSwap').textContent=up?'I already have an account':'Create an account';$('#aPass').autocomplete=up?'new-password':'current-password';msg($('#aMsg'),'')}
$('#aSwap').onclick=()=>authMode(!signUp);
$('#fAuth').onsubmit=async e=>{e.preventDefault();const email=$('#aEmail').value.trim(),password=$('#aPass').value;$('#aGo').disabled=true;msg($('#aMsg'),'');
  try{if(signUp){const{data,error}=await sb.auth.signUp({email,password,options:{emailRedirectTo:location.href.split('#')[0]}});if(error)throw error;
      if(!data.session)msg($('#aMsg'),'Check your email and tap the link to confirm your account, then sign in.')}
    else{const{error}=await sb.auth.signInWithPassword({email,password});if(error)throw error}}
  catch(err){msg($('#aMsg'),errText(err),true)}finally{$('#aGo').disabled=false}};
$('#aForgot').onclick=async()=>{const email=$('#aEmail').value.trim();if(!email){msg($('#aMsg'),'Type your email first.',true);return}
  const{error}=await sb.auth.resetPasswordForEmail(email,{redirectTo:location.href.split('#')[0]});
  msg($('#aMsg'),error?errText(error):'If that email has an account, a reset link is on its way.',!!error)};
$('#fReset').onsubmit=async e=>{e.preventDefault();const{error}=await sb.auth.updateUser({password:$('#rPass').value});
  if(error)return msg($('#rMsg'),errText(error),true);start()};
document.querySelectorAll('[data-signout]').forEach(b=>b.onclick=async()=>{$('#ovSet').classList.remove('on');await sb.auth.signOut()});

/* ---------- household ---------- */
$('#fCreate').onsubmit=async e=>{e.preventDefault();msg($('#sMsg'),'');const{data,error}=await sb.rpc('create_household',{p_name:$('#cName').value.trim()});
  if(error)return msg($('#sMsg'),errText(error),true);await openHousehold(data.id);openSet(true)};
$('#fJoin').onsubmit=async e=>{e.preventDefault();msg($('#sMsg'),'');const{data,error}=await sb.rpc('join_household',{p_code:$('#jCode').value.trim()});
  if(error)return msg($('#sMsg'),/No household/.test(error.message)?'That code doesn’t match a family. Check it and try again.':errText(error),true);await openHousehold(data.id)};

async function start(){const{data:{session}}=await sb.auth.getSession();user=session?.user||null;
  if(!user){stopBoard();authMode(false);show('vAuth');return}
  const{data,error}=await sb.from('households').select('*').order('created_at');
  if(error){show('vSetup');msg($('#sMsg'),errText(error),true);return}
  if(!data.length){stopBoard();show('vSetup');return}
  let saved='';try{saved=localStorage.getItem('fhd.household')||''}catch(e){}
  await openHousehold((data.find(h=>h.id===saved)||data[0]).id)}

async function openHousehold(id){stopBoard();try{localStorage.setItem('fhd.household',id)}catch(e){}
  const{data,error}=await sb.from('households').select('*').eq('id',id).single();if(error){show('vSetup');return msg($('#sMsg'),errText(error),true)}
  hh=data;show('vBoard');await loadAll();subscribe();loadBus();loadWeather();rotSchedule();gSync();
  timers.push(setInterval(loadBus,60000),setInterval(()=>loadTrips(),60000),setInterval(loadWeather,15*6e4),setInterval(loadAll,5*6e4),setInterval(()=>gSync(),5*6e4))}
function stopBoard(){timers.forEach(clearInterval);timers=[];if(chan){sb.removeChannel(chan);chan=null}hh=null;people=[];items=[];trips=[];tripRes={};tripSig={};tripAt=0;rItems=[];rLog=[];rBal={};rOff=false;gAcc=[];gOff=false;$('#ovRw').classList.remove('on')}

const norm=r=>({...r,time:r.time?String(r.time).slice(0,5):''});
async function loadAll(){if(!hh)return;const[p,i,,tr]=await Promise.all([sb.from('people').select('*').eq('household_id',hh.id).order('sort'),sb.from('items').select('*').eq('household_id',hh.id),loadRewards(),
    sb.from('trips').select('*').eq('household_id',hh.id).order('sort').order('created_at'),loadGoogle()]);
  if(!tr.error)setTrips(tr.data);
  if(p.error||i.error){status('Can’t reach the server right now — showing what’s loaded.');return}
  people=p.data;items=i.data.map(norm);applyScreen();status('Synced · '+pad(now().getHours())+':'+pad(now().getMinutes()));render()}
let reT=0;const refetch=()=>{clearTimeout(reT);reT=setTimeout(loadAll,300)};
function subscribe(){const f='household_id=eq.'+hh.id;
  chan=sb.channel('hh-'+hh.id)
    .on('postgres_changes',{event:'INSERT',schema:'public',table:'items',filter:f},refetch)
    .on('postgres_changes',{event:'UPDATE',schema:'public',table:'items',filter:f},refetch)
    .on('postgres_changes',{event:'DELETE',schema:'public',table:'items'},refetch)
    .on('postgres_changes',{event:'*',schema:'public',table:'people',filter:f},refetch)
    .on('postgres_changes',{event:'DELETE',schema:'public',table:'people'},refetch)
    .on('postgres_changes',{event:'*',schema:'public',table:'reward_items',filter:f},refetch)
    .on('postgres_changes',{event:'DELETE',schema:'public',table:'reward_items'},refetch)
    .on('postgres_changes',{event:'INSERT',schema:'public',table:'reward_log',filter:f},refetch)
    .on('postgres_changes',{event:'DELETE',schema:'public',table:'reward_log'},refetch)
    .on('postgres_changes',{event:'*',schema:'public',table:'trips',filter:f},refetch)
    .on('postgres_changes',{event:'DELETE',schema:'public',table:'trips'},refetch)
    .on('postgres_changes',{event:'*',schema:'public',table:'google_accounts',filter:f},refetch)
    .on('postgres_changes',{event:'DELETE',schema:'public',table:'google_accounts'},refetch)
    .on('postgres_changes',{event:'UPDATE',schema:'public',table:'households',filter:'id=eq.'+hh.id},p=>{const gid=hh.vt_gid;hh={...hh,...p.new};render();if(hh.vt_gid!==gid)loadBus();loadWeather()})
    .subscribe(s=>{if(s==='SUBSCRIBED')refetch()})}
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&hh){loadAll();loadBus();loadTrips(true);gSync()}});

