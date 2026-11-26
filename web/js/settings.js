// Settings: family name, people, bus stop, town and join code; and the section tabs inside the dialog.
/* ---------- settings ---------- */
let draft=null;
// The dialog's sections show one at a time, like the tabs on the board. Calendar is left out when Google sync isn't set up.
let setSec='fam';
const setSecs=()=>[...$('#setTabs').querySelectorAll('[data-st]')].filter(b=>!b.hidden);
function showSetSec(id,focus){const ok=setSecs().find(b=>b.dataset.st===id)||setSecs()[0];setSec=ok.dataset.st;
  $('#setTabs').querySelectorAll('[data-st]').forEach(b=>{const on=b===ok;b.setAttribute('aria-selected',on);b.tabIndex=on?0:-1;$('#sp-'+b.dataset.st).hidden=!on});
  $('#sp-'+setSec).parentElement.scrollTop=0;if(focus)ok.focus()}
function syncSetSecs(){$('#stab-cal').hidden=$('#gSet').hidden;if($('#stab-'+setSec).hidden)showSetSec('fam')}
$('#setTabs').onclick=e=>{const b=e.target.closest('[data-st]');if(b)showSetSec(b.dataset.st)};
$('#setTabs').onkeydown=e=>{const d={ArrowLeft:-1,ArrowUp:-1,ArrowRight:1,ArrowDown:1}[e.key];if(!d)return;e.preventDefault();
  const ids=setSecs().map(b=>b.dataset.st),i=ids.indexOf(setSec);showSetSec(ids[(i+d+ids.length)%ids.length],true)};
function drawMems(){$('#mems').innerHTML=draft.people.length?draft.people.map((m,i)=>`<div class="mem"><input value="${esc(m.name)}" data-mi="${i}" aria-label="Name" maxlength="40" placeholder="Name"><input type="color" value="${esc(m.color)}" data-mc="${i}" aria-label="Colour"><button type="button" class="btn" data-mr="${i}" aria-label="Remove ${esc(m.name)}">×</button></div>`).join(''):'<p class="msg">No one added yet.</p>'}
const PAL=['#e4572e','#2e86de','#9b59b6','#16a085','#f39c12','#d63384','#6c757d','#20c997'];
function openSet(welcome){draft={people:people.map(p=>({...p})),gid:hh.vt_gid,stop:hh.vt_stop,place:hh.place,lat:hh.lat,lon:hh.lon};
  if(welcome&&!draft.people.length)draft.people.push({name:'',color:PAL[0]});
  $('#setWelcome').hidden=!welcome;$('#sName').value=hh.name;drawMems();$('#sStopQ').value='';$('#sStopRes').innerHTML='';$('#sPlaceQ').value='';$('#sPlaceRes').innerHTML='';
  $('#sStopCur').textContent=draft.stop?'Current stop: '+draft.stop:'No stop chosen yet.';$('#sPlaceCur').textContent=draft.place?'Current town: '+draft.place:'No town chosen yet.';
  $('#sTheme').value=themePref();$('#sRwSize').value=rwSizePref();$('#sTextSize').value=tsPref();drawRot();fillScreenSettings();$('#sCode').textContent=hh.join_code;drawG();syncSetSecs();showSetSec(welcome?'fam':setSec);msg($('#setMsg'),'');$('#ovSet').classList.add('on')}
$('#setBtn').onclick=()=>openSet(false);
$('#mems').oninput=e=>{const t=e.target;if(t.dataset.mi!=null)draft.people[t.dataset.mi].name=t.value;if(t.dataset.mc!=null)draft.people[t.dataset.mc].color=t.value};
$('#mems').onclick=e=>{const i=e.target.closest('[data-mr]')?.dataset.mr;if(i!=null){draft.people.splice(+i,1);drawMems()}};
$('#addMem').onclick=()=>{draft.people.push({name:'',color:PAL[draft.people.length%PAL.length]});drawMems()};
async function findStop(){const q=$('#sStopQ').value.trim();if(q.length<2)return;$('#sStopRes').innerHTML='<p class="msg">Searching…</p>';
  const{data,error}=await sb.functions.invoke('vasttrafik',{body:{action:'search',q}});
  if(error||data?.error){$('#sStopRes').innerHTML='<p class="msg err">Stop search isn’t working right now.</p>';return}
  $('#sStopRes').innerHTML=data.results.length?data.results.map(r=>`<button type="button" class="btn" data-gid="${esc(r.gid)}" data-name="${esc(r.name)}">${esc(r.name)}</button>`).join(''):'<p class="msg">No stops found.</p>'}
