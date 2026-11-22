// Weather from Open-Meteo: the header, and the Weather tab (the hours ahead, rain in the next 2 hours,
// what to wear and the next 7 days). The SMHI warnings box is in warnings.js.
// Open-Meteo weather codes → words and an icon (night versions when the sun is down).
const wxWord=c=>c===0?'Clear':c===1?'Mostly clear':c===2?'Partly cloudy':c===3?'Cloudy':c<=48?'Fog':c<=57?'Drizzle':c<=67?'Rain':c<=77?'Snow':c<=82?'Showers':c<=86?'Snow showers':'Thunder';
const wxIcon=(c,day)=>c<=1?(day?'☀️':'🌙'):c===2?(day?'⛅':'☁️'):c===3?'☁️':c<=48?'🌫️':c<=57?'🌦️':c<=67?'🌧️':c<=77?'🌨️':c<=82?(day?'🌦️':'🌧️'):c<=86?'🌨️':'⛈️';
const isSnow=c=>(c>=71&&c<=77)||c===85||c===86;
const wxEmpty=t=>`<p class="empty">${t}</p>`;
function renderWx(){if(!hh)return;const fc=$('#fc');$('#wxH').textContent='Weather'+(hh.place?' · '+hh.place:'');
  if(!hh.lat||!wx){$('#wx').innerHTML=hh.lat?'':'<span>Set your town in Settings<br>to see the weather</span>';fc.hidden=true;
    const t=hh.lat?'Loading the forecast…':'Choose your town in Settings to see the forecast.';
    for(const id of ['#fcE','#rain2','#wear','#week'])$(id).innerHTML=wxEmpty(t);$('#fcE').hidden=false;renderWarn();return}
  $('#fcE').hidden=true;
  $('#wx').innerHTML=`<span class="ic" aria-hidden="true">${wxIcon(wx.code,wx.day)}</span><b>${Math.round(wx.t)}°</b><span><em>${esc(wxWord(wx.code))}</em><br>Feels ${Math.round(wx.feel)}° · ${Math.round(wx.wind)} m/s<br>${Math.round(wx.hi)}° / ${Math.round(wx.lo)}°${wx.rain>=20?' · 💧'+wx.rain+'%':''}</span>`;
  // The rest of today, hour by hour (every 2 hours if that's a lot); late in the evening it runs on into tomorrow morning.
  const d=now(),key=ymd(d)+'T'+pad(d.getHours()),i0=wx.hours.findIndex(h=>h.time.slice(0,13)>key);
  let next=i0<0?[]:wx.hours.slice(i0);const todayN=next.filter(h=>h.time.startsWith(ymd(d))).length;
  next=todayN>=6?next.slice(0,todayN):next.slice(0,8);const step=next.length>9?2:1;next=next.filter((_,i)=>i%step===0);
  fc.hidden=!next.length;let last=ymd(d);
  fc.innerHTML=next.map(h=>{const nd=!h.time.startsWith(last);last=h.time.slice(0,10);
    return `<div${nd?' class="nd"':''}><small>${nd?esc(new Date(h.time.slice(0,10)+'T12:00').toLocaleDateString('en-GB',{weekday:'short'}))+' ':''}${h.time.slice(11,13)}</small><i title="${esc(wxWord(h.code))}">${wxIcon(h.code,h.day)}</i><b>${Math.round(h.t)}°</b><span class="p">${h.p>=20?h.p+'%':''}</span></div>`}).join('');
  renderRain();renderWear();renderWeek();renderWarn()}

