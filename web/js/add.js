// The + Add / Edit dialog and tapping tasks and reminders on the board.
/* ---------- add / edit ---------- */
function setKind(k){kind=k;document.querySelectorAll('#kind button').forEach(b=>b.setAttribute('aria-pressed',b.dataset.k===k));
  $('#lRep').style.display=k==='task'?'':'none';$('#lCount').style.display=k==='event'?'flex':'none'}
function openAdd(it){editing=it||null;$('#addH').textContent=it?'Edit':'Add';
  $('#fWho').innerHTML='<option value="">Everyone</option>'+people.map(p=>`<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('');
  setKind(it?.type||kind);$('#fTitle').value=it?.title||'';$('#fWho').value=it?.person_id||'';$('#fDate').value=it?it.date||'':ymd(now());$('#fTime').value=it?.time||'';
  $('#fRep').value=it?.repeat||'none';$('#fCount').checked=!!it?.countdown;$('#fDel').style.display=it?'':'none';const ga=gOf(it);$('#fGNote').hidden=!ga;if(ga)$('#fGNote').textContent=`In ${ga.email}’s Google Calendar: changes and Delete go there too.`;$('#ovAdd').classList.add('on');$('#fTitle').focus()}
$('#addBtn').onclick=()=>openAdd();
$('#kind').onclick=e=>{const b=e.target.closest('button');if(b)setKind(b.dataset.k)};
$('#fAdd').onsubmit=e=>{e.preventDefault();const title=$('#fTitle').value.trim();if(!title)return;
  const it={...(editing||{id:'tmp'+Date.now(),done:false,done_on:null}),type:kind,title,person_id:$('#fWho').value||null,date:$('#fDate').value,time:$('#fTime').value,repeat:kind==='task'?$('#fRep').value:'none',countdown:kind==='event'&&$('#fCount').checked};
  if(editing&&editing.type==='task'&&(editing.repeat!==it.repeat||kind!=='task')){it.done=false;it.done_on=null}
  $('#ovAdd').classList.remove('on');saveItem(it)};
$('#fDel').onclick=()=>{if(editing)removeItem(editing.id,true);$('#ovAdd').classList.remove('on')};
document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>b.closest('.ov').classList.remove('on'));
document.querySelectorAll('.ov').forEach(o=>o.onclick=e=>{if(e.target===o)o.classList.remove('on')});
$('#vBoard').addEventListener('click',e=>{const tg=e.target.closest('[data-toggle]'),ed=e.target.closest('[data-edit]');
  if((tg||ed)&&isTmp((tg||ed).dataset.toggle||(tg||ed).dataset.edit))return;
  if(tg){const it=items.find(i=>i.id===tg.dataset.toggle);if(!it)return;if(it.type==='reminder')return removeItem(it.id);
    const d=isDone(it),k=it.repeat==='daily'?ymd(now()):it.repeat==='weekly'?weekKey(now()):'';
    saveItem(it.repeat!=='none'?{...it,done_on:d?null:k}:{...it,done:!d})}
  else if(ed){const it=items.find(i=>i.id===ed.dataset.edit);if(!it)return;
    if(held===ed){held=null;return}           // the press already opened it
    if(e.detail===0)return openAdd(it);       // Enter or Space from the keyboard
    if(it.type==='task')return $('#vBoard').querySelector(`[data-toggle="${CSS.escape(it.id)}"]`)?.click();  // a tap ticks a task
    toast('Hold to change or delete it')}});
// Press and hold (half a second) an appointment, task or reminder to change it, so a passing tap on the
// wall display doesn't open a dialog. A right-click does the same on a computer.
const HOLD_MS=500;let hold=null,held=null;
const holdEnd=()=>{if(!hold)return;clearTimeout(hold.t);hold.el.classList.remove('holding');hold=null};
const holdOpen=el=>{holdEnd();const it=items.find(i=>i.id===el.dataset.edit);if(!it||isTmp(it.id))return;held=el;
  try{navigator.vibrate?.(15)}catch(e){}openAdd(it)};
$('#vBoard').addEventListener('pointerdown',e=>{const ed=e.target.closest('[data-edit]');if(!ed||e.button>0||arranging)return;holdEnd();held=null;
  ed.classList.add('holding');hold={el:ed,x:e.clientX,y:e.clientY,t:setTimeout(()=>holdOpen(ed),HOLD_MS)}});
$('#vBoard').addEventListener('pointermove',e=>{if(hold&&Math.hypot(e.clientX-hold.x,e.clientY-hold.y)>12)holdEnd()});
['pointerup','pointercancel','pointerleave'].forEach(t=>$('#vBoard').addEventListener(t,holdEnd));
$('#vBoard').addEventListener('contextmenu',e=>{const ed=e.target.closest('[data-edit]');if(!ed)return;e.preventDefault();
  if(held!==ed&&!arranging)holdOpen(ed)});

