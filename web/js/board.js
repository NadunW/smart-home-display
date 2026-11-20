// Appointments, tasks and reminders: saving them and drawing the Today and Tasks boxes, plus the departure board.
/* ---------- items ---------- */
const person=id=>people.find(p=>p.id===id);
const colorOf=id=>person(id)?.color||'#8a8896';
const nameOf=id=>person(id)?.name||'Everyone';
const isDone=t=>t.repeat==='daily'?t.done_on===ymd(now()):t.repeat==='weekly'?t.done_on===weekKey(now()):!!t.done;
const row=it=>({household_id:hh.id,type:it.type,title:it.title,person_id:it.person_id||null,date:it.date||null,time:it.time||null,repeat:it.repeat||'none',done:!!it.done,done_on:it.done_on||null,countdown:!!it.countdown});
const isTmp=id=>String(id).startsWith('tmp');
async function saveItem(it){const i=items.findIndex(x=>x.id===it.id);i<0?items.push(it):items[i]=it;render();
  if(isTmp(it.id)){const{data,error}=await sb.from('items').insert(row(it)).select().single();
    if(error)status('Couldn’t save: '+errText(error));else{const j=items.findIndex(x=>x.id===it.id);if(j>=0)items[j]=norm(data);render()}}
  else{const{error}=await sb.from('items').update(row(it)).eq('id',it.id);if(error)status('Couldn’t save: '+errText(error))}
  refetch()}
async function removeItem(id){if(isTmp(id))return;items=items.filter(x=>x.id!==id);render();const{error}=await sb.from('items').delete().eq('id',id);if(error)status('Couldn’t delete: '+errText(error));refetch()}

/* ---------- render ---------- */
function tick(){const d=now(),t=pad(d.getHours())+':'+pad(d.getMinutes());document.querySelectorAll('[data-clock]').forEach(c=>c.textContent=t);
  $('#date').innerHTML=esc(d.toLocaleDateString('en-GB',{weekday:'long'}))+'<small>'+esc(d.toLocaleDateString('en-GB',{day:'numeric',month:'long'}))+' · week '+weekKey(d).split('W')[1]+'</small>'}
const evRow=(e,showDay)=>{const d=now(),t=ymd(d),hm=pad(d.getHours())+':'+pad(d.getMinutes());
  const past=e.date===t&&e.time&&e.time<hm,day=showDay?new Date(e.date+'T12:00').toLocaleDateString('en-GB',{weekday:'short',day:'numeric'}):'';
  return `<button class="ev${past?' past':''}" data-edit="${esc(e.id)}"><span class="t">${e.time?esc(e.time):'<small style="font-size:14px">All day</small>'}</span><span class="dot" style="background:${esc(colorOf(e.person_id))}"></span><span><span class="n">${esc(e.title)}</span><br><span class="s">${esc(nameOf(e.person_id))}${day?' · '+esc(day):''}</span></span></button>`};
function render(){if(!hh)return;
  const t=ymd(now()),evs=items.filter(i=>i.type==='event'&&i.date).sort((a,b)=>(a.date+(a.time||'')).localeCompare(b.date+(b.time||'')));
  const td=evs.filter(e=>e.date===t);
  $('#today').innerHTML=td.length?td.map(e=>evRow(e,false)).join(''):'<p class="empty">Nothing planned today.</p>';
  const lim=ymd(new Date(Date.now()+14*864e5)),up=evs.filter(e=>e.date>t&&e.date<=lim).slice(0,6);
  $('#soon').innerHTML=up.length?up.map(e=>evRow(e,true)).join(''):'<p class="empty">Nothing in the next two weeks.</p>';
  const cd=evs.find(e=>e.countdown&&e.date>=t);
  if(cd){const n=Math.round((new Date(cd.date+'T00:00')-new Date(t+'T00:00'))/864e5);$('#count').innerHTML=`<div class="count"><b>${n?n+(n===1?' day':' days'):'Today!'}</b>${esc(cd.title)}</div>`}else $('#count').innerHTML='';
  const tasks=items.filter(i=>i.type==='task'),done=tasks.filter(isDone).length;
  const groups=[...people.map(p=>({id:p.id,name:p.name,color:p.color})),{id:null,name:'Everyone',color:'#8a8896'}];
  $('#tasks').innerHTML=tasks.length?`<div class="big"><b>${done} of ${tasks.length}</b><span>done today</span></div>`+groups.map(g=>{
    const mine=tasks.filter(x=>g.id?x.person_id===g.id:!person(x.person_id)).sort((a,b)=>isDone(a)-isDone(b));if(!mine.length)return'';
    const k=mine.filter(isDone).length;
    return `<div class="who" style="--c:${esc(g.color)}"><div class="who-h"><span class="av" style="background:${esc(g.color)}">${esc(g.name[0]||'?')}</span><b>${esc(g.name)}</b><span>${k}/${mine.length}</span></div><div class="bar"><i style="width:${k/mine.length*100}%;background:${esc(g.color)}"></i></div>`+
      mine.map(x=>`<div class="task${isDone(x)?' done':''}"><button class="chk" data-toggle="${esc(x.id)}" aria-label="Mark ${esc(x.title)} ${isDone(x)?'not done':'done'}"><i></i></button><button class="lbl" data-edit="${esc(x.id)}">${esc(x.title)}</button>${x.repeat!=='none'?`<span class="rep">${x.repeat==='daily'?'Daily':'Weekly'}</span>`:''}</div>`).join('')+'</div>'}).join('')
    :`<p class="empty">${people.length?'No tasks yet. Tap “+ Add” to give someone a chore.':'Open Settings to add the people in your family.'}</p>`;
  const rems=items.filter(i=>i.type==='reminder').sort((a,b)=>(a.date||'9').localeCompare(b.date||'9'));
  $('#rems').innerHTML=rems.length?rems.map(r=>`<div class="rem"><span class="av" style="background:${esc(colorOf(r.person_id))}">${esc(nameOf(r.person_id)[0])}</span><button class="lbl" data-edit="${esc(r.id)}">${esc(r.title)}<small>${r.date?esc(new Date(r.date+'T12:00').toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short'}))+(r.time?' '+esc(r.time):''):esc(nameOf(r.person_id))}</small></button><button class="ok" data-toggle="${esc(r.id)}" aria-label="Dismiss reminder">✓</button></div>`).join(''):'<p class="empty">No reminders.</p>';
  renderRewards();if($('#ovRw').classList.contains('on'))drawRw();renderBus();renderTrips();renderWx();applyTab()}