$('#sStopFind').onclick=findStop;$('#sStopQ').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();findStop()}};
$('#sStopRes').onclick=e=>{const b=e.target.closest('[data-gid]');if(!b)return;draft.gid=b.dataset.gid;draft.stop=b.dataset.name;$('#sStopRes').innerHTML='';$('#sStopCur').textContent='Chosen: '+draft.stop+' — tap Save.'};
async function findPlace(){const q=$('#sPlaceQ').value.trim();if(q.length<2)return;$('#sPlaceRes').innerHTML='<p class="msg">Searching…</p>';
  try{const r=await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=5&language=sv`);const j=await r.json();const res=j.results||[];
    $('#sPlaceRes').innerHTML=res.length?res.map(p=>`<button type="button" class="btn" data-lat="${p.latitude}" data-lon="${p.longitude}" data-name="${esc(p.name)}">${esc(p.name)}<span class="msg"> · ${esc([p.admin1,p.country].filter(Boolean).join(', '))}</span></button>`).join(''):'<p class="msg">No places found.</p>'}
  catch(e){$('#sPlaceRes').innerHTML='<p class="msg err">Town search isn’t working right now.</p>'}}
$('#sPlaceFind').onclick=findPlace;$('#sPlaceQ').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();findPlace()}};
$('#sPlaceRes').onclick=e=>{const b=e.target.closest('[data-lat]');if(!b)return;draft.lat=+b.dataset.lat;draft.lon=+b.dataset.lon;draft.place=b.dataset.name;$('#sPlaceRes').innerHTML='';$('#sPlaceCur').textContent='Chosen: '+draft.place+' — tap Save.'};
$('#sNewCode').onclick=async()=>{const{data,error}=await sb.rpc('new_join_code',{h:hh.id});if(error)return msg($('#setMsg'),/owner/.test(error.message)?'Only the person who created the family can change the code.':errText(error),true);hh.join_code=data;$('#sCode').textContent=data};
$('#fSet').onsubmit=async e=>{e.preventDefault();$('#setSave').disabled=true;msg($('#setMsg'),'Saving…');
  try{const h=await sb.from('households').update({name:$('#sName').value.trim()||hh.name,vt_gid:draft.gid||null,vt_stop:draft.stop||null,place:draft.place||null,lat:draft.lat??null,lon:draft.lon??null}).eq('id',hh.id).select().single();
    if(h.error)throw h.error;const gidChanged=h.data.vt_gid!==hh.vt_gid;hh=h.data;
    const keep=draft.people.filter(p=>p.name.trim()),keepIds=new Set(keep.filter(p=>p.id).map(p=>p.id));
    const gone=people.filter(p=>!keepIds.has(p.id)).map(p=>p.id);
    if(gone.length){const r=await sb.from('people').delete().in('id',gone);if(r.error)throw r.error}
    for(const[i,p]of keep.entries()){const body={household_id:hh.id,name:p.name.trim(),color:p.color,sort:i};
      const r=p.id?await sb.from('people').update(body).eq('id',p.id):await sb.from('people').insert(body);if(r.error)throw r.error}
    $('#ovSet').classList.remove('on');await loadAll();if(gidChanged){bus={list:[],err:''};loadBus()}loadWeather()}
  catch(err){msg($('#setMsg'),'Couldn’t save: '+errText(err),true)}finally{$('#setSave').disabled=false}};

