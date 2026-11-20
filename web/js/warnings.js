// SMHI weather warnings for where the family lives (Weather tab). SMHI's open data: free, no key,
// and it answers the browser directly. Fetched with the weather (every 15 minutes).
// Each warning area comes with its outline on the map, so only the ones that cover home are kept.
// Yellow, orange and red warnings only: SMHI's "messages" (like a risk of water shortage) are left out.
const SMHI_WARN='https://opendata-download-warnings.smhi.se/ibww/api/version/1/warning.json';
const WLV={YELLOW:{n:'Yellow warning',r:1,c:'y'},ORANGE:{n:'Orange warning',r:2,c:'o'},RED:{n:'Red warning',r:3,c:'r'}};
let warn=null; // null until the first answer; then {list:[...], err:''}
const inSweden=(lat,lon)=>lat>=55&&lat<=69.2&&lon>=10.5&&lon<=24.3;
// Is the point inside the outline? Ray casting on [lon,lat] rings; the first ring is the outline, the rest are holes.
function inRing(x,y,r){let ins=false;for(let i=0,j=r.length-1;i<r.length;j=i++){const[xi,yi]=r[i],[xj,yj]=r[j];
  if((yi>y)!==(yj>y)&&x<(xj-xi)*(y-yi)/(yj-yi)+xi)ins=!ins}return ins}
const inPoly=(x,y,p)=>!!p?.length&&inRing(x,y,p[0])&&!p.slice(1).some(h=>inRing(x,y,h));
const geoms=a=>!a?[]:a.type==='FeatureCollection'?(a.features||[]).flatMap(geoms):a.type==='Feature'?geoms(a.geometry):a.type==='GeometryCollection'?(a.geometries||[]).flatMap(geoms):[a];
const covers=(area,lat,lon)=>geoms(area).some(g=>g.type==='Polygon'?inPoly(lon,lat,g.coordinates):g.type==='MultiPolygon'&&(g.coordinates||[]).some(p=>inPoly(lon,lat,p)));
const en=o=>o?.en||o?.sv||'';
async function loadWarn(){if(!hh?.lat||!inSweden(hh.lat,hh.lon)){warn=null;renderWarn();return}
  try{const r=await fetch(SMHI_WARN);if(!r.ok)throw 0;const j=await r.json(),t=Date.now();
    const list=(Array.isArray(j)?j:[]).flatMap(w=>(w.warningAreas||[])
      .filter(a=>WLV[a.warningLevel?.code]&&!(a.approximateEnd&&new Date(a.approximateEnd)<=t)&&covers(a.area,hh.lat,hh.lon))
      .map(a=>({id:a.id,lv:a.warningLevel.code,what:en(a.eventDescription)||en(w.event),area:en(a.areaName),from:a.approximateStart||'',to:a.approximateEnd||'',
        text:en((a.descriptions||[]).find(d=>d.title?.code==='INCIDENT')?.text),tip:en((a.descriptions||[]).find(d=>d.title?.code==='AFFECT')?.text)})));
    list.sort((a,b)=>WLV[b.lv].r-WLV[a.lv].r||a.from.localeCompare(b.from));warn={list,err:''}}
  catch(e){warn={list:warn?.list||[],err:'Couldn’t reach SMHI just now.'}}renderWarn()}
// "14:00", "tomorrow 06:00" or "Mon 12:00".
function whenTxt(s){const d=new Date(s),n=now(),t=new Date(n);t.setDate(t.getDate()+1);const hm=pad(d.getHours())+':'+pad(d.getMinutes());
  return ymd(d)===ymd(n)?hm:ymd(d)===ymd(t)?'tomorrow '+hm:d.toLocaleDateString('en-GB',{weekday:'short'})+' '+hm}
function warnWhen(w){const started=!w.from||new Date(w.from)<=now();
  if(started)return w.to?'Now until '+whenTxt(w.to):'Now';
  const f=whenTxt(w.from);return(f[0].toUpperCase()+f.slice(1))+(w.to?' to '+whenTxt(w.to):'')}
function renderWarn(){const el=$('#warn'),card=$('#warnCard');if(!el)return;const top=warn?.list?.[0];
  card.classList.remove('wy','wo','wr');if(top)card.classList.add('w'+WLV[top.lv].c);
  if(!hh?.lat){el.innerHTML='<p class="empty">Choose your town in Settings.</p>';return}
  if(!inSweden(hh.lat,hh.lon)){el.innerHTML='<p class="empty">SMHI’s warnings cover Sweden only.</p>';return}
  if(!warn){el.innerHTML='<p class="empty">Loading…</p>';return}
  if(!warn.list.length){el.innerHTML=warn.err?`<p class="empty">${esc(warn.err)}</p>`:`<p class="wok"><b>✓</b> No weather warnings for ${esc(hh.place||'your area')}</p>`;return}
  el.innerHTML=warn.list.map(w=>`<div class="wn ${WLV[w.lv].c}"><i class="sym" aria-hidden="true"></i><div>
    <b>${esc(w.what)}</b><small class="when">${esc(warnWhen(w))}</small><small>${WLV[w.lv].n}${w.area?' · '+esc(w.area):''}</small>
    ${w.text?`<p>${esc(w.text)}</p>`:''}${w.tip?`<details><summary>What to think about</summary><p>${esc(w.tip)}</p></details>`:''}</div></div>`).join('')}
