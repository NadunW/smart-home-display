// Weather from Open-Meteo: the header, the hourly strip and tomorrow.
// Open-Meteo weather codes → words and an icon (night versions when the sun is down).
const wxWord=c=>c===0?'Clear':c===1?'Mostly clear':c===2?'Partly cloudy':c===3?'Cloudy':c<=48?'Fog':c<=57?'Drizzle':c<=67?'Rain':c<=77?'Snow':c<=82?'Showers':c<=86?'Snow showers':'Thunder';
const wxIcon=(c,day)=>c<=1?(day?'☀️':'🌙'):c===2?(day?'⛅':'☁️'):c===3?'☁️':c<=48?'🌫️':c<=57?'🌦️':c<=67?'🌧️':c<=77?'🌨️':c<=82?(day?'🌦️':'🌧️'):c<=86?'🌨️':'⛈️';
function renderWx(){if(!hh)return;const fc=$('#fc');$('#wxH').textContent='Weather'+(hh.place?' · '+hh.place:'');
  if(!hh.lat||!wx){$('#wx').innerHTML=hh.lat?'':'<span>Set your town in Settings<br>to see the weather</span>';fc.hidden=true;
    $('#tom').innerHTML=`<p class="empty">${hh.lat?'Loading the forecast…':'Choose your town in Settings to see the forecast.'}</p>`;return}
  $('#wx').innerHTML=`<span class="ic" aria-hidden="true">${wxIcon(wx.code,wx.day)}</span><b>${Math.round(wx.t)}°</b><span><em>${esc(wxWord(wx.code))}</em><br>Feels ${Math.round(wx.feel)}° · ${Math.round(wx.wind)} m/s<br>${Math.round(wx.hi)}° / ${Math.round(wx.lo)}°${wx.rain>=20?' · 💧'+wx.rain+'%':''}</span>`;
  const tm=wx.tom;$('#tom').innerHTML=tm?`<span class="ic" aria-hidden="true">${wxIcon(tm.code,true)}</span><span><b>Tomorrow</b> · ${esc(wxWord(tm.code))}<br><small>${Math.round(tm.hi)}° / ${Math.round(tm.lo)}°${tm.rain>=20?' · 💧'+tm.rain+'%':''}</small></span>`:'';
  // The rest of today, hour by hour (every 2 hours if that's a lot); late in the evening it runs on into tomorrow morning.
  const d=now(),key=ymd(d)+'T'+pad(d.getHours()),i0=wx.hours.findIndex(h=>h.time.slice(0,13)>key);
  let next=i0<0?[]:wx.hours.slice(i0);const todayN=next.filter(h=>h.time.startsWith(ymd(d))).length;
  next=todayN>=6?next.slice(0,todayN):next.slice(0,8);const step=next.length>9?2:1;next=next.filter((_,i)=>i%step===0);
  fc.hidden=!next.length;let last=ymd(d);
  fc.innerHTML=next.map(h=>{const nd=!h.time.startsWith(last);last=h.time.slice(0,10);
    return `<div${nd?' class="nd"':''}><small>${nd?esc(new Date(h.time.slice(0,10)+'T12:00').toLocaleDateString('en-GB',{weekday:'short'}))+' ':''}${h.time.slice(11,13)}</small><i title="${esc(wxWord(h.code))}">${wxIcon(h.code,h.day)}</i><b>${Math.round(h.t)}°</b><span class="p">${h.p>=20?h.p+'%':''}</span></div>`}).join('')}
async function loadWeather(){if(!hh?.lat){wx=null;renderWx();return}
  try{const r=await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${hh.lat}&longitude=${hh.lon}&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m,is_day&hourly=temperature_2m,weather_code,precipitation_probability,is_day&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset&wind_speed_unit=ms&timezone=auto&forecast_days=2`);
    if(!r.ok)throw 0;const j=await r.json(),H=j.hourly;
    wx={t:j.current.temperature_2m,feel:j.current.apparent_temperature,code:j.current.weather_code,wind:j.current.wind_speed_10m,day:!!j.current.is_day,
      hi:j.daily.temperature_2m_max[0],lo:j.daily.temperature_2m_min[0],rain:j.daily.precipitation_probability_max?.[0]??0,
      tom:j.daily.time?.length>1?{code:j.daily.weather_code[1],hi:j.daily.temperature_2m_max[1],lo:j.daily.temperature_2m_min[1],rain:j.daily.precipitation_probability_max?.[1]??0}:null,
      hours:H.time.map((t,i)=>({time:t,t:H.temperature_2m[i],code:H.weather_code[i],p:H.precipitation_probability?.[i]??0,day:!!H.is_day[i]}))};
    const ri=new Date(j.daily.sunrise[0]),se=new Date(j.daily.sunset[0]);if(!isNaN(ri)&&!isNaN(se)){sun={rise:ri,set:se};try{localStorage.setItem('fhd.sun',JSON.stringify({rise:ri.getHours()*60+ri.getMinutes(),set:se.getHours()*60+se.getMinutes()}))}catch(e){}}}catch(e){}renderWx();applyTheme()}

