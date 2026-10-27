(function(){
'use strict';
var $=function(id){return document.getElementById(id);},C=window.RadarCore;
if(!window.L){$('map-notice').textContent='No se pudo cargar el mapa. Recargá la pantalla.';return;}
var defaults={name:'SAN FERNANDO · SADF',lat:-34.455,lon:-58.5913889,range:25,refresh:3,airports:true,min:null,max:null,size:0,wx:true,trails:true,satellite:true,emr:false};
var settings=Object.assign({},defaults);
try{
 var savedV2=localStorage.getItem('juan-radar-v2');
 var saved=JSON.parse(savedV2||localStorage.getItem('juan-radar-v1')||'null');
 if(saved&&!savedV2){saved.name=defaults.name;saved.lat=defaults.lat;saved.lon=defaults.lon;saved.wx=true;}
 if(saved&&Number.isFinite(saved.lat)&&Math.abs(saved.lat)<=85&&Number.isFinite(saved.lon)&&Math.abs(saved.lon)<=180){
  Object.assign(settings,saved);
  if(![1,2.5,5,10,25,30,40,50].includes(settings.range))settings.range=25;
  if(![2,3,5,10,15].includes(settings.refresh))settings.refresh=3;
  if(typeof settings.name!=='string')settings.name='MI RADAR';
 }
}catch(e){}
if(settings.refreshRevision!==1){settings.refresh=Math.min(settings.refresh,3);settings.refreshRevision=1;}
var state={aircraft:[],visible:[],received:0,lag:0,error:false,selected:null,auto:true,markers:new Map(),history:new Map(),request:0,version:0,photoToken:0,source:null,failures:0};
var ranges=[1,2.5,5,10,25,30,40,50],pollTimer,toastTimer,audio,wakeLock;
var map=L.map('map',{zoomControl:false,attributionControl:false,dragging:false,touchZoom:false,doubleClickZoom:false,scrollWheelZoom:false,boxZoom:false,keyboard:false,zoomSnap:0,zoomAnimation:false,fadeAnimation:true});
map.createPane('labels');map.getPane('labels').classList.add('labels-pane');map.getPane('labels').style.zIndex='250';
map.createPane('weather');map.getPane('weather').style.zIndex='300';map.getPane('weather').style.pointerEvents='none';
var satellite=L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',{maxZoom:18,crossOrigin:true});
var labels=L.tileLayer('https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',{pane:'labels',maxZoom:18,crossOrigin:true,opacity:.75});
map.createPane('airports');map.getPane('airports').style.zIndex='500';
var airportLayer=L.layerGroup().addTo(map),airportData=[],conditionsRequest=0,conditions=null;
var weatherLayer=null,weatherFrame=null,tileErrors=0,weatherFrames=[],weatherIndex=0,weatherTimer=null,weatherRequest=0;
satellite.on('tileerror',function(){if(++tileErrors===4)toast('El mapa satelital no responde. MAP permite usar el radar oscuro.');});
function save(){try{localStorage.setItem('juan-radar-v2',JSON.stringify(settings));}catch(e){}}
function toast(s){$('toast').textContent=s;$('toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(function(){$('toast').classList.remove('show');},4500);}
function center(){return[settings.lat,settings.lon];}
function unwrap(lon){return settings.lon+((lon-settings.lon+540)%360-180);}
function point(a){return[a.lat,unwrap(a.lon)];}
function fit(){
 var p=[0,90,180,270].map(function(b){var p=C.destination(center(),settings.range*1.14,b);return[p[0],unwrap(p[1])];});
 map.invalidateSize({animate:false});map.fitBounds(L.latLngBounds(p),{padding:[0,0],animate:false});drawRings();renderAirports();if(settings.wx&&weatherFrames.length)inspectWeather(weatherFrames[weatherIndex]);
}
function svg(tag,attrs,parent){var el=document.createElementNS('http://www.w3.org/2000/svg',tag);Object.keys(attrs).forEach(function(k){el.setAttribute(k,String(attrs[k]));});if(parent)parent.appendChild(el);return el;}
function drawRings(){
 if(!map._loaded)return;
 var r=$('rings');r.replaceChildren();var xy=map.latLngToContainerPoint(center()),ep=C.destination(center(),settings.range,90);ep[1]=unwrap(ep[1]);var radius=xy.distanceTo(map.latLngToContainerPoint(ep)),cx=xy.x,cy=xy.y;
 if(!Number.isFinite(radius))return;
 var g=svg('g',{fill:'none',stroke:'#24a5c2','stroke-width':.8,opacity:.62},r);
 [1/3,2/3,1].forEach(function(f){svg('circle',{cx:cx,cy:cy,r:radius*f},g);var label=svg('text',{x:cx+5,y:cy-radius*f+13,fill:'#56b6ca',stroke:'none','font-size':9,'font-family':'Arial'},g);label.textContent=String(Math.round(settings.range*f*100)/100);});
 [0,90].forEach(function(n){var a=n*Math.PI/180;svg('line',{x1:cx-radius*Math.cos(a),y1:cy-radius*Math.sin(a),x2:cx+radius*Math.cos(a),y2:cy+radius*Math.sin(a),opacity:.6},g);});
 [['N',0,-1],['E',1,0],['S',0,1],['W',-1,0]].forEach(function(v){var t=svg('text',{x:cx+v[1]*(radius+12),y:cy+v[2]*(radius+12)+3,fill:'#6cb6c6',stroke:'none','font-size':10,'text-anchor':'middle','font-family':'Arial'},r);t.textContent=v[0];});
 svg('path',{d:'M '+cx+' '+(cy-5)+' l 5 5 -5 5 -5 -5 Z',fill:'#0e2836',stroke:'#5cc6df','stroke-width':1},r);
}
function updateMap(){
 if(settings.satellite){if(!map.hasLayer(satellite))satellite.addTo(map);if(!map.hasLayer(labels))labels.addTo(map);}
 else{if(map.hasLayer(satellite))map.removeLayer(satellite);if(map.hasLayer(labels))map.removeLayer(labels);}
 $('map-mode').textContent=settings.satellite?'SATELLITE':'RADAR';$('map-credit').hidden=!settings.satellite;
}
function sync(){
 $('range-value').textContent=settings.range+' NM';$('range-bottom').textContent=settings.range+' NM';$('location-name').textContent=settings.name.toUpperCase();
 ['wx','trails','emr','airports'].forEach(function(k){$(k).setAttribute('aria-pressed',String(settings[k]));});
 $('auto-tag').textContent=state.auto?'AUTO':'LOCK';updateMap();
}
var modelNames={B738:'Boeing 737-800',B737:'Boeing 737-700',B38M:'Boeing 737 MAX 8',A320:'Airbus A320',A321:'Airbus A321',A20N:'Airbus A320neo',A21N:'Airbus A321neo',E190:'Embraer 190',C172:'Cessna 172 Skyhawk',C152:'Cessna 152',C150:'Cessna 150',P28A:'Piper PA-28',PA28:'Piper PA-28',C182:'Cessna 182 Skylane',BE20:'Beechcraft King Air 200',GLF5:'Gulfstream V',GLF6:'Gulfstream G650',C560:'Cessna Citation V',LJ45:'Learjet 45',EC45:'Airbus Helicopters EC145',R44:'Robinson R44'};
function age(a){return C.freshAge(a,state.received,Date.now(),state.lag);}
function title(a){return a.flight||a.registration||a.hex.toUpperCase();}
function alt(a){return a.altitude==='ground'?'GROUND':a.altitude===null?'—':Math.round(a.altitude).toLocaleString('en-US')+' ft';}
function fmt(n,suffix){return n===null||!Number.isFinite(n)?'—':Math.round(n)+suffix;}
function set(id,text){$(id).textContent=text;}
function select(hex,manual){
 state.selected=hex;state.auto=!manual;state.photoToken++;$('photo-box').hidden=true;sync();render();
}
function updateDetails(a){
 $('selection').hidden=!a;$('empty-selection').hidden=!!a;if(!a)return;
 set('a-flight',title(a));set('a-alt',alt(a));set('a-speed',fmt(a.speed,' kt'));set('a-heading',fmt(a.track,'°'));
 set('a-distance',a.distance.toFixed(1)+' nm');set('a-vs',a.verticalSpeed===null?'—':(a.verticalSpeed>0?'+':'')+Math.round(a.verticalSpeed)+' fpm');
 set('a-age',Math.floor(age(a))+' s');$('a-age').classList.toggle('stale',age(a)>15);
 set('a-registration',a.registration||'ICAO '+a.hex.toUpperCase());set('a-model',modelNames[a.type]||a.type||'Tipo no disponible');set('a-operator',a.operator||'');
 set('a-squawk',a.squawk||'—');set('a-source',a.source&&a.source.indexOf('mlat')>=0?'MLAT':'ADS-B / MODE S');
 $('emergency-notice').hidden=!C.emergency(a);if(C.emergency(a))set('emergency-notice','EMERGENCY · '+(a.squawk||a.emergency));
 $('photo').disabled=!a.registration;$('photo').style.opacity=a.registration?'1':'.4';
}
function iconNode(a){
 var n=document.createElement('div'),arrow=document.createElement('div');arrow.className='target-arrow';
 arrow.innerHTML='<svg viewBox="0 0 28 28" aria-hidden="true"><path d="M14 2 L23 24 L14 19 L5 24 Z" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/><path d="M14 2 V19" fill="none" stroke="currentColor" stroke-width=".6" opacity=".7"/></svg>';
 arrow.style.transform='rotate('+(Number.isFinite(a.track)?a.track:0)+'deg)';n.appendChild(arrow);
 var label=document.createElement('span');label.className='target-label';label.textContent=title(a);
 if(settings.size>0){var sub=document.createElement('small');sub.textContent=a.altitude==='ground'?'GND':a.altitude===null?'':Math.round(a.altitude/100).toString().padStart(3,'0');label.appendChild(sub);}
 n.appendChild(label);return n;
}
function render(){
 var now=Date.now(),list=state.aircraft.filter(function(a){
  if(!Number.isFinite(a.lat)||!Number.isFinite(a.lon)||age(a)>60)return false;
  a.distance=C.distance(center(),[a.lat,a.lon]);
  var height=a.altitude==='ground'?0:a.altitude;
  return a.distance<=settings.range&&(settings.min===null||(height!==null&&height>=settings.min))&&(settings.max===null||(height!==null&&height<=settings.max));
 }).sort(function(a,b){return a.distance-b.distance;});
 state.visible=list;
 if(state.auto||!list.some(function(a){return a.hex===state.selected;})){
  var next=list[0]?.hex||null;if(state.selected!==next){state.photoToken++;$('photo-box').hidden=true;}
  state.selected=next;state.auto=true;
 }
 $('auto-tag').textContent=state.auto?'AUTO':'LOCK';
 var visibleIds=new Set(list.map(function(a){return a.hex;}));
 state.markers.forEach(function(m,k){if(!visibleIds.has(k)){map.removeLayer(m.marker);if(m.trail)map.removeLayer(m.trail);state.markers.delete(k);}});
 list.forEach(function(a){
  var m=state.markers.get(a.hex),cls='air-target size-'+settings.size+(a.hex===state.selected?' selected':'')+(age(a)>15?' old':'')+(C.emergency(a)?' emergency':'');
  var icon=L.divIcon({html:iconNode(a),className:cls,iconSize:[28,28],iconAnchor:[14,14]});
  if(!m){m={marker:L.marker(point(a),{icon:icon,title:title(a),keyboard:true,zIndexOffset:a.hex===state.selected?1000:0}).addTo(map),trail:null};m.marker.on('click',function(){select(a.hex,true);});state.markers.set(a.hex,m);}
  else{m.marker.setLatLng(point(a));m.marker.setIcon(icon);m.marker.setZIndexOffset(a.hex===state.selected?1000:0);}
  var history=state.history.get(a.hex)||[];
  if(settings.trails&&history.length>1){
   var coords=history.map(function(p){return[p[0],unwrap(p[1])];});
   if(!m.trail)m.trail=L.polyline(coords,{color:a.hex===state.selected?'#d8c65b':'#25a47c',weight:1,opacity:.5,interactive:false}).addTo(map);
   else m.trail.setLatLngs(coords).setStyle({color:a.hex===state.selected?'#d8c65b':'#25a47c'});
  }else if(m.trail){map.removeLayer(m.trail);m.trail=null;}
 });
 updateDetails(list.find(function(a){return a.hex===state.selected;}));
 set('traffic-total',list.length+' AIRCRAFT'+(state.source?' · '+state.source:''));
 var elapsed=state.received?(now-state.received)/1000:0,feedOld=state.received&&(state.lag+elapsed>20);
 var status=state.error?(navigator.onLine===false?'IPAD SIN RED':(apiBase?'FUENTE NO DISPONIBLE':'CONFIGURAR FUENTE')):!state.received?'CONNECTING':feedOld?'DATOS ATRASADOS':'LIVE';
 set('live-text',status);$('status-led').className=state.error?'error':!state.received?'':feedOld?'warning':'ok';
 var notice=state.error?(navigator.onLine===false?'IPAD SIN CONEXIÓN A LA RED':'LA FUENTE DE AVIONES NO RESPONDE · REINTENTANDO'):!state.received?'CONECTANDO CON EL TRÁFICO…':feedOld?'LA FUENTE DE TRÁFICO ESTÁ ATRASADA':!list.length?'SIN TRÁFICO EN ESTE ALCANCE':'';
 $('map-notice').hidden=!notice;set('map-notice',notice);
 $('next').disabled=!list.length;
}
function clock(){
 set('clock',new Date().toISOString().slice(11,19)+'Z');render();
}
var apiBase='';
try{apiBase=localStorage.getItem('juan-radar-api')||window.RADAR_CONFIG.apiBase||'';}catch(e){apiBase=window.RADAR_CONFIG.apiBase||'';}
apiBase=apiBase.replace(/\/$/,'');
function timedFetch(url,ms){
 if(url.indexOf('/api/')===0){if(!apiBase)return Promise.reject(new Error('Configurar servicio de datos'));url=apiBase+url;}

 var controller=new AbortController(),timer=setTimeout(function(){controller.abort();},ms);
 return fetch(url,{cache:'no-store',signal:controller.signal}).finally(function(){clearTimeout(timer);});
}
async function poll(){
 clearTimeout(pollTimer);var requestStarted=Date.now(),version=state.version,id=++state.request;
 try{
  var response=await timedFetch('/api/traffic?lat='+settings.lat+'&lon='+settings.lon,13000);
  if(!response.ok)throw new Error('traffic');
  var data=await response.json();if(version!==state.version||id!==state.request)return;
  if(!Array.isArray(data.aircraft))throw new Error('schema');
  var before=new Set(state.aircraft.map(function(a){return a.hex;}));
  state.aircraft=data.aircraft;state.received=Date.now();state.error=false;state.source=data.source;state.failures=0;
  var feed=Number(data.feedTime);if(feed>0&&feed<1e12)feed*=1000;
  state.lag=feed>0?Math.max(0,(state.received-feed)/1000):0;
  state.aircraft.forEach(function(a){
   if(!Number.isFinite(a.lat)||!Number.isFinite(a.lon)||a.seen>60)return;
   var h=state.history.get(a.hex)||[],last=h[h.length-1];
   if(!last||last[0]!==a.lat||last[1]!==a.lon)h.push([a.lat,a.lon,Date.now()]);
   state.history.set(a.hex,h.filter(function(p){return Date.now()-p[2]<180000;}).slice(-40));
   if(settings.emr&&!before.has(a.hex)&&C.emergency(a)){beep();toast('EMERGENCY · '+title(a)+' · '+(a.squawk||a.emergency));$('sleep').hidden=true;}
  });
  state.history.forEach(function(h,key){if(!h.length||Date.now()-h[h.length-1][2]>180000)state.history.delete(key);});
  set('updated',new Date().toISOString().slice(11,19));render();
 }catch(e){if(version===state.version&&id===state.request){state.error=true;state.failures++;render();}}
 finally{if(version===state.version&&id===state.request)pollTimer=setTimeout(poll,Math.max(500,(state.error?Math.min(30,Math.max(settings.refresh,3)*Math.pow(2,Math.min(state.failures,3))):settings.refresh)*1000-(Date.now()-requestStarted)));}
}
function beep(){
 try{audio=audio||new(window.AudioContext||window.webkitAudioContext)();audio.resume();var o=audio.createOscillator(),g=audio.createGain();o.connect(g);g.connect(audio.destination);o.frequency.value=880;g.gain.value=.07;o.start();o.stop(audio.currentTime+.18);}catch(e){}
}
function weatherStatus(code,label,detail){
 set('weather-status',label);set('weather-explanation',detail||'');
 set('weather-time','WX · '+label);$('weather-led').className='wx-led '+code;
 $('wx').dataset.status=code;
}
function imagePixels(url){return new Promise(function(resolve){
 var img=new Image(),done=false,timer=setTimeout(function(){finish(null);},10000);
 function finish(value){if(done)return;done=true;clearTimeout(timer);resolve(value);}
 img.crossOrigin='anonymous';img.onload=function(){try{var canvas=document.createElement('canvas');canvas.width=512;canvas.height=512;var ctx=canvas.getContext('2d');ctx.drawImage(img,0,0,512,512);finish(ctx.getImageData(0,0,512,512).data);}catch(e){finish(null);}};
 img.onerror=function(){finish(null);};img.src=url;
});}
var weatherInspection=0,coverageCache=new Map(),weatherChecks=new Map(),weatherTilesFailed=false,weatherRefreshFailed=false;
async function inspectWeather(f){
 if(!settings.wx||!f)return;var id=++weatherInspection,lat=settings.lat,lon=settings.lon,range=settings.range;
 var location=lat.toFixed(4)+'/'+lon.toFixed(4),key=location+'/'+range+'/'+f.path;
 weatherStatus('loading','VERIFICANDO','Comprobando la imagen y la cobertura en este alcance.');
 var result=weatherChecks.get(key);
 if(!result){
  var coords='/512/7/'+lat.toFixed(4)+'/'+lon.toFixed(4),base='https://tilecache.rainviewer.com';
  var mask=coverageCache.get(location);
  var data=await Promise.all([mask?Promise.resolve(mask):imagePixels(base+'/v2/coverage/0'+coords+'/0/0_0.png'),imagePixels(base+f.path+coords+'/2/1_1.png')]);
  if(data[0]){if(coverageCache.size>10)coverageCache.clear();coverageCache.set(location,data[0]);}
  var radius=range*1852/(156543.03392*Math.cos(lat*Math.PI/180)/128);
  result=RadarWeather.describe(RadarWeather.analyze(data[0],data[1],512,radius));
  if(data[0]&&data[1]){if(weatherChecks.size>40)weatherChecks.clear();weatherChecks.set(key,result);}
 }
 if(id!==weatherInspection||!settings.wx)return;
 if(weatherTilesFailed){weatherStatus('error','ERROR DE IMAGEN','La fuente no pudo cargar todas las imágenes. Volvé a intentarlo en un minuto.');return;}
 if(weatherRefreshFailed){weatherStatus('error','SIN ACTUALIZAR','Se conserva la última imagen recibida; su actualización falló.');return;}
 var old=Date.now()/1000-f.time>1800&&weatherIndex===weatherFrames.length-1;
 weatherStatus(old?'partial':result.code,old?'IMAGEN ATRASADA':result.label,result.detail+(old?' La última composición tiene más de 30 minutos.':''));
}
function stopWeatherAnimation(){clearInterval(weatherTimer);weatherTimer=null;set('weather-play','▶');$('weather-play').setAttribute('aria-label','Animar últimas imágenes');}
function showWeatherFrame(index){
 if(!settings.wx||!weatherFrame||!weatherFrames.length)return;
 weatherIndex=Math.max(0,Math.min(weatherFrames.length-1,Number(index)));
 var f=weatherFrames[weatherIndex],url=weatherFrame.host+f.path+'/256/{z}/{x}/{y}/2/1_1.png';weatherTilesFailed=false;
 var opacity=Number($('weather-opacity').value)/100;
 if(!weatherLayer){
  weatherLayer=L.tileLayer(url,{pane:'weather',opacity:opacity,maxNativeZoom:7,maxZoom:18,crossOrigin:true});
  weatherLayer.on('tileerror',function(){weatherTilesFailed=true;stopWeatherAnimation();weatherStatus('error','ERROR DE IMAGEN','No se pudo cargar la imagen meteorológica. Reintentá en un minuto.');});weatherLayer.addTo(map);
 }else{weatherLayer.setUrl(url);weatherLayer.setOpacity(opacity);if(!map.hasLayer(weatherLayer))weatherLayer.addTo(map);}
 set('weather-frame-time',new Date(f.time*1000).toISOString().slice(11,16)+'Z');$('weather-timeline').value=weatherIndex;inspectWeather(f);
}
async function loadWeather(){
 var request=++weatherRequest;weatherInspection++;$('weather-panel').hidden=!settings.wx;$('weather-map-credit').hidden=!settings.wx;
 $('weather-toggle').setAttribute('aria-pressed',String(settings.wx));set('weather-toggle',settings.wx?'ACTIVADO':'DESACTIVADO');
 if(!settings.wx){stopWeatherAnimation();if(weatherLayer)map.removeLayer(weatherLayer);weatherStatus('off','OFF','Activá WX para superponer el radar de precipitaciones.');return;}
 weatherStatus('loading','CARGANDO','Obteniendo la última imagen meteorológica.');
 try{
  var r=await timedFetch('/api/weather',12000);if(!r.ok)throw new Error('wx');var f=await r.json();if(request!==weatherRequest||!settings.wx)return;
  weatherRefreshFailed=false;weatherFrame=f;weatherFrames=Array.isArray(f.frames)&&f.frames.length?f.frames:[{path:f.path,time:f.time}];
  $('weather-timeline').max=weatherFrames.length-1;$('weather-timeline').disabled=weatherFrames.length<2;$('weather-play').disabled=weatherFrames.length<2;
  stopWeatherAnimation();showWeatherFrame(weatherFrames.length-1);
 }catch(e){if(request!==weatherRequest||!settings.wx)return;weatherRefreshFailed=true;weatherStatus('error','NO DISPONIBLE',weatherFrames.length?'No se pudo actualizar. Se conserva la imagen anterior.':'La fuente meteorológica no respondió. Esto no indica que tu iPad esté sin internet.');}
}
$('weather-play').onclick=function(){
 if(weatherTimer){stopWeatherAnimation();return;}if(weatherFrames.length<2)return;
 set('weather-play','Ⅱ');$('weather-play').setAttribute('aria-label','Pausar animación');if(weatherIndex===weatherFrames.length-1)showWeatherFrame(0);
 // Keep requests below the provider's tile rate limit, including coverage checks.
 var tileSize=256*Math.pow(2,Math.max(0,map.getZoom()-7)),size=map.getSize();
 var tileCount=(Math.ceil(size.x/tileSize)+1)*(Math.ceil(size.y/tileSize)+1);
 weatherTimer=setInterval(function(){showWeatherFrame((weatherIndex+1)%weatherFrames.length);},Math.max(2500,(tileCount+1)*1100));
};
$('weather-timeline').oninput=function(){stopWeatherAnimation();showWeatherFrame(this.value);};
$('weather-opacity').oninput=function(){if(weatherLayer)weatherLayer.setOpacity(Number(this.value)/100);};
$('weather-summary').onclick=function(){$('weather-dialog').showModal();};
$('close-weather').onclick=function(){$('weather-dialog').close();};
$('weather-toggle').onclick=function(){settings.wx=!settings.wx;save();sync();loadWeather();};
$('weather-retry').onclick=function(){weatherChecks.clear();coverageCache.clear();loadWeather();};
function renderAirports(){
 airportLayer.clearLayers();if(!settings.airports)return;
 airportData.filter(function(a){return C.distance(center(),[a.lat,a.lon])<=settings.range;}).forEach(function(a){
  var node=document.createElement('div');node.className='airport-label';node.innerHTML='<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="5" fill="none" stroke="currentColor"/><path d="M10 1 V19 M1 10 H19" stroke="currentColor" stroke-width=".7"/></svg>';
  var label=document.createElement('span');label.textContent=a.id;node.appendChild(label);
  var marker=L.marker([a.lat,unwrap(a.lon)],{pane:'airports',icon:L.divIcon({html:node,className:'airport-marker',iconSize:[20,20],iconAnchor:[10,10]}),title:a.id+' · '+a.name}).addTo(airportLayer);
  var content=document.createElement('div'),name=document.createElement('strong'),info=document.createElement('p'),button=document.createElement('button');
  name.textContent=a.id+' · '+a.name;info.textContent='Elevación: '+(a.elevation?a.elevation+' ft':'no disponible');
  button.className='airport-center-button';button.textContent='CENTRAR RADAR AQUÍ';button.onclick=function(){settings.name=a.id;settings.lat=a.lat;settings.lon=a.lon;changeCenter();map.closePopup();};
  content.append(name,info,button);marker.bindPopup(content,{maxWidth:260});
 });
}
async function loadAirports(){
 try{var r=await fetch('./airports-ar.json');var d=await r.json();airportData=d.airports||[];renderAirports();}catch(e){toast('No se pudieron cargar los aeródromos.');}
}
function changeCenter(){
 state.version++;state.aircraft=[];state.received=0;state.error=false;state.auto=true;state.selected=null;state.history.clear();state.photoToken++;$('photo-box').hidden=true;save();sync();fit();render();poll();loadConditions();loadWeather();
}
async function loadConditions(){
 var request=++conditionsRequest;set('conditions-station','METAR');set('conditions-time','Actualizando reporte…');set('conditions-wind','Cargando…');set('conditions-gust','');set('conditions-temp','— °C');set('conditions-qnh','QNH —');set('conditions-category','');$('wind-vector').style.opacity='0';
 try{
  var r=await timedFetch('/api/conditions?lat='+settings.lat+'&lon='+settings.lon,18000);if(!r.ok)throw new Error('metar');var d=await r.json();if(request!==conditionsRequest)return;
  conditions=d;
  if(!d.station){set('conditions-wind','Sin METAR cercano');set('conditions-station','—');set('conditions-time','No hay observaciones disponibles');set('conditions-temp','— °C');set('conditions-qnh','QNH —');set('conditions-gust','');set('conditions-category','');$('wind-vector').style.opacity='0';return;}
  set('conditions-station',d.station);var speed=d.windSpeed;
  var dir=d.windDirection==='VRB'?'Variable':Number.isFinite(d.windDirection)?String(Math.round(d.windDirection)).padStart(3,'0')+'°':'—';
  set('conditions-wind',speed===0?'Calma · 0 kt':dir+' · '+(speed===null?'—':speed)+' kt');
  set('conditions-gust',d.windGust!==null?'G'+d.windGust+' kt':'');
  set('conditions-temp',d.temperature===null?'— °C':d.temperature+' °C');set('conditions-qnh',d.qnh===null?'QNH —':'QNH '+Math.round(d.qnh));set('conditions-category',d.category||'');
  $('wind-vector').style.opacity=Number.isFinite(d.windDirection)&&speed>0?'1':'0';$('wind-vector').setAttribute('transform','rotate('+(Number.isFinite(d.windDirection)?d.windDirection:0)+' 20 20)');
  var time=new Date(d.observedAt*1000).toISOString().slice(11,16)+'Z',old=Date.now()/1000-d.observedAt>5400;
  set('conditions-time',time+' · '+d.distance+' NM'+(old?' · REPORTE ANTIGUO':''));$('conditions-time').classList.toggle('stale',old);
  set('metar-description',d.station+' · '+(d.name||'')+' · observación '+new Date(d.observedAt*1000).toISOString().replace('T',' ').slice(0,16)+'Z · '+d.distance+' NM del centro');set('metar-raw',d.raw||'METAR no disponible');
 }catch(e){if(request===conditionsRequest){conditions=null;set('conditions-station','METAR');set('conditions-wind','No disponible');set('conditions-time','No se pudo actualizar el reporte');set('conditions-temp','— °C');set('conditions-qnh','QNH —');set('conditions-gust','');set('conditions-category','');$('wind-vector').style.opacity='0';set('metar-raw','METAR no disponible.');set('metar-description','No se pudo obtener una observación del aeródromo.');}}
}
$('conditions-card').onclick=function(){$('metar-dialog').showModal();};
$('airports').onclick=function(){settings.airports=!settings.airports;save();sync();renderAirports();};
$('size').onclick=function(){settings.size=(settings.size+1)%3;save();render();};
$('emr').onclick=function(){settings.emr=!settings.emr;if(settings.emr){beep();toast('Aviso sonoro de emergencia activado.');}save();sync();};
$('wx').onclick=function(){settings.wx=!settings.wx;save();sync();loadWeather();};
$('trails').onclick=function(){settings.trails=!settings.trails;save();sync();render();};
$('map-toggle').onclick=function(){settings.satellite=!settings.satellite;save();sync();};
function rangeDialog(){
 $('range-options').replaceChildren();ranges.forEach(function(n){var b=document.createElement('button');b.type='button';b.textContent=n+' NM';b.className=n===settings.range?'active':'';b.onclick=function(){settings.range=n;save();sync();fit();render();$('range-dialog').close();};$('range-options').appendChild(b);});$('range-dialog').showModal();
}
$('range').onclick=rangeDialog;$('range-bottom').onclick=rangeDialog;
function settingsDialog(){
 $('input-api').value=apiBase;$('input-name').value=settings.name;$('input-lat').value=settings.lat;$('input-lon').value=settings.lon;$('input-refresh').value=settings.refresh;$('input-min').value=settings.min===null?'':settings.min;$('input-max').value=settings.max===null?'':settings.max;set('settings-error','');$('settings-dialog').showModal();
}
$('airport-base').onclick=function(){$('input-name').value=defaults.name;$('input-lat').value=defaults.lat;$('input-lon').value=defaults.lon;};
$('settings').onclick=settingsDialog;$('location').onclick=settingsDialog;$('close-settings').onclick=function(){$('settings-dialog').close();};
$('settings-form').onsubmit=function(e){
 e.preventDefault();var lat=Number($('input-lat').value),lon=Number($('input-lon').value),min=$('input-min').value===''?null:Number($('input-min').value),max=$('input-max').value===''?null:Number($('input-max').value);
 if(!Number.isFinite(lat)||Math.abs(lat)>85||!Number.isFinite(lon)||Math.abs(lon)>180||(min!==null&&max!==null&&min>max)){set('settings-error','Revisá las coordenadas y los límites de altitud.');return;}
 var candidate=$('input-api').value.trim().replace(/\/$/,'');if(candidate&&!/^https:\/\/[^\s]+$/.test(candidate)){set('settings-error','Usá una URL HTTPS válida.');return;}apiBase=candidate;try{localStorage.setItem('juan-radar-api',apiBase);}catch(err){}settings.lat=lat;settings.lon=lon;settings.name=$('input-name').value.trim().slice(0,30)||'MI RADAR';settings.min=min;settings.max=max;settings.refresh=Number($('input-refresh').value);
 $('settings-dialog').close();changeCenter();
};
$('geolocate').onclick=function(){
 if(!navigator.geolocation){toast('Ingresá las coordenadas manualmente.');return;}
 $('geolocate').disabled=true;set('geolocate','Buscando ubicación…');
 navigator.geolocation.getCurrentPosition(function(p){$('input-lat').value=p.coords.latitude.toFixed(5);$('input-lon').value=p.coords.longitude.toFixed(5);$('input-name').value='MI UBICACIÓN';$('geolocate').disabled=false;set('geolocate','Usar mi ubicación');},function(){toast('No se pudo obtener la ubicación. Podés ingresar las coordenadas.');$('geolocate').disabled=false;set('geolocate','Usar mi ubicación');},{timeout:12000});
};
$('release').onclick=function(){state.auto=true;render();};
$('next').onclick=function(){if(!state.visible.length)return;var i=state.visible.findIndex(function(a){return a.hex===state.selected;});select(state.visible[(i+1)%state.visible.length].hex,true);};
$('install-app').onclick=function(){var installed=navigator.standalone===true||window.matchMedia('(display-mode: standalone)').matches;set('install-status',installed?'Ya estás usando Juan Air Radar como app en este dispositivo.':'Agregala a la pantalla de inicio para abrir el radar como una app.');$('install-dialog').showModal();};
$('about').onclick=function(){$('about-dialog').showModal();};
$('photo').onclick=async function(){
 var a=state.visible.find(function(a){return a.hex===state.selected;});if(!a||!a.registration)return;
 if(!$('photo-box').hidden){$('photo-box').hidden=true;state.photoToken++;return;}
 var token=++state.photoToken;$('photo-box').hidden=false;$('photo-image').hidden=true;set('photo-state','Buscando foto…');set('photo-credit','');$('photo-link').removeAttribute('href');
 try{
  var r=await timedFetch('/api/photo?reg='+encodeURIComponent(a.registration),12000);var d=await r.json();if(token!==state.photoToken)return;
  if(!d.photo){set('photo-state','Sin foto disponible para esta matrícula.');return;}
  $('photo-image').src=d.photo;$('photo-image').alt=a.registration;$('photo-image').onerror=function(){if(token===state.photoToken){$('photo-image').hidden=true;set('photo-state','No se pudo cargar la foto.');}};
  $('photo-image').hidden=false;set('photo-state','');set('photo-credit','© '+d.photographer+' · Planespotters.net');$('photo-link').href=d.link;
 }catch(e){if(token===state.photoToken)set('photo-state','Foto no disponible.');}
};
$('power').onclick=function(){$('sleep').hidden=false;};$('sleep').onclick=function(){$('sleep').hidden=true;};
$('fullscreen').onclick=function(){
 var el=document.documentElement,fn=el.requestFullscreen||el.webkitRequestFullscreen;
 if(fn){var result=fn.call(el);if(result&&result.catch)result.catch(function(){toast('Safari → Compartir → Agregar a inicio para pantalla completa.');});}
 else toast('Safari → Compartir → Agregar a inicio para pantalla completa.');
};
async function keepAwake(){try{if(navigator.wakeLock&&document.visibilityState==='visible')wakeLock=await navigator.wakeLock.request('screen');}catch(e){}}
document.addEventListener('visibilitychange',function(){if(document.visibilityState==='visible'){keepAwake();poll();}});
window.addEventListener('online',function(){poll();loadWeather();loadConditions();});
window.addEventListener('offline',function(){state.error=true;render();});
window.addEventListener('resize',function(){fit();});
if(window.ResizeObserver)new ResizeObserver(function(){fit();}).observe($('map'));
map.on('moveend zoomend',drawRings);
save();sync();fit();render();poll();loadWeather();loadAirports();loadConditions();clock();setInterval(clock,1000);setInterval(function(){if(settings.wx)loadWeather();},300000);setInterval(loadConditions,300000);keepAwake();
})();
