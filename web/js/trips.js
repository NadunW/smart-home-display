// Saved trips on the Bus tab (Office, School…) and the add/edit trip dialog.
/* ---------- trips ---------- */
// Saved trips (Office, School…) with the next connections from Västtrafik's trip planner: when to leave
// the house, when you arrive, delays, and the lines and walks on the way.
let trips=[],tripRes={},tripSig={},tripAt=0,tripEditing=null,tripDraft={from:null,to:null},tripFound={from:[],to:[]};
const hm=t=>{const d=new Date(t);return t&&!isNaN(d)?pad(d.getHours())+':'+pad(d.getMinutes()):''};
const late=(a,p)=>!!(a&&p)&&Math.round((new Date(a)-new Date(p))/6e4)!==0;
const tEnd=(t,s)=>t[s+'_gid']?{gid:t[s+'_gid']}:{lat:t[s+'_lat'],lon:t[s+'_lon'],name:t[s+'_name']};
const MODE={bus:'Bus',tram:'Tram',train:'Train',ferry:'Boat',taxi:'Taxi'};
function setTrips(rows){trips=rows;const ids=new Set(rows.map(t=>t.id)),todo=[];
  for(const id in tripRes)if(!ids.has(id)){delete tripRes[id];delete tripSig[id]}
  for(const t of rows){const sig=JSON.stringify([tEnd(t,'from'),tEnd(t,'to')]);if(tripSig[t.id]!==sig){tripSig[t.id]=sig;delete tripRes[t.id];todo.push(t)}}
  todo.forEach(loadTrip);renderTrips()}
async function loadTrip(t){const{data,error}=await sb.functions.invoke('vasttrafik',{body:{action:'journeys',from:tEnd(t,'from'),to:tEnd(t,'to')}});
  tripRes[t.id]=error||data?.error?{list:tripRes[t.id]?.list||[],err:true}:{list:data.journeys||[],err:false};renderTrips()}
// Every minute while the Bus tab shows; every 5 minutes otherwise.
async function loadTrips(force){if(!hh||!trips.length)return;if(!force&&tab!=='bus'&&Date.now()-tripAt<5*6e4)return;
  tripAt=Date.now();await Promise.all(trips.map(loadTrip))}
function renderTrips(){const el=$('#trips');if(!el||!hh)return;
  if(!trips.length){el.innerHTML='<p class="empty">Save the trips you make often, like Office, University or School, to see when to leave and when you’ll arrive.</p><button type="button" class="btn" data-trip-add style="margin-top:8px">+ Add a trip</button>';return}
  const n=now();
  el.innerHTML=trips.map(t=>{const r=tripRes[t.id],w=(+t.walk_min||0)*6e4;
    const js=(r?.list||[]).map(j=>({...j,leaveAt:new Date(new Date(j.dep)-w)})).map(j=>({...j,leave:Math.round((j.leaveAt-n)/6e4)})).filter(j=>j.leave>=-1).slice(0,trips.length<3?3:2);
    const nx=js.find(j=>!j.cancelled);
    const lv=!nx?'':nx.leave<=0?'Leave now':nx.leave<60?`Leave in ${nx.leave} min`:'Leave '+hm(nx.leaveAt);
    const rows=js.map(j=>{const ld=late(j.dep,j.depPlanned),la=late(j.arr,j.arrPlanned),dur=Math.max(0,Math.round((new Date(j.arr)-new Date(j.dep))/6e4));
      const chain=(j.steps||[]).map(s=>s.walk!=null?`<span class="wk" title="Walk ${s.walk} min">🚶${s.walk}</span>`:lineTag(s)).join('');
      const ride=(j.steps||[]).find(s=>s.walk==null);
      const det=j===nx&&ride?`<p class="jd">${w?`Leave home ${hm(j.leaveAt)} · `:''}${esc(MODE[ride.mode]||'')} ${esc(ride.line)} from ${esc(ride.from)}${ride.platform?', platform '+esc(ride.platform):''} at ${hm(ride.dep)}${ride.dir?' towards '+esc(ride.dir):''}</p>`:'';
      return `<div class="jr${j.cancelled?' gone':''}"><span class="jt"><b${ld?' class="lt"':''}>${hm(j.dep)}</b> – <b${la?' class="lt"':''}>${hm(j.arr)}</b>${ld||la?`<s>${hm(j.depPlanned)} – ${hm(j.arrPlanned)}</s>`:''}</span><span class="chain">${chain}</span><span class="dur">${j.cancelled?'Cancelled':dur+' min'}</span>${det}</div>`}).join('');
    const body=rows||`<p class="empty" style="padding-left:46px">${!r?'Looking up connections…':r.err?'Live trips unavailable right now.':'No connections found right now.'}</p>`;
    return `<div class="trip"><div class="trip-h"><button type="button" class="tn" data-trip="${esc(t.id)}" aria-label="Edit trip ${esc(t.name)}"><span class="ti">${esc(t.icon||'📍')}</span><span style="min-width:0"><b>${esc(t.name)}</b><small>${esc(t.from_name)} → ${esc(t.to_name)}</small></span></button>${lv?`<span class="lv${nx.leave<=5?' soon':''}">${lv}</span>`:''}</div>${body}${r?.err&&rows?'<p class="note" style="padding-left:46px">Live trips unavailable right now — showing the last times.</p>':''}</div>`}).join('')}

