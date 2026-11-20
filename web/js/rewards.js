// Reward notes: the chart on the Rewards tab, the reward screen, earning and spending.
/* ---------- reward notes ---------- */
// Kids earn notes for things on their chart and spend them on rewards. Earning and spending go
// through database functions that check the once-a-day/week limits and the balance.
let rItems=[],rLog=[],rBal={},rOff=false,rw={pid:null,tab:'earn',edit:false,confirm:null},riEditing=null,riKind='earn',rwBusy=false,rwSeen=0;
async function loadRewards(){if(!hh)return;const since=ymd(new Date(Date.now()-40*864e5));
  const[a,b,c]=await Promise.all([sb.from('reward_items').select('*').eq('household_id',hh.id).order('sort').order('created_at'),
    sb.from('reward_balances').select('*').eq('household_id',hh.id),
    sb.from('reward_log').select('*').eq('household_id',hh.id).gte('day',since).order('created_at',{ascending:false}).limit(1000)]);
  const e=a.error||b.error||c.error;if(e){if(/^(PGRST20|42P01)/.test(e.code||''))rOff=true;return}
  rOff=false;rItems=a.data;rLog=c.data;rBal=Object.fromEntries(b.data.map(x=>[x.person_id,x.balance]))}
const today=()=>ymd(now());
const bal=pid=>rBal[pid]||0;
const forPid=(it,pid)=>!it.person_id||it.person_id===pid;
const doneFor=(it,pid)=>it.per!=='any'&&rLog.some(l=>l.item_id===it.id&&l.person_id===pid&&(it.per==='day'?l.day===today():weekKey(new Date(l.day+'T12:00'))===weekKey(now())));
// On the chart: people with their own list or any notes; if the list is only "everyone" items, everyone.
function rwPeople(){const own=people.filter(p=>rItems.some(i=>i.person_id===p.id)||p.id in rBal||rLog.some(l=>l.person_id===p.id));return own.length?own:rItems.length?people:[]}
const goalOf=p=>{const g=p?.goal_item&&rItems.find(i=>i.id===p.goal_item);return g&&g.kind==='spend'?g:null};
const dayLabel=d=>d===today()?'Today':d===ymd(new Date(Date.now()-864e5))?'Yesterday':new Date(d+'T12:00').toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short'});
function renderRewards(){if(rOff)return;const kids=rwPeople();
  if(!kids.length){$('#rw').innerHTML=people.length?`<p class="empty" style="margin-bottom:10px">Kids earn notes for chores and good habits, then spend them on rewards.</p><div class="find"><select id="rwSeedWho" aria-label="Who the chart is for">${people.map(p=>`<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('')}</select><button type="button" class="btn pri" id="rwSeed">Start with the example chart</button></div><button type="button" class="btn" id="rwOwn" style="margin-top:8px">Or build your own</button>`:'<p class="empty">Open Settings to add the people in your family.</p>';return}
  const row=(i,p)=>{const b=bal(p.id),earn=i.kind==='earn',done=earn&&doneFor(i,p.id),cant=!earn&&b<i.notes,goal=p.goal_item===i.id;
    const pr=earn?(done?'✓':'+'+i.notes):(goal?'★ ':'')+i.notes;
    return `<button type="button" class="rwi${earn?'':' sp'}${done?' done':''}${cant?' cant':''}${goal?' goal':''}" data-ri="${esc(i.id)}" data-pid="${esc(p.id)}" style="--c:${esc(p.color)}" aria-label="${esc(i.title)}: ${earn?(done?'done '+(i.per==='week'?'this week':'today'):'earn '+i.notes+' notes'):'costs '+i.notes+' notes'}"><span class="ic">${esc(i.icon||(earn?'⭐':'🎁'))}</span><span>${esc(i.title)}</span><span class="pr">${pr}</span></button>`};
  // Earn groups first, then rewards, in chart order; each group is one column block.
  const chart=p=>{const mine=rItems.filter(i=>forPid(i,p.id));if(!mine.length)return '<p class="empty">Nothing on the chart yet. Tap the name, then “Edit chart”.</p>';
    const groups=[];for(const k of['earn','spend'])for(const c of[...new Set(mine.filter(i=>i.kind===k).map(i=>i.category||''))])groups.push([k,c,mine.filter(i=>i.kind===k&&(i.category||'')===c)]);
    return '<div class="rwc">'+groups.map(([k,c,l])=>`<div class="rwg"><h4>${k==='spend'?'🎁 ':''}${esc(c||(k==='spend'?'Rewards':'Earn notes'))}</h4>${l.map(i=>row(i,p)).join('')}</div>`).join('')+'</div>'};
  $('#rw').innerHTML=kids.map(p=>{const b=bal(p.id),t=rLog.filter(l=>l.person_id===p.id&&l.day===today()&&l.notes>0).reduce((s,l)=>s+l.notes,0),g=goalOf(p);
    return `<div class="rwp"><button class="rwk" data-rw="${esc(p.id)}"><span class="av" style="background:${esc(p.color)}">${esc(p.name[0]||'?')}</span><span><b>${esc(p.name)}</b><small>${t?'+'+t+' today · ':''}Tap for history, bonus & edit</small></span><span class="bal">${b}<small> notes</small></span></button>`+
      (g?`<div class="goal"><span>${esc(g.icon||'★')} Saving for ${esc(g.title)}</span><span>${b>=g.notes?'Ready!':Math.max(b,0)+' / '+g.notes}</span></div><div class="bar"><i style="width:${Math.min(100,Math.max(0,b)/g.notes*100)}%;background:${esc(p.color)}"></i></div>`:'')+chart(p)+'</div>'}).join('');fitRw()}
// Chart size on the Rewards tab (Settings → Display, per device). Automatic picks the biggest size
// that fits the box without scrolling, never smaller than Small (rows stay at least 42px to tap).
const RSK='fhd.rwsize',rwSizePref=()=>{try{return localStorage.getItem(RSK)||'auto'}catch(e){return'auto'}};
function fitRw(){const el=$('#rw'),pref=rwSizePref(),set=v=>el.style.setProperty('--rs',v);
  if(pref!=='auto')return set(pref);
  if(innerWidth<700||!el.clientHeight||!el.querySelector('.rwc'))return set(1);
  const fits=v=>{set(v);return el.scrollHeight<=el.clientHeight+1};
  if(!fits(1))return;let lo=1,hi=1.7;if(fits(hi))return;
  for(let k=0;k<6;k++){const m=(lo+hi)/2;if(fits(m))lo=m;else hi=m}set(Math.floor(lo*100)/100)}
let rwFitW=0,rwFitH=0;
try{new ResizeObserver(()=>{const el=$('#rw');if(el.clientWidth===rwFitW&&el.clientHeight===rwFitH)return;rwFitW=el.clientWidth;rwFitH=el.clientHeight;fitRw()}).observe($('#rw'))}catch(e){}
$('#sRwSize').onchange=e=>{try{localStorage.setItem(RSK,e.target.value)}catch(err){}fitRw()};
function openRw(pid,tab){const list=rwPeople().length?rwPeople():people;rw.pid=pid||rw.pid;if(!list.some(k=>k.id===rw.pid))rw.pid=list[0]?.id||null;if(!rw.pid)return;
  rw.tab=tab||'earn';rw.edit=false;rw.confirm=null;rwSeen=Date.now();$('#ovRw').classList.add('on');drawRw()}
function drawRw(){const list=rwPeople().length?rwPeople():people,p=person(rw.pid);if(!p){$('#ovRw').classList.remove('on');return}
  $('#rwWho').innerHTML=list.length>1?list.map(k=>`<button type="button" data-p="${esc(k.id)}" aria-pressed="${k.id===rw.pid}">${esc(k.name)}</button>`).join(''):`<b style="font-size:24px">${esc(p.name)}</b>`;
  $('#rwBal').innerHTML=`${bal(p.id)}<small> notes</small>`;
  $('#rwTab').querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',b.dataset.t===rw.tab));
  $('#rwEdit').hidden=rw.tab==='hist';$('#rwEdit').textContent=rw.edit?'Done editing':'Edit chart';$('#rwEdit').setAttribute('aria-pressed',rw.edit);
  const cf=rw.confirm&&rItems.find(i=>i.id===rw.confirm);$('#rwConfirm').hidden=!cf;
  if(cf)$('#rwConfirm').innerHTML=`<span style="flex:1">Spend <b>${cf.notes} notes</b> on ${esc(cf.icon||'')} ${esc(cf.title)}?</span><button type="button" class="btn" data-cf="no">Not now</button><button type="button" class="btn pri" data-cf="yes">Yes, spend</button>`;
  if(rw.tab==='hist'){const h=rLog.filter(l=>l.person_id===p.id).slice(0,40);
    $('#rwBody').innerHTML=`<div class="find" style="grid-template-columns:minmax(0,1fr) 84px auto auto;margin-bottom:8px"><input id="adjT" placeholder="Bonus or take away, e.g. Helped grandma" maxlength="80" aria-label="Reason"><input type="number" id="adjN" min="1" max="1000" value="1" aria-label="Notes" inputmode="numeric"><button type="button" class="btn" data-adj="1">+ Give</button><button type="button" class="btn" data-adj="-1">− Take</button></div>`+
      (h.length?h.map(l=>`<div class="hist"><span style="font-size:24px;text-align:center">${esc(l.icon||(l.notes>0?'⭐':'🎁'))}</span><span>${esc(l.title)}<br><small class="msg">${esc(dayLabel(l.day))}</small></span><span class="n${l.notes<0?' minus':''}">${l.notes>0?'+':''}${l.notes}</span><button type="button" class="ok" data-undo="${esc(l.id)}" aria-label="Undo ${esc(l.title)}">×</button></div>`).join(''):'<p class="empty">Nothing in the last few weeks.</p>');return}
  const mine=rItems.filter(i=>i.kind===rw.tab&&forPid(i,p.id)),cats=[...new Set(mine.map(i=>i.category||''))],b=bal(p.id);
  const tile=i=>{const done=rw.tab==='earn'&&doneFor(i,p.id),cant=rw.tab==='spend'&&b<i.notes,goal=p.goal_item===i.id;
    const pr=rw.tab==='earn'?(done?'✓ '+(i.per==='week'?'This week':'Today'):'+'+i.notes):(cant&&!rw.edit?'Need '+(i.notes-Math.max(b,0))+' more':i.notes+' notes');
    return `<div class="tw"><button type="button" class="tile${done?' done':''}${cant?' cant':''}${rw.edit?' edit':''}" data-ri="${esc(i.id)}" style="--c:${esc(p.color)}"><span class="ic">${esc(i.icon||(i.kind==='earn'?'⭐':'🎁'))}</span><span>${esc(i.title)}</span><span class="pr">${pr}</span></button>`+
      (rw.tab==='spend'&&!rw.edit?`<button type="button" class="star${goal?' on':''}" data-goal="${esc(i.id)}" aria-label="${goal?'Stop saving for':'Save up for'} ${esc(i.title)}" aria-pressed="${goal}">${goal?'★':'☆'}</button>`:'')+'</div>'};
  $('#rwBody').innerHTML=(mine.length?cats.map(c=>(c?`<h4 class="cat">${esc(c)}</h4>`:'')+`<div class="tiles">${mine.filter(i=>(i.category||'')===c).map(tile).join('')}</div>`).join('')
      :`<p class="empty">${rw.tab==='earn'?'Nothing to earn yet.':'No rewards yet.'} Tap “Edit chart” to add some.</p>`)+
    (rw.tab==='spend'&&mine.length&&!rw.edit?'<p class="note">Tap ☆ to save up for a reward. It shows on the display.</p>':'')+
    (rw.edit?`<div class="tiles" style="margin-top:12px"><button type="button" class="tile" id="riNew"><span class="ic">＋</span><span>${rw.tab==='earn'?'Add a way to earn':'Add a reward'}</span></button></div>`:'')}
$('#rw').onclick=e=>{const k=e.target.closest('[data-rw]');if(k)return openRw(k.dataset.rw);
  const r=e.target.closest('[data-ri]');if(r){const it=rItems.find(i=>i.id===r.dataset.ri),pid=r.dataset.pid;if(!it)return;
    if(it.kind==='earn'){if(doneFor(it,pid))return toast(`Already done ${it.per==='week'?'this week':'today'}. Well done!`);return rwAct('earn',it.id,pid)}
    const b=bal(pid);if(b<it.notes)return toast(`${it.notes-Math.max(b,0)} more notes to go. Keep going!`);openRw(pid,'spend');rw.confirm=it.id;return drawRw()}
  const sd=e.target.closest('#rwSeed');if(sd){sd.disabled=true;return seed($('#rwSeedWho').value)}
  if(e.target.closest('#rwOwn')){openRw($('#rwSeedWho')?.value);rw.edit=true;drawRw()}};
$('#ovRw').addEventListener('pointerdown',()=>rwSeen=Date.now());
$('#rwWho').onclick=e=>{const b=e.target.closest('[data-p]');if(b){rw.pid=b.dataset.p;rw.confirm=null;drawRw()}};
$('#rwTab').onclick=e=>{const b=e.target.closest('[data-t]');if(b){rw.tab=b.dataset.t;rw.confirm=null;drawRw()}};
$('#rwEdit').onclick=()=>{rw.edit=!rw.edit;rw.confirm=null;drawRw()};
$('#rwConfirm').onclick=e=>{const b=e.target.closest('[data-cf]');if(!b)return;const id=rw.confirm;rw.confirm=null;drawRw();if(b.dataset.cf==='yes')rwAct('spend',id)};
$('#rwBody').onclick=e=>{if(e.target.closest('#riNew'))return openRi(null);
  const g=e.target.closest('[data-goal]'),u=e.target.closest('[data-undo]'),a=e.target.closest('[data-adj]'),t=e.target.closest('[data-ri]');
  if(g)return setGoal(g.dataset.goal);if(u)return undo(u.dataset.undo);if(a)return adjust(+a.dataset.adj);if(!t)return;
  const it=rItems.find(i=>i.id===t.dataset.ri);if(!it)return;if(rw.edit)return openRi(it);
  if(it.kind==='earn'){if(doneFor(it,rw.pid))return toast(`Already done ${it.per==='week'?'this week':'today'}. Well done!`);rwAct('earn',it.id)}
  else{const b=bal(rw.pid);if(b<it.notes)return toast(`${it.notes-Math.max(b,0)} more notes to go. Keep going!`);rw.confirm=it.id;drawRw()}};
async function rwAct(k,id,pid=rw.pid){if(rwBusy)return;rwBusy=true;const p=person(pid);
  const{data,error}=await sb.rpc(k==='earn'?'reward_earn':'reward_spend',{p_item:id,p_person:pid,p_day:today()});rwBusy=false;
  if(error)return toast(errText(error));
  rLog.unshift(data);rBal[pid]=bal(pid)+data.notes;render();
  for(const el of[$('#ovRw').classList.contains('on')&&$('#rwBal'),$(`#rw [data-rw="${CSS.escape(pid)}"] .bal`)])if(el){el.classList.remove('pop');void el.offsetWidth;el.classList.add('pop')}
  toast(k==='earn'?`+${data.notes} notes for ${p?.name||''} 🎉`:`Enjoy! ${data.icon||''} ${data.title}`,data.id);refetch()}