const lineTag=b=>`<span class="line"${b.bg?` style="background:${esc(b.bg)};color:${esc(b.fg||'#fff')}"`:''}>${esc(b.line)}</span>`;
const minTxt=m=>m<=0?'Now':m+' min';
function renderBus(){if(!hh)return;$('#busH').textContent='Next departures'+(hh.vt_stop?' · '+hh.vt_stop:'');const chip=$('#busChip');
  if(!hh.vt_gid){chip.hidden=true;$('#bus').innerHTML='<p class="empty">Choose your stop in Settings.</p>';return}
  const d=now(),rows=bus.list.filter(b=>!b.cancelled).map(b=>({...b,m:Math.round((new Date(b.time)-d)/6e4)})).filter(b=>b.m>=-1).slice(0,8);
  // Next to the tabs: a ticker of the next departures, always on screen. Tap it for the Bus tab.
  const nxt=rows.filter(b=>b.m>=0).slice(0,6),nx=nxt[0];chip.hidden=!nx;
  if(nx){const html=nxt.map(b=>`<span class="tki">${lineTag(b)}<span class="d">${esc(b.dest)}</span><b${b.m<=5?' class="soon"':''}>${minTxt(b.m)}</b></span>`).join('');
    if(chip.dataset.h!==html){chip.dataset.h=html;chip.innerHTML=`<span class="tk"><span class="tkm"><span class="tkr">${html}</span><span class="tkr" aria-hidden="true">${html}</span></span></span>`;fitTicker()}
    chip.setAttribute('aria-label',`Next bus: ${nx.line} to ${nx.dest}, ${minTxt(nx.m)}.`+(nxt.length>1?` Then ${nxt.slice(1).map(b=>`${b.line} to ${b.dest}, ${minTxt(b.m)}`).join('; ')}.`:'')+' Show all departures.')}
  $('#bus').innerHTML=(rows.length?rows.map(b=>`<div class="dep">${lineTag(b)}<span class="d">${esc(b.dest)}${b.platform?` <small>· ${esc(b.platform)}</small>`:''}</span><span class="m${b.m<=5?' soon':''}">${minTxt(b.m)}</span></div>`).join('')
    :`<p class="empty">${bus.err?'':'No departures in the next 90 minutes.'}</p>`)+(bus.err?`<p class="note">${esc(bus.err)}</p>`:'')}
// The ticker scrolls only when the departures don't fit, at a steady speed. Its position follows the clock,
// so redrawing it (every 15 s, when the minutes change) doesn't make it jump back to the start.
function fitTicker(){const chip=$('#busChip'),w=chip.querySelector('.tk'),r=chip.querySelector('.tkr');if(!w||chip.hidden)return;
  chip.classList.remove('scroll');const len=r.offsetWidth,still=matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(still||len<=w.clientWidth+1)return;
  const dur=Math.max(8,len/45),m=chip.querySelector('.tkm');chip.classList.add('scroll');
  m.style.animationDuration=dur+'s';m.style.animationDelay=-(Date.now()/1e3%dur)+'s'}
addEventListener('resize',()=>{clearTimeout(fitTicker.t);fitTicker.t=setTimeout(fitTicker,200)});
async function loadBus(){if(!hh?.vt_gid){renderBus();return}
  const{data,error}=await sb.functions.invoke('vasttrafik',{body:{action:'departures',gid:hh.vt_gid}});
  if(error||data?.error)bus={list:bus.list,err:'Live times unavailable right now.'};else bus={list:data.departures||[],err:''};renderBus()}

