(function(root){
'use strict';
var R=3440.065,rad=Math.PI/180;
function distance(a,b){var x=(b[0]-a[0])*rad,y=(b[1]-a[1])*rad,h=Math.sin(x/2)**2+Math.cos(a[0]*rad)*Math.cos(b[0]*rad)*Math.sin(y/2)**2;return R*2*Math.atan2(Math.sqrt(h),Math.sqrt(Math.max(0,1-h)));}
function destination(a,dist,bearing){var d=dist/R,b=bearing*rad,p=a[0]*rad,l=a[1]*rad,p2=Math.asin(Math.sin(p)*Math.cos(d)+Math.cos(p)*Math.sin(d)*Math.cos(b)),l2=l+Math.atan2(Math.sin(b)*Math.sin(d)*Math.cos(p),Math.cos(d)-Math.sin(p)*Math.sin(p2));return[p2/rad,((l2/rad+540)%360)-180];}
function emergency(a){return['7500','7600','7700'].includes(a.squawk)||(!!a.emergency&&!['none','normal'].includes(a.emergency));}
function freshAge(a,received,now,feedLag){return Math.max(0,a.seen||0)+Math.max(0,(now-received)/1000)+(feedLag||0);}
root.RadarCore={distance:distance,destination:destination,emergency:emergency,freshAge:freshAge};
})(typeof window==='undefined'?globalThis:window);
