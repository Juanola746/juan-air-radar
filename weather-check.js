(function(root){
 'use strict';
 // Transparent coverage pixels denote coverage; opaque pixels denote its absence.
 // Inspect only the circular range, not the rest of the much larger source tile.
 function analyze(mask,rain,size,radius){
  var count=0,covered=0,echoes=0,c=size/2;
  radius=Math.max(2,Math.min(size/2-1,radius));
  for(var y=Math.floor(c-radius);y<=Math.ceil(c+radius);y++){
   for(var x=Math.floor(c-radius);x<=Math.ceil(c+radius);x++){
    if((x-c)*(x-c)+(y-c)*(y-c)>radius*radius)continue;
    var i=(y*size+x)*4;count++;
    if(mask&&mask[i+3]<128)covered++;
    if(rain&&rain[i+3]>12)echoes++;
   }
  }
  return {coverage:!mask?'unknown':covered===0?'none':covered/count<.95?'partial':'full',echoes:rain?echoes>0:null};
 }
 function describe(result){
  if(result.echoes)return {code:'echoes',label:'ECOS DE PRECIPITACIÓN',detail:'Se ven ecos de precipitación dentro del alcance seleccionado.'};
  if(result.coverage==='none')return {code:'uncovered',label:'SIN COBERTURA',detail:'La máscara de RainViewer indica falta de cobertura en este alcance. La imagen vacía no significa que no esté lloviendo.'};
  if(result.coverage==='partial')return {code:'partial',label:'COBERTURA PARCIAL',detail:'RainViewer cubre solo una parte de este alcance. Las zonas sin datos pueden verse transparentes.'};
  if(result.coverage==='full'&&result.echoes===false)return {code:'clear',label:'SIN ECOS EN LA IMAGEN',detail:'La imagen recibida no tiene ecos en este alcance y la máscara indica cobertura. No permite descartar una interrupción del radar.'};
  return {code:'unknown',label:'COBERTURA SIN VERIFICAR',detail:'No se pudo verificar la cobertura de esta imagen. Un mapa sin colores no confirma ausencia de precipitación.'};
 }
 root.RadarWeather={analyze:analyze,describe:describe};
})(typeof window==='undefined'?globalThis:window);
