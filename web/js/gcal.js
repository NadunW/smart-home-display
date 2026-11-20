// Google Calendar: each family member can connect their own Google account (Settings → Google Calendar).
// Their appointments show on the display; appointments and reminders added here for that person go into
// their Google Calendar, and changes go both ways. The `google` server function does the talking to Google.
/* ---------- google calendar ---------- */
let gAcc=[],gOff=false,gForce=false,gAt=0;
const gTz=()=>{try{return Intl.DateTimeFormat().resolvedOptions().timeZone||'Europe/Stockholm'}catch(e){return 'Europe/Stockholm'}};
const gCall=body=>sb.functions.invoke('google',{body:{tz:gTz(),...body}});
const gOf=it=>it?.gcal_account&&gAcc.find(a=>a.id===it.gcal_account);
async function loadGoogle(){if(!hh)return;const{data,error}=await sb.from('google_accounts').select('*').eq('household_id',hh.id).order('created_at');
  if(error){if(/^(PGRST20|42P01|42501)/.test(error.code||''))gOff=true;return}gOff=false;gAcc=data||[];if($('#ovSet').classList.contains('on'))drawG()}
// Asks the server to read everyone's Google calendars. The server skips accounts it read in the last 90 s,
// so several screens can ask without any extra work; changes arrive through the live sync.
async function gSync(force){if(!hh||gOff||(!gAcc.length&&!force&&!gForce))return;if(!force&&!gForce&&Date.now()-gAt<6e4)return;
  gAt=Date.now();const f=force||gForce;gForce=false;
  const{error}=await gCall({action:'sync',household:hh.id,force:!!f});if(!error)refetch()}
// After an appointment or reminder is saved on the display: send it to the person's Google Calendar.
async function gPush(it){if(gOff||!gAcc.length||isTmp(it.id))return;
  const linked=!!it.gcal_event,forSomeone=it.person_id&&gAcc.some(a=>a.person_id===it.person_id&&a.write_cal);
  if(!linked&&!(forSomeone&&it.type!=='task'&&it.date))return;
  const{data,error}=await gCall({action:'push',item:it.id});
  if(error||data?.error)status('Saved, but couldn’t update Google Calendar'+(data?.error==='reconnect'?': connect it again in Settings.':' right now.'))}
async function gRemove(it){const a=gOf(it);if(!a||!it.gcal_event)return;
  const{data,error}=await gCall({action:'remove',household:hh.id,account:a.id,cal:it.gcal_cal,event:it.gcal_event});
  if(error||data?.error)status('Deleted here, but couldn’t delete it from Google Calendar.')}

// ---------- Settings → Google Calendar ----------
const gPeopleOpts=sel=>'<option value="">Everyone</option>'+people.map(p=>`<option value="${esc(p.id)}"${p.id===sel?' selected':''}>${esc(p.name)}</option>`).join('');
function drawG(){const box=$('#gSet');if(!box)return;box.hidden=gOff;if(gOff)return;
  const isOwner=hh?.created_by===user?.id;
  $('#gList').innerHTML=gAcc.length?gAcc.map(a=>{const mine=a.user_id===user?.id,dis=mine?'':' disabled',cals=a.calendars||[];
    const st=a.sync_error==='reconnect'?'<p class="msg err">Google needs this account to be connected again.</p>'
      :a.sync_error?`<p class="msg err">Last sync didn’t work: ${esc(a.sync_error)}</p>`
      :`<p class="msg">${a.synced_at?'Synced '+esc(dayLabel(ymd(new Date(a.synced_at))).toLowerCase())+' '+pad(new Date(a.synced_at).getHours())+':'+pad(new Date(a.synced_at).getMinutes()):'Not synced yet'}</p>`;
    return `<div class="gacc" data-ga="${esc(a.id)}"><div class="gacc-h"><b>${esc(a.email)}</b>${mine?'':'<span class="msg">Only the person who connected it can change it.</span>'}</div>
      <label>Their appointments show as<select data-gp${dis}>${gPeopleOpts(a.person_id)}</select></label>
      <div class="gcals">${cals.map((c,i)=>`<label class="ckrow"><input type="checkbox" data-gc="${i}"${c.show?' checked':''}${dis}><span class="gdot" style="background:${esc(c.color||'#8a8896')}"></span>${esc(c.name)}</label>`).join('')}</div>
      <label>New appointments and reminders for ${esc(nameOf(a.person_id))} go to<select data-gw${dis}><option value="">Don’t add them to Google</option>${cals.filter(c=>c.write).map(c=>`<option value="${esc(c.id)}"${c.id===a.write_cal?' selected':''}>${esc(c.name)}</option>`).join('')}</select></label>
      ${st}<div class="acts" style="justify-content:flex-start">${mine&&a.sync_error==='reconnect'?'<button type="button" class="btn pri" data-grc>Connect again</button>':''}${mine?'<button type="button" class="btn" data-gs>Sync now</button>':''}${mine||isOwner?'<button type="button" class="btn danger" data-gx>Disconnect</button>':''}</div></div>`}).join('')
    :'<p class="msg">No one has connected a Google account yet.</p>';
  const w=$('#gWho'),v=w.value;w.innerHTML=gPeopleOpts('');if([...w.options].some(o=>o.value===v))w.value=v;msg($('#gMsg'),'')}