async function undo(id){const l=rLog.find(x=>x.id===id);if(!l)return;hideToast();rLog=rLog.filter(x=>x.id!==id);rBal[l.person_id]=bal(l.person_id)-l.notes;render();
  const{error}=await sb.from('reward_log').delete().eq('id',id);if(error)toast('Couldn’t undo: '+errText(error));refetch()}
async function adjust(sign){const n=Math.abs(parseInt($('#adjN').value,10)||0);if(!n||!rw.pid)return;const title=$('#adjT').value.trim()||(sign>0?'Bonus':'Taken away');
  const{data,error}=await sb.from('reward_log').insert({household_id:hh.id,person_id:rw.pid,title,icon:sign>0?'🌟':'➖',notes:sign*n,day:today()}).select().single();
  if(error)return toast('Couldn’t save: '+errText(error));rLog.unshift(data);rBal[rw.pid]=bal(rw.pid)+data.notes;render();refetch()}
async function setGoal(id){const p=person(rw.pid);if(!p)return;const v=p.goal_item===id?null:id;p.goal_item=v;render();
  const{error}=await sb.from('people').update({goal_item:v}).eq('id',p.id);if(error)toast('Couldn’t save: '+errText(error));refetch()}
let toT=0;function toast(t,undoId){const el=$('#toast');el.innerHTML=`<span>${esc(t)}</span>`+(undoId?`<button type="button" data-undo="${esc(undoId)}">Undo</button>`:'');el.hidden=false;clearTimeout(toT);toT=setTimeout(hideToast,undoId?8000:3500)}
function hideToast(){$('#toast').hidden=true}
$('#toast').onclick=e=>{const u=e.target.closest('[data-undo]');if(u)undo(u.dataset.undo)};
// Close the reward screen on the wall after 3 minutes without a tap.
setInterval(()=>{if($('#ovRw').classList.contains('on')&&!$('#ovRi').classList.contains('on')&&Date.now()-rwSeen>18e4)$('#ovRw').classList.remove('on')},15000);

