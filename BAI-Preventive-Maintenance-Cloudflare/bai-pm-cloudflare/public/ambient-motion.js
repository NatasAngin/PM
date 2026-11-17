(()=>{'use strict';
const palettes=[
 {name:'forest',accent:'#176b55',accentHover:'#105542',soft:'#eaf4ef',line:'#cfe3d8',nav:'#245247',glow:'rgba(45,137,105,.10)'},
 {name:'ocean',accent:'#236b91',accentHover:'#185777',soft:'#eaf3f8',line:'#cfe1ed',nav:'#244d68',glow:'rgba(49,130,180,.10)'},
 {name:'amber',accent:'#a66a22',accentHover:'#89531a',soft:'#faf2e6',line:'#edddc4',nav:'#5d472d',glow:'rgba(198,139,56,.10)'},
 {name:'plum',accent:'#765b91',accentHover:'#604777',soft:'#f2edf7',line:'#e0d5eb',nav:'#493d5c',glow:'rgba(132,100,166,.10)'}
];
const root=document.documentElement;
let current=0,timer=null;
function apply(i){
 current=i%palettes.length;const p=palettes[current];
 root.dataset.baiTheme=p.name;
 root.style.setProperty('--bai-accent',p.accent);
 root.style.setProperty('--bai-accent-hover',p.accentHover);
 root.style.setProperty('--bai-accent-soft',p.soft);
 root.style.setProperty('--bai-accent-line',p.line);
 root.style.setProperty('--bai-nav-accent',p.nav);
 root.style.setProperty('--bai-glow',p.glow);
}
function start(){if(timer||document.hidden||matchMedia('(prefers-reduced-motion: reduce)').matches)return;timer=setInterval(()=>apply(current+1),26000)}
function stop(){if(timer){clearInterval(timer);timer=null}}
apply(0);start();
document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();else start()});
window.addEventListener('pageshow',start);
window.addEventListener('pagehide',stop);
})();