const TPRE=[['🏢','Office'],['🎓','University'],['🏫','School'],['⚽','Training'],['🛒','Shopping'],['👵','Grandma']];
const TICON={stoparea:'🚏',address:'🏠',pointofinterest:'📍',metastation:'🚏'};
const S=k=>k==='from'?'From':'To';
$('#tripPre').innerHTML=TPRE.map(([i,n])=>`<button type="button" data-i="${i}" data-n="${n}">${i} ${n}</button>`).join('');
$('#tripPre').onclick=e=>{const b=e.target.closest('button');if(!b)return;$('#tIcon').value=b.dataset.i;$('#tName').value=b.dataset.n};
function drawTripEnds(){for(const k of['from','to']){const p=tripDraft[k];$(`#t${S(k)}Cur`).textContent=p?(TICON[p.type]||(p.gid?'🚏':'📍'))+' '+p.name:k==='from'?'Not chosen yet.':'Search for a stop, an address or a place.'}}
function openTrip(t){tripEditing=t||null;$('#tripH').textContent=t?'Edit trip':'Add trip';
  const end=s=>({name:t[s+'_name'],gid:t[s+'_gid'],lat:t[s+'_lat'],lon:t[s+'_lon']});
  tripDraft=t?{from:end('from'),to:end('to')}:{from:hh.vt_gid?{name:hh.vt_stop||'Home stop',gid:hh.vt_gid,type:'stoparea'}:null,to:null};
  $('#tIcon').value=t?.icon||'';$('#tName').value=t?.name||'';$('#tWalk').value=t?.walk_min??0;
  for(const k of['from','to']){$(`#t${S(k)}Q`).value='';$(`#t${S(k)}Res`).innerHTML=''}
  msg($('#tMsg'),'');$('#tDel').style.display=t?'':'none';drawTripEnds();$('#ovTrip').classList.add('on');$('#tName').focus()}
async function findTripPlace(k){const q=$(`#t${S(k)}Q`).value.trim(),res=$(`#t${S(k)}Res`);if(q.length<2)return;res.innerHTML='<p class="msg">Searching…</p>';
  const{data,error}=await sb.functions.invoke('vasttrafik',{body:{action:'search',q,any:true}});
  if(error||data?.error){res.innerHTML='<p class="msg err">Search isn’t working right now.</p>';return}
  tripFound[k]=data.results||[];
  res.innerHTML=tripFound[k].length?tripFound[k].map((r,i)=>`<button type="button" class="btn" data-i="${i}">${TICON[r.type]||'📍'} ${esc(r.name)}</button>`).join(''):'<p class="msg">Nothing found.</p>'}
for(const k of['from','to']){
  $(`#t${S(k)}Q`).onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();findTripPlace(k)}};
  $(`#t${S(k)}Res`).onclick=e=>{const b=e.target.closest('[data-i]');if(!b)return;tripDraft[k]=tripFound[k][+b.dataset.i];$(`#t${S(k)}Res`).innerHTML='';drawTripEnds()}}
$('#fTrip').querySelectorAll('[data-tfind]').forEach(b=>b.onclick=()=>findTripPlace(b.dataset.tfind));
$('#tripAdd').onclick=()=>openTrip();
$('#trips').onclick=e=>{if(e.target.closest('[data-trip-add]'))return openTrip();const b=e.target.closest('[data-trip]');if(b){const t=trips.find(x=>x.id===b.dataset.trip);if(t)openTrip(t)}};
$('#fTrip').onsubmit=async e=>{e.preventDefault();const name=$('#tName').value.trim();if(!name)return;
  const{from,to}=tripDraft;if(!from||!to)return msg($('#tMsg'),'Choose where the trip starts and where it goes.',true);
  const end=(s,p)=>({[s+'_name']:String(p.name).slice(0,80),[s+'_gid']:p.gid||null,[s+'_lat']:p.gid?null:p.lat,[s+'_lon']:p.gid?null:p.lon});
  const row={household_id:hh.id,name,icon:$('#tIcon').value.trim()||'📍',walk_min:Math.min(60,Math.max(0,parseInt($('#tWalk').value,10)||0)),...end('from',from),...end('to',to)};
  if(!tripEditing)row.sort=trips.reduce((m,t)=>Math.max(m,t.sort+1),0);
  $('#tSave').disabled=true;msg($('#tMsg'),'');
  const{data,error}=await(tripEditing?sb.from('trips').update(row).eq('id',tripEditing.id):sb.from('trips').insert(row)).select().single();
  $('#tSave').disabled=false;if(error)return msg($('#tMsg'),errText(error),true);
  $('#ovTrip').classList.remove('on');const i=trips.findIndex(x=>x.id===data.id);setTrips(i<0?[...trips,data]:trips.map(x=>x.id===data.id?data:x));applyTab()};
$('#tDel').onclick=async()=>{if(!tripEditing)return;const id=tripEditing.id;$('#ovTrip').classList.remove('on');setTrips(trips.filter(t=>t.id!==id));
  const{error}=await sb.from('trips').delete().eq('id',id);if(error){status('Couldn’t delete: '+errText(error));refetch()}};