// Rain in the next 2 hours, in 15-minute steps. Open-Meteo labels each step with its end time
// and gives the rain that fell in the 15 minutes before it, so the step now under way is the first one ending after now.
const hhmm=d=>pad(d.getHours())+':'+pad(d.getMinutes());
function renderRain(){const el=$('#rain2'),d=now(),m=(wx.mins||[]).filter(q=>new Date(q.time)>d).slice(0,8);
  if(m.length<4){el.innerHTML=wxEmpty('No minute-by-minute forecast for here right now.');return}
  const wet=q=>q.p>=0.05,start=q=>new Date(new Date(q.time)-9e5),rate=q=>q.p*4;
  const snow=m.reduce((s,q)=>s+q.snow,0)>0&&m.filter(wet).every(q=>q.snow>0),noun=snow?'snow':'rain';
  const peak=Math.max(...m.map(rate)),kind=peak>=4?'Heavy '+noun:peak<1?'Light '+noun:noun[0].toUpperCase()+noun.slice(1);
  let head;const f=m.findIndex(wet);
  if(f<0)head='Dry for the next 2 hours';
  else{const stop=m.findIndex((q,i)=>i>f&&!wet(q)),stopTxt=stop<0?'':hhmm(new Date(m[stop-1].time));
    head=f===0?(stop<0?kind+' for the next 2 hours':kind+' now, stopping around '+stopTxt)
      :kind+' from around '+hhmm(start(m[f]))+(stop<0?'':', until about '+stopTxt)}
  const end=new Date(m[m.length-1].time),mid=start(m[Math.floor(m.length/2)]);
  el.innerHTML=`<p class="rh${f<0?' dry':''}">${esc(head)}</p>
    <div class="rbars" role="img" aria-label="${esc(head)}">${m.map(q=>`<i title="${hhmm(start(q))}: ${q.p.toFixed(1)} mm"><b style="height:${wet(q)?Math.max(8,Math.min(100,Math.sqrt(rate(q)/6)*100)):0}%"></b></i>`).join('')}</div>
    <div class="rx"><span>Now</span><span>${hhmm(mid)}</span><span>${hhmm(end)}</span></div>`}

// What to wear: from the "feels like" temperature, rain, snow and wind for the rest of the school day
// (07–17, or the next 3 hours if that's later). From 17:00 it shows tomorrow.
// Emoji has no winter hat (🧢 is a cap), so the hat is a small drawn beanie with a pom-pom.
const BEANIE='<svg class="beanie" viewBox="0 0 32 32" aria-hidden="true"><path d="M5 22C5 13 10 9 16 9s11 4 11 13z" fill="#e0533f"/><path d="M11 11.5C9 14 8.5 17 8.5 21M16 9.5V21M21 11.5c2 2.5 2.5 5.5 2.5 9.5" stroke="#c43c2a" stroke-width="1.2" fill="none" stroke-linecap="round"/><rect x="3.5" y="20" width="25" height="7.5" rx="2.5" fill="#b8321f"/><path d="M8 21.5v4.5M12 21.5v4.5M16 21.5v4.5M20 21.5v4.5M24 21.5v4.5" stroke="#8f2516" stroke-width="1.2" stroke-linecap="round"/><circle cx="16" cy="6" r="3.6" fill="#f3efe8" stroke="#d8d0c4" stroke-width=".8"/></svg>';
function wearTips(feel,wet,snow,wind){const t=[];
  if(feel<-10)t.push(['🧥','Winter overall + wool layer'],[BEANIE,'Warm hat'],['🧤','Thick mittens'],['🧣','Scarf or neck warmer'],['🥾','Winter boots']);
  else if(feel<0)t.push(['🧥','Winter overall'],[BEANIE,'Hat'],['🧤','Mittens'],['🥾','Winter boots']);
  else if(feel<7)t.push(wet&&!snow?['🧥','Lined rain jacket and trousers']:['🧥','Lined jacket and trousers'],[BEANIE,'Thin hat'],['🧤','Gloves'],wet?['👢','Lined rubber boots']:['👟','Warm shoes']);
  else if(feel<14)t.push(wet?['🧥','Rain jacket and rain trousers']:['🧥','Light jacket'],['👖','Long trousers'],wet?['👢','Rubber boots']:['👟','Trainers']);
  else if(feel<20)t.push(wet?['🧥','Rain jacket']:['👕','Sweater or thin jacket'],wet?['👢','Rubber boots']:['👟','Trainers']);
  else t.push(['👕','T-shirt and shorts'],['🧢','Sun hat'],...(wet?[['🧥','Thin rain jacket']]:[]));
  if(wind>=10&&feel>=0)t.push(['💨','Windproof outer layer']);
  return t}
