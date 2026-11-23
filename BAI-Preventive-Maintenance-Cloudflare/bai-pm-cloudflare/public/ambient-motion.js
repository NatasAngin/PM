(()=>{'use strict';
const root=document.documentElement;
const palettes=[
 {name:'nebula-violet',accent:'#a28aff',hover:'#b8a6ff',soft:'rgba(143,112,255,.18)',line:'rgba(169,151,255,.38)',nav:'#211b4c',glow:'rgba(126,100,255,.25)',hue:0},
 {name:'cosmic-blue',accent:'#69b9ff',hover:'#91ceff',soft:'rgba(65,154,255,.17)',line:'rgba(111,183,255,.36)',nav:'#142c55',glow:'rgba(57,142,255,.24)',hue:24},
 {name:'aurora-cyan',accent:'#55e5e0',hover:'#8ffff0',soft:'rgba(50,213,210,.16)',line:'rgba(87,226,221,.34)',nav:'#103b50',glow:'rgba(49,208,215,.22)',hue:72},
 {name:'cosmic-magenta',accent:'#f18bdc',hover:'#ffb0ec',soft:'rgba(226,91,196,.16)',line:'rgba(242,137,218,.34)',nav:'#46204e',glow:'rgba(222,76,196,.22)',hue:125},
 {name:'deep-indigo',accent:'#8799ff',hover:'#a8b4ff',soft:'rgba(108,127,255,.17)',line:'rgba(137,153,255,.36)',nav:'#1c2455',glow:'rgba(105,126,255,.23)',hue:185}
];
let current=0,timer=null,raf=0,stars=[],canvas=null,ctx=null,last=0;
const reduced=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
function apply(i){
 current=i%palettes.length;const p=palettes[current];
 root.dataset.baiTheme=p.name;
 root.style.setProperty('--bai-accent',p.accent);
 root.style.setProperty('--bai-accent-hover',p.hover);
 root.style.setProperty('--bai-accent-soft',p.soft);
 root.style.setProperty('--bai-accent-line',p.line);
 root.style.setProperty('--bai-nav-accent',p.nav);
 root.style.setProperty('--bai-glow',p.glow);
 root.style.setProperty('--galaxy-hue',p.hue+'deg');
}
function cycle(){if(timer||document.hidden||reduced)return;timer=setInterval(()=>apply(current+1),18000)}
function stopCycle(){if(timer){clearInterval(timer);timer=null}}
function resize(){
 if(!canvas||!ctx)return;
 const dpr=Math.min(window.devicePixelRatio||1,1.5),w=window.innerWidth,h=window.innerHeight;
 canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);canvas.style.width=w+'px';canvas.style.height=h+'px';
 ctx.setTransform(dpr,0,0,dpr,0,0);
 const count=Math.min(150,Math.max(65,Math.round(w*h/10500)));
 stars=Array.from({length:count},()=>({x:Math.random()*w,y:Math.random()*h,r:Math.random()*1.35+.25,a:Math.random()*.55+.2,s:Math.random()*.012+.003,p:Math.random()*Math.PI*2}));
}
function draw(t){
 if(!ctx||document.hidden)return;
 const w=window.innerWidth,h=window.innerHeight;
 ctx.clearRect(0,0,w,h);
 for(const s of stars){
  s.p+=s.s;
  const alpha=s.a*(.62+.38*Math.sin(s.p+t*.00025));
  ctx.beginPath();ctx.arc(s.x,s.y,s.r,0,Math.PI*2);
  ctx.fillStyle='rgba(220,226,255,'+alpha.toFixed(3)+')';ctx.fill();
  if(s.r>1.15){ctx.beginPath();ctx.arc(s.x,s.y,s.r*3.4,0,Math.PI*2);ctx.fillStyle='rgba(133,151,255,'+(alpha*.08).toFixed(3)+')';ctx.fill()}
 }
 if(t-last>1100){
  last=t;
  if(Math.random()>.986){
   const x=Math.random()*w*.8,y=Math.random()*h*.55;
   const g=ctx.createLinearGradient(x,y,x+75,y+34);
   g.addColorStop(0,'rgba(170,190,255,0)');g.addColorStop(.5,'rgba(170,190,255,.55)');g.addColorStop(1,'rgba(170,190,255,0)');
   ctx.strokeStyle=g;ctx.lineWidth=1.2;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+75,y+34);ctx.stroke();
  }
 }
 raf=requestAnimationFrame(draw);
}
function startStars(){
 if(reduced||canvas||!document.body)return;
 canvas=document.createElement('canvas');canvas.id='galaxy-starfield';canvas.setAttribute('aria-hidden','true');
 document.body.prepend(canvas);ctx=canvas.getContext('2d',{alpha:true});
 if(!ctx){canvas.remove();canvas=null;return}
 resize();raf=requestAnimationFrame(draw);
 window.addEventListener('resize',resize,{passive:true});
}
function pause(){stopCycle();if(raf){cancelAnimationFrame(raf);raf=0}}
function resume(){cycle();if(ctx&&!raf&&!document.hidden)raf=requestAnimationFrame(draw)}
apply(0);startStars();cycle();
document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();else resume()});
window.addEventListener('pageshow',resume);
window.addEventListener('pagehide',pause);
})();