async function gConnect(pid){msg($('#gMsg'),'Opening Google…');
  const{data,error}=await gCall({action:'connect',household:hh.id,person_id:pid||null,return_to:location.href.split(/[?#]/)[0]});
  if(error||!data?.url)return msg($('#gMsg'),data?.error||'Google Calendar isn’t working right now. Is the google server function deployed?',true);
  location.href=data.url}
async function gUpdate(a,patch,note){Object.assign(a,patch);const{error}=await sb.from('google_accounts').update(patch).eq('id',a.id);
  if(error)return msg($('#gMsg'),'Couldn’t save: '+errText(error),true);msg($('#gMsg'),note||'Saved.');gSync(true)}
$('#gConnect').onclick=()=>gConnect($('#gWho').value);
$('#gList').onchange=async e=>{const box=e.target.closest('[data-ga]'),a=box&&gAcc.find(x=>x.id===box.dataset.ga);if(!a)return;const t=e.target;
  if(t.matches('[data-gp]')){const old=a.person_id||null,pid=t.value||null;await gUpdate(a,{person_id:pid});
    // what came from this calendar moves along to the new person
    let q=sb.from('items').update({person_id:pid}).eq('gcal_account',a.id);q=old?q.eq('person_id',old):q.is('person_id',null);await q;drawG();refetch()}
  else if(t.matches('[data-gc]')){const cals=(a.calendars||[]).map((c,i)=>i===+t.dataset.gc?{...c,show:t.checked}:c);gUpdate(a,{calendars:cals},t.checked?'Saved. Its appointments appear in a moment.':'Saved. Its appointments are taken off the display.')}
  else if(t.matches('[data-gw]'))gUpdate(a,{write_cal:t.value||null})};
$('#gList').onclick=async e=>{const box=e.target.closest('[data-ga]'),a=box&&gAcc.find(x=>x.id===box.dataset.ga);if(!a)return;
  if(e.target.closest('[data-grc]'))return gConnect(a.person_id);
  if(e.target.closest('[data-gs]')){msg($('#gMsg'),'Syncing…');await gSync(true);await loadGoogle();return msg($('#gMsg'),'Synced.')}
  if(e.target.closest('[data-gx]')){if(!confirmG(box))return;msg($('#gMsg'),'Disconnecting…');
    const{data,error}=await gCall({action:'disconnect',account:a.id});
    if(error||data?.error)return msg($('#gMsg'),data?.error||'Couldn’t disconnect right now.',true);
    gAcc=gAcc.filter(x=>x.id!==a.id);drawG();msg($('#gMsg'),'Disconnected. Its appointments are gone from the display; the Google Calendar itself is untouched.');refetch()}};
// Two taps to disconnect: the first turns the button into "Tap again to disconnect".
function confirmG(box){const b=box.querySelector('[data-gx]');if(b.dataset.sure){return true}b.dataset.sure='1';b.textContent='Tap again to disconnect';setTimeout(()=>{if(b.isConnected){delete b.dataset.sure;b.textContent='Disconnect'}},5000);return false}

// Back from Google's sign-in page: ?gcal=ok or ?gcal=error&why=…
(()=>{const q=new URLSearchParams(location.search),r=q.get('gcal');if(!r)return;const why=q.get('why');
  q.delete('gcal');q.delete('why');history.replaceState(null,'',location.pathname+(q.toString()?'?'+q:'')+location.hash);
  if(r==='ok')gForce=true;
  setTimeout(()=>toast(r==='ok'?'Google Calendar connected. Appointments appear in a moment.'
    :why==='denied'?'Google Calendar wasn’t connected: access wasn’t allowed.'
    :why==='scopes'?'Google Calendar wasn’t connected: tick both calendar boxes on Google’s page so the display can read and add appointments.'
    :'Google Calendar couldn’t be connected. Try again.'),1200)})();