function setRiKind(k){riKind=k;$('#riKind').querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',b.dataset.k===k));
  $('#riPerL').style.visibility=k==='earn'?'':'hidden';$('#riNotesL').firstChild.textContent=k==='earn'?'Notes earned':'Costs (notes)'}
function openRi(it){riEditing=it;$('#riH').textContent=it?'Edit':rw.tab==='spend'?'Add a reward':'Add a way to earn';setRiKind(it?.kind||(rw.tab==='spend'?'spend':'earn'));
  $('#riIcon').value=it?.icon||'';$('#riTitle').value=it?.title||'';$('#riNotes').value=it?.notes||'';$('#riCat').value=it?.category||'';$('#riPer').value=it?.per||'day';
  $('#riWho').innerHTML='<option value="">Everyone on the chart</option>'+people.map(p=>`<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('');$('#riWho').value=it?it.person_id||'':rw.pid||'';
  $('#riCats').innerHTML=[...new Set(rItems.map(i=>i.category).filter(Boolean))].map(c=>`<option value="${esc(c)}">`).join('');
  $('#riDel').style.display=it?'':'none';msg($('#riMsg'),'');$('#ovRi').classList.add('on');$('#riTitle').focus()}
$('#riKind').onclick=e=>{const b=e.target.closest('[data-k]');if(b)setRiKind(b.dataset.k)};
$('#fRi').onsubmit=async e=>{e.preventDefault();const body={household_id:hh.id,kind:riKind,icon:$('#riIcon').value.trim()||null,title:$('#riTitle').value.trim(),notes:parseInt($('#riNotes').value,10),
    category:$('#riCat').value.trim()||null,per:riKind==='earn'?$('#riPer').value:'any',person_id:$('#riWho').value||null};
  if(!body.title||!(body.notes>0))return;if(!riEditing)body.sort=rItems.reduce((m,i)=>Math.max(m,i.sort),0)+1;
  const r=riEditing?await sb.from('reward_items').update(body).eq('id',riEditing.id):await sb.from('reward_items').insert(body);
  if(r.error)return msg($('#riMsg'),'Couldn’t save: '+errText(r.error),true);$('#ovRi').classList.remove('on');await loadAll()};
$('#riDel').onclick=async()=>{if(!riEditing)return;const r=await sb.from('reward_items').delete().eq('id',riEditing.id);
  if(r.error)return msg($('#riMsg'),'Couldn’t delete: '+errText(r.error),true);$('#ovRi').classList.remove('on');await loadAll()};

// Example chart (Mirali's posters). Everything can be edited afterwards with "Edit chart".
const STARTER=[
  ['earn','Essential skills',[['📖','Read for 30 min',3],['✏️','Write a short story',3],['🔤','Practise 5 spelling words',2],['➕','Maths worksheet',3],['✍️','Practise handwriting (A–Z)',1]]],
  ['earn','Exploration & curiosity',[['💬','Tell a summarised story',2],['🧩','Jigsaw puzzle (100+ pieces)',2],['🐜','Nature observation',2],['🧱','Build blocks from the manual',3],['🔍','Learn a new word',1]]],
  ['earn','Chores & helping',[['🛏️','Make your bed',1],['🧸','Tidy up toys',2],['🧺','Dirty clothes in the hamper',1],['🥣','Breakfast finished by 7:15',2],['🪥','Teeth brushed & dressed by 7:30',3]]],
  ['earn','Habits',[['🧼','Wash as soon as you get home',2],['🛁','Bath done before the alarm',2],['🍽️','Finish food without wasting',3],['🌙','Teeth brushed & ready for bed by 19:15',3],['😴','Sleep alone',4]]],
  ['earn','Housekeeping hero',[['🧽','Dust low surfaces',1],['🧦','Fold socks & small towels',2],['🍴','Wipe the dinner table',1],['♻️','Sort recycling',1],['🧹','Clean your room for 10 min',2]]],
  ['earn','Wellbeing wizard',[['🫧','Wash hands properly (30 sec)',1],['🥦','Eat a portion of vegetables',2],['🤸','5 minutes of stretches',2],['😊','Tell Mom/Dad one happy thing',1],['🌬️','10 calm deep breaths',1]]],
  ['spend','Screen time',[['📺','30 min TV or tablet',5],['📱','60 min TV or tablet',9],['🎬','Choose the family movie',10]]],
  ['spend','Treats & privileges',[['🍫','Chocolate on Saturday',5],['🍕','Choose tonight’s dinner',15],['🌟','Stay up 15 min (weekend)',15],['🦁','Trip to Leo’s Lekland',30]]]];
async function seed(pid){let n=0;const rows=[];for(const[kind,category,list]of STARTER)for(const[icon,title,notes]of list)rows.push({household_id:hh.id,person_id:pid,kind,category,icon,title,notes,per:kind==='earn'?'day':'any',sort:n++});
  const{data,error}=await sb.from('reward_items').insert(rows).select();if(error){toast('Couldn’t set up the chart: '+errText(error));renderRewards();return}
  const g=data.find(i=>/Lekland/.test(i.title));if(g)await sb.from('people').update({goal_item:g.id}).eq('id',pid);await loadAll();openRw(pid,'earn')}