function renderWear(){const el=$('#wear'),d=now(),h=d.getHours();let day=ymd(d),from=Math.max(7,h),to=Math.max(17,h+3),when='Today';
  if(h>=17){const t=new Date(d);t.setDate(t.getDate()+1);day=ymd(t);from=7;to=17;when='Tomorrow'}
  const hs=wx.hours.filter(x=>x.time.startsWith(day)&&+x.time.slice(11,13)>=from&&+x.time.slice(11,13)<=to);
  if(!hs.length){el.innerHTML=wxEmpty('No forecast for those hours yet.');return}
  const feel=Math.min(...hs.map(x=>x.feel)),prob=Math.max(...hs.map(x=>x.p)),mm=hs.reduce((s,x)=>s+x.mm,0),wind=Math.max(...hs.map(x=>x.wind));
  const wet=prob>=50||mm>=1,snow=hs.some(x=>isSnow(x.code));
  const bits=[`${when} ${pad(from)}–${pad(to)}`,`feels ${Math.round(feel)}°`];if(wet)bits.push(snow?'snow likely':'rain likely');if(wind>=10)bits.push(`windy, ${Math.round(wind)} m/s`);
  el.innerHTML=`<p class="wh">${esc(bits.join(' · '))}</p><ul class="wear">${wearTips(feel,wet,snow,wind).map(([i,n])=>`<li><i aria-hidden="true">${i}</i>${esc(n)}</li>`).join('')}</ul>`}

// The next 7 days: icon, chance of rain, low and high, and a bar for each day's range within the week's.
function renderWeek(){const el=$('#week'),D=wx.days||[];if(!D.length){el.innerHTML=wxEmpty('No forecast for the week yet.');return}
  const lo=Math.min(...D.map(x=>x.lo)),hi=Math.max(...D.map(x=>x.hi)),span=Math.max(1,hi-lo),today=ymd(now());
  el.innerHTML=D.map(x=>{const dt=new Date(x.date+'T12:00'),name=x.date===today?'Today':dt.toLocaleDateString('en-GB',{weekday:'short'})+' '+dt.getDate();
    const rain=x.rain>=20?`${x.rain}%${x.mm>=1?` <small>${Math.round(x.mm)} mm</small>`:''}`:'';
    return `<div class="dayrow${x.date===today?' now':''}"><span class="d">${esc(name)}</span><i title="${esc(wxWord(x.code))}">${wxIcon(x.code,true)}</i><span class="p">${rain}</span>
      <span class="lo">${Math.round(x.lo)}°</span><span class="bar"><b style="left:${(x.lo-lo)/span*100}%;right:${(hi-x.hi)/span*100}%"></b></span><span class="hi">${Math.round(x.hi)}°</span></div>`}).join('')}

async function loadWeather(){loadWarn();if(!hh?.lat){wx=null;renderWx();return}
  try{const r=await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${hh.lat}&longitude=${hh.lon}&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m,is_day`
      +`&hourly=temperature_2m,apparent_temperature,weather_code,precipitation_probability,precipitation,wind_speed_10m,is_day`
      +`&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,sunrise,sunset`
      +`&minutely_15=precipitation,snowfall&past_minutely_15=1&forecast_minutely_15=10&wind_speed_unit=ms&timezone=auto&forecast_days=7`);
    if(!r.ok)throw 0;const j=await r.json(),H=j.hourly,D=j.daily,M=j.minutely_15;
    wx={t:j.current.temperature_2m,feel:j.current.apparent_temperature,code:j.current.weather_code,wind:j.current.wind_speed_10m,day:!!j.current.is_day,
      hi:D.temperature_2m_max[0],lo:D.temperature_2m_min[0],rain:D.precipitation_probability_max?.[0]??0,
      days:(D.time||[]).map((t,i)=>({date:t,code:D.weather_code[i],hi:D.temperature_2m_max[i],lo:D.temperature_2m_min[i],rain:D.precipitation_probability_max?.[i]??0,mm:D.precipitation_sum?.[i]??0})),
      hours:H.time.map((t,i)=>({time:t,t:H.temperature_2m[i],feel:H.apparent_temperature?.[i]??H.temperature_2m[i],code:H.weather_code[i],p:H.precipitation_probability?.[i]??0,mm:H.precipitation?.[i]??0,wind:H.wind_speed_10m?.[i]??0,day:!!H.is_day[i]})),
      mins:M?.time?M.time.map((t,i)=>({time:t,p:M.precipitation?.[i]??0,snow:M.snowfall?.[i]??0})).filter(q=>q.p!=null):[]};
    const ri=new Date(D.sunrise[0]),se=new Date(D.sunset[0]);if(!isNaN(ri)&&!isNaN(se)){sun={rise:ri,set:se};try{localStorage.setItem('fhd.sun',JSON.stringify({rise:ri.getHours()*60+ri.getMinutes(),set:se.getHours()*60+se.getMinutes()}))}catch(e){}}}catch(e){}renderWx();applyTheme()}
