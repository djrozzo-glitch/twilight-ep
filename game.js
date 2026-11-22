"use strict";
const get = id => document.getElementById(id);
const field = get("field");
const ctx = field.getContext("2d");
const W = 640, H = 570, LEFT = 23, RIGHT = W - LEFT, TOP = 20, PADDLE_Y = 520, R = 8;
const LIME = "#e2fc75", AMBER = "#ff9c61", BLUE = "#9fe1f1";
const stages = [
  { name: "The Arch", speed: 320, rows: ["..o##o..",".######.","########","##s##d##",".###r##."] },
  { name: "Soundcheck", speed: 352, rows: [".oo..oo.","oo####oo","#s#oo#d#",".##..##.","####r###","..####.."] },
  { name: "System Pressure", speed: 380, rows: ["ooo##ooo","o##oo##o","##d##s##","o##oo##o","##r#####",".######."] },
];
const tracks = [
  { title: "lowQ – Twilight", file: "lowQ - Twilight.mp3" },
  { title: "lowQ – Run from Babylon", file: "lowQ – Run from Babylon.mp3" },
];
const music = new Audio();
music.preload = "none";
music.volume = .8;
let trackIndex = 0;
let failedTracks = 0;
const powerups = {d:{name:"DUBPLATE",color:BLUE},s:{name:"STACK",color:LIME},r:{name:"REWIND",color:AMBER}};
const keys = new Set();
const motion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const getBest = () => { try { return Number(localStorage.getItem("pressure-test-best")) || 0; } catch { return 0; } };
let best = getBest(), score = 0, level = 0, lives = 3, pressure = 0, mode = "menu", priorMode;
let bricks = [], balls = [], drops = [], sparks = [], bat = W / 2, wide = 0, rewind = false;
let flash = 0, time = 0, noticeUntil = 0;
let audio, master, sound = true;
let pointer, backdrop;

function rect(x,y,w,h,color) {ctx.fillStyle=color;ctx.fillRect(x,y,w,h);}
function clamp(v,min,max) {return Math.max(min,Math.min(max,v));}
function hud() {
  get("level").textContent = `${String(level + 1).padStart(2,"0")} / 03`;
  get("score").textContent = String(score).padStart(5,"0");
  get("best").textContent = String(best).padStart(5,"0");
  get("lives").textContent = Array.from({length:3},(_,i)=> i < lives ? "●" : "○").join(" ");
  get("lives").setAttribute("aria-label", `${lives} lives`);
  get("pressure").classList.toggle("full",pressure === 6);
  get("pressure").setAttribute("aria-valuenow",pressure);
  [...get("pressure").children].forEach((bar,i)=>bar.classList.toggle("on",i<pressure));
}
for(let i=0;i<6;i++) get("pressure").append(document.createElement("i"));
function addScore(n) {
  score += n;
  if (score > best) {best = score;try {localStorage.setItem("pressure-test-best",best);} catch {}}
  hud();
}
function announce(text, seconds = 1.25) {
  get("notice").textContent = text;
  noticeUntil = time + seconds;
}
function show(kind, kicker, title, message, action, hint = "") {
  mode = kind;
  announce("",0);
  get("overlay").hidden = false;
  get("kicker").textContent = kicker;
  get("title").textContent = title;
  get("title").classList.add("compact");
  get("message").textContent = message;
  get("action").textContent = action;
  get("hint").textContent = hint;
  get("pause").disabled = kind !== "paused";
  get("pause").textContent = kind === "paused" ? "Resume" : "Pause";
}
function setActive(kind) {
  mode = kind;
  get("overlay").hidden = true;
  get("pause").disabled = false;
  get("pause").textContent = "Pause";
}
function loadWall() {
  bricks = stages[level].rows.flatMap((row,r)=>[...row].flatMap((type,c)=>{
    if(type === ".") return [];
    return [{x:38+c*71+(r%2?5:0),y:88+r*36,w:66,h:29,type,hp:type==="o"?2:1,seed:r*8+c}];
  }));
}
function ready() {
  balls = [newBall(bat,PADDLE_Y-R-2)];
  balls[0].attached = true;
  setActive("ready");
  announce("TAP OR PRESS SPACE TO LAUNCH",60);
}
function newBall(x,y) {return {x,y,vx:0,vy:0,pierce:0,attached:false};}
function startGame() {
  level = 0;
  score = 0;
  lives = 3;
  startWall();
  failedTracks = 0;
  loadTrack(0);
}
function startWall() {
  pressure = 0; bat = W/2; wide = 0; rewind = false; drops = []; sparks = [];
  loadWall();
  hud();
  ready();
}
function serve() {
  if(mode !== "ready") return;
  const ball = balls[0];
  ball.x = bat;
  ball.attached = false;
  launch(ball,bat < W/2 ? .31 : -.31);
  setActive("playing");
  announce(stages[level].name.toUpperCase());
}
function launch(ball, angle) {
  const speed = stages[level].speed;
  ball.vx = Math.sin(angle)*speed;
  ball.vy = -Math.cos(angle)*speed;
}
function paddleWidth() {return wide > 0 ? 156 : 112;}
function hitBat(ball) {
  const offset = clamp((ball.x-bat)/(paddleWidth()/2),-1,1);
  let angle = offset * 1.04;
  if(Math.abs(angle)<.13) angle = (angle || ball.vx || 1) < 0 ? -.13 : .13;
  launch(ball,angle);
  ball.y = PADDLE_Y-R-.1;
  if(pressure === 6) {
    ball.pierce = 4;
    pressure = 0;
    flash = .7;
    announce("PRESSURE RELEASE");
    soundHit(64,.20,"triangle");
    hud();
  } else soundHit(150,.065,"sine");
}
function wallCleared() {
  addScore(250);
  if(level === stages.length-1) {
    show("won","ALL THREE WALLS CLEARED","SYSTEM CLEAR.",`Final score ${score.toLocaleString("en-GB")}.`,"Play again");
    syncMusic();
    return;
  }
  show("clear","WALL CLEARED",stages[level].name.toUpperCase()+".",`Next up · ${stages[level+1].name}`,"Next wall");
}
function loseBall() {
  if(rewind) {
    rewind = false;
    ready();
    announce("REWIND · BALL SAVED",3);
    soundHit(98,.22,"triangle");
    return;
  }
  lives--;
  pressure = 0;
  wide = 0;
  drops = [];
  hud();
  if(lives === 0) {
    show("lost","END OF SET","SIGNAL LOST.",`Score ${score.toLocaleString("en-GB")} · Best ${best.toLocaleString("en-GB")}`,"Play again");
    syncMusic();
    return;
  }
  ready();
  announce(`${lives} ${lives === 1 ? "LIFE" : "LIVES"} LEFT · TAP TO LAUNCH`,8);
}
function collect(type) {
  if(type === "s") wide = 14;
  if(type === "r") rewind = true;
  if(type === "d" && balls.length < 4) {
    const extra = newBall(bat,PADDLE_Y-R-3);
    launch(extra, bat < W/2 ? .66 : -.66);
    balls.push(extra);
  }
  announce(type === "r" ? "REWIND · SAVE ARMED" : type === "s" ? "STACK · WIDER SPEAKER" : "DUBPLATE · EXTRA BALL");
  soundHit(350,.14,"triangle");
  addScore(50);
}
function hitBrick(ball,b,oldX,oldY) {
  const breaking = ball.pierce > 0 || b.hp === 1;
  if(ball.pierce > 0) ball.pierce--;
  else {
    if(oldY+R <= b.y || oldY-R >= b.y+b.h) ball.vy *= -1;
    else if(oldX+R <= b.x || oldX-R >= b.x+b.w) ball.vx *= -1;
    else ball.vy *= -1;
    ball.x = oldX;
    ball.y = oldY;
  }
  if(breaking) {
    bricks.splice(bricks.indexOf(b),1);
    if(powerups[b.type]) drops.push({x:b.x+b.w/2,y:b.y+b.h/2,type:b.type});
    burst(b.x+b.w/2,b.y+b.h/2,b.type==="o"?BLUE:AMBER);
    pressure = Math.min(6,pressure+1);
    addScore(b.type==="o" ? 180 : 100);
    if(pressure === 6 && !get("notice").textContent) announce("PRESSURE READY");
  } else {
    b.hp--;
    burst(ball.x,ball.y,BLUE,5);
    addScore(25);
  }
  soundHit(breaking?99+(b.seed%5)*20:75,.072,breaking?"triangle":"sine");
}
function update(dt) {
  time += dt;
  if(time >= noticeUntil && get("notice").textContent) announce("",0);
  flash = Math.max(0,flash-dt*2.4);
  if(mode !== "ready" && mode !== "playing") return;
  const direction = Number(keys.has("ArrowRight")||keys.has("KeyD"))-Number(keys.has("ArrowLeft")||keys.has("KeyA"));
  if(direction) bat = clamp(bat+direction*530*dt,LEFT+paddleWidth()/2,RIGHT-paddleWidth()/2);
  if(mode === "ready") {balls[0].x = bat;return;}
  wide = Math.max(0,wide-dt);
  for(const ball of balls) {
    const oldX = ball.x, oldY = ball.y;
    ball.x += ball.vx*dt;
    ball.y += ball.vy*dt;
    if(ball.x-R<LEFT || ball.x+R>RIGHT) {
      ball.x = clamp(ball.x,LEFT+R,RIGHT-R);
      ball.vx *= -1;
    }
    if(ball.y-R<TOP) {ball.y=TOP+R;ball.vy=Math.abs(ball.vy);}
    if(ball.vy>0 && oldY+R<=PADDLE_Y && ball.y+R>=PADDLE_Y && Math.abs(ball.x-bat)<paddleWidth()/2+R*.7) hitBat(ball);
    const brick = bricks.find(b=>{
      const dx = ball.x-clamp(ball.x,b.x,b.x+b.w), dy = ball.y-clamp(ball.y,b.y,b.y+b.h);
      return dx*dx+dy*dy<=R*R;
    });
    if(brick) hitBrick(ball,brick,oldX,oldY);
    if(!bricks.length) {wallCleared();return;}
  }
  balls = balls.filter(ball=>ball.y < H+R);
  if(!balls.length) {loseBall();return;}
  for(const drop of drops) {
    const previous = drop.y;
    drop.y += 171*dt;
    if(previous+11<PADDLE_Y && drop.y+11>=PADDLE_Y && Math.abs(drop.x-bat)<paddleWidth()/2+17) {
      collect(drop.type);
      drop.y = H+30;
    }
  }
  drops = drops.filter(drop=>drop.y<H+15);
  for(const s of sparks) {s.x+=s.vx*dt;s.y+=s.vy*dt;s.vy+=290*dt;s.life-=dt;}
  sparks = sparks.filter(s=>s.life>0);
}
function burst(x,y,color,count=16) {
  if(motion) return;
  for(let i=0;i<count;i++) sparks.push({x,y,color,vx:(Math.random()-.5)*245,vy:(Math.random()-.68)*220,life:.2+Math.random()*.45,size:2+Math.random()*4});
}

function arch() {
  ctx.beginPath();
  ctx.moveTo(49,H);
  ctx.lineTo(49,196);
  ctx.bezierCurveTo(49,69,151,13,320,13);
  ctx.bezierCurveTo(489,13,591,69,591,196);
  ctx.lineTo(591,H);
}
function makeBackdrop() {
  const image = document.createElement("canvas");
  image.width = W; image.height = H;
  const g = image.getContext("2d");
  let rng = 987192;
  const random = () => {rng=(Math.imul(rng,1664525)+1013904223)>>>0;return rng/4294967296;};
  g.fillStyle = "#201714";
  g.fillRect(0,0,W,H);
  for(let row=0;row<27;row++) for(let col=-1;col<14;col++){
    const x=col*56+(row%2)*28, y=row*22, tone=Math.round(36+random()*26);
    g.fillStyle=`rgb(${tone+19},${tone-5},${tone-12})`;
    g.fillRect(x,y,54,20);
    g.fillStyle="#301b16";
    g.fillRect(x,y+18,54,2);
  }
  const shade = g.createLinearGradient(0,35,0,H);
  shade.addColorStop(0,"#181310");
  shade.addColorStop(.57,"#211513");
  shade.addColorStop(1,"#100f0e");
  g.beginPath();
  g.moveTo(49,H);g.lineTo(49,196);
  g.bezierCurveTo(49,69,151,13,320,13);
  g.bezierCurveTo(489,13,591,69,591,196);
  g.lineTo(591,H);g.closePath();
  g.fillStyle=shade;g.fill();
  g.strokeStyle="#997463";g.lineWidth=2;g.stroke();
  const glow = g.createRadialGradient(W/2,275,30,W/2,275,380);
  glow.addColorStop(0,"#a549251c");
  glow.addColorStop(.55,"#9e4f2510");
  glow.addColorStop(1,"#050404aa");
  g.fillStyle=glow;
  g.fillRect(0,0,W,H);
  for(let i=0;i<14000;i++) {
    g.fillStyle=random()>.5?"#ffbb8a0b":"#0101012e";
    g.fillRect(random()*W,random()*H,1+random()*4,1);
  }
  return image;
}
function drawBrick(b) {
  const metal = b.type === "o";
  const tones = ["#9d523f","#b3634b","#884839","#aa5743","#a45b45"];
  const color = metal ? (b.hp===2?"#546263":"#645451") : tones[b.seed%tones.length];
  rect(b.x+2,b.y+4,b.w,b.h,"#07060591");
  rect(b.x,b.y,b.w,b.h,color);
  rect(b.x,b.y,b.w,2,metal?"#94a7a6":"#df946a");
  rect(b.x,b.y+b.h-3,b.w,3,metal?"#303738":"#562e27");
  rect(b.x,b.y,2,b.h,"#ffb1923b");
  for(let i=0;i<13;i++) {
    const x=(i*19+b.seed*11)%61, y=(i*7+b.seed*2)%22;
    rect(b.x+x+2,b.y+y+4,2+(i%5),1,i%2?"#0003":"#f5bb8d29");
  }
  if(metal) {
    for(const x of [5,b.w-8]) for(const y of [5,b.h-8]) rect(b.x+x,b.y+y,3,3,"#bbcecd");
    if(b.hp===1) {
      ctx.strokeStyle="#2d2421";ctx.lineWidth=2;ctx.beginPath();
      ctx.moveTo(b.x+28,b.y);ctx.lineTo(b.x+34,b.y+12);ctx.lineTo(b.x+29,b.y+17);ctx.lineTo(b.x+40,b.y+b.h);ctx.stroke();
    }
  }
  if(powerups[b.type]) {
    rect(b.x+b.w/2-9,b.y+10,18,10,"#271916");
    rect(b.x+b.w/2-5,b.y+13,10,4,powerups[b.type].color);
  }
}
function speaker() {
  const w=paddleWidth(), x=bat-w/2;
  rect(x-2,PADDLE_Y+5,w+4,21,"#080707aa");
  rect(x,PADDLE_Y,w,22,"#262521");
  rect(x,PADDLE_Y,w,3,pressure===6?LIME:"#d48b60");
  rect(x,PADDLE_Y+19,w,3,"#090808");
  const count = wide>0?4:3;
  for(let i=0;i<count;i++){
    const sx=x+5+(w-10)*i/count, sw=(w-10)/count;
    rect(sx+2,PADDLE_Y+5,sw-4,12,"#111210");
    for(let j=0;j<4;j++) rect(sx+6,PADDLE_Y+6+j*3,sw-12,1,"#64635a");
  }
  if(rewind){rect(x+2,PADDLE_Y+4,4,14,AMBER);rect(x+w-6,PADDLE_Y+4,4,14,AMBER);}
}
function draw() {
  ctx.setTransform(field.width/W,0,0,field.height/H,0,0);
  ctx.drawImage(backdrop,0,0);
  if(flash>0 && !motion){
    ctx.save();ctx.globalAlpha=flash*.58;ctx.strokeStyle=LIME;ctx.lineWidth=3;arch();ctx.stroke();ctx.restore();
  }
  rect(LEFT,PADDLE_Y+34,RIGHT-LEFT,1,"#d37b4a61");
  bricks.forEach(drawBrick);
  for(const p of sparks){
    ctx.globalAlpha=Math.min(1,p.life*3);
    rect(p.x,p.y,p.size,p.size,p.color);
  }
  ctx.globalAlpha=1;
  for(const drop of drops) {
    const p=powerups[drop.type];
    rect(drop.x-35,drop.y-11,70,22,"#171715");
    rect(drop.x-35,drop.y-11,70,2,p.color);
    ctx.fillStyle=p.color;ctx.textAlign="center";ctx.font="bold 12px monospace";ctx.fillText(p.name,drop.x,drop.y+5);
  }
  speaker();
  for(const ball of balls){
    ctx.save();ctx.fillStyle=ball.pierce?LIME:"#fff5d8";ctx.shadowColor=ball.pierce?LIME:AMBER;ctx.shadowBlur=ball.pierce?23:12;
    ctx.beginPath();ctx.arc(ball.x,ball.y,R,0,Math.PI*2);ctx.fill();ctx.restore();
  }
}
function resize() {
  const box=field.getBoundingClientRect(), dpr=Math.min(2,devicePixelRatio || 1);
  field.width=Math.max(1,Math.round(box.width*dpr));
  field.height=Math.max(1,Math.round(box.height*dpr));
}
function initAudio() {
  if(!sound) return;
  if(!audio) {
    const Audio = window.AudioContext || window.webkitAudioContext;
    if(!Audio) return;
    audio = new Audio();
    master = audio.createGain();
    const compressor = audio.createDynamicsCompressor();
    master.gain.value=.55;
    master.connect(compressor).connect(audio.destination);
  }
  if(audio.state === "suspended") audio.resume().catch(()=>{});
}
function note(type,freq,end,duration,volume,when) {
  if(!sound || !audio || audio.state !== "running") return;
  const osc=audio.createOscillator(), gain=audio.createGain(), at=when??audio.currentTime;
  osc.type=type;
  osc.frequency.setValueAtTime(freq,at);
  if(end!==freq) osc.frequency.exponentialRampToValueAtTime(end,at+duration);
  gain.gain.setValueAtTime(.001,at);
  gain.gain.exponentialRampToValueAtTime(volume,at+.012);
  gain.gain.exponentialRampToValueAtTime(.001,at+duration);
  osc.connect(gain).connect(master);
  osc.start(at);osc.stop(at+duration+.015);
}
function soundHit(f,d,type) {note(type,f,f*.65,d,.07);}
function syncMusic() {
  if(!sound || document.hidden || !["ready","playing","clear"].includes(mode) || failedTracks >= tracks.length) {
    music.pause();
    return;
  }
  music.play().catch(() => {
    // The next user gesture can resume playback when autoplay is blocked.
  });
}
function loadTrack(index) {
  trackIndex = index;
  const track = tracks[index];
  get("track").textContent = track.title;
  music.src = "assets/audio/" + encodeURIComponent(track.file);
  syncMusic();
}
music.addEventListener("ended", () => {
  failedTracks = 0;
  loadTrack((trackIndex + 1) % tracks.length);
});
music.addEventListener("error", () => {
  failedTracks++;
  if(failedTracks < tracks.length) loadTrack((trackIndex + 1) % tracks.length);
  else get("track").textContent = "Soundtrack unavailable";
});
function togglePause() {
  if(mode==="paused") {
    setActive(priorMode);
    initAudio();
    syncMusic();
    if(priorMode==="ready") announce("TAP OR PRESS SPACE TO LAUNCH",60);
    return;
  }
  if(mode!=="playing" && mode!=="ready") return;
  priorMode=mode;
  keys.clear();
  show("paused","HOLD","PAUSED.","The sound system is on standby.","Resume","Press P or Escape to resume");
  syncMusic();
}
function action() {
  initAudio();
  if(mode==="paused") togglePause();
  else if(mode==="clear") {level++;startWall();}
  else if(["menu","lost","won"].includes(mode)) startGame();
}
function movePointer(event) {
  const box=field.getBoundingClientRect();
  bat=clamp((event.clientX-box.left)*W/box.width,LEFT+paddleWidth()/2,RIGHT-paddleWidth()/2);
}
field.addEventListener("pointerdown",event=>{
  if(pointer !== undefined || !["ready","playing"].includes(mode)) return;
  pointer=event.pointerId;
  field.setPointerCapture(pointer);
  movePointer(event);
  initAudio();
  if(music.paused) syncMusic();
  serve();
});
field.addEventListener("pointermove",event=>{
  if(!["ready","playing"].includes(mode)) return;
  if(event.pointerType==="mouse" || event.pointerId===pointer) movePointer(event);
});
field.addEventListener("lostpointercapture",event=>{if(pointer===event.pointerId) pointer=undefined;});
get("action").addEventListener("click",action);
get("pause").addEventListener("click",togglePause);
get("sound").addEventListener("click",()=>{
  sound=!sound;
  if(sound) initAudio();
  if(master) master.gain.setTargetAtTime(sound?.55:0,audio.currentTime,.025);
  get("sound").textContent=sound?"Sound on":"Sound off";
  get("sound").setAttribute("aria-pressed",sound);
  syncMusic();
});
window.addEventListener("keydown",event=>{
  if(event.altKey || event.ctrlKey || event.metaKey) return;
  if(["ArrowLeft","ArrowRight","KeyA","KeyD"].includes(event.code)) {
    if(!["ready","playing"].includes(mode)) return;
    event.preventDefault();keys.add(event.code);return;
  }
  if(event.repeat) return;
  if(event.code==="KeyP" || event.code==="Escape") {togglePause();return;}
  if(event.code==="Space" && mode==="ready") {event.preventDefault();initAudio();if(music.paused) syncMusic();serve();}
});
window.addEventListener("keyup",event=>keys.delete(event.code));
window.addEventListener("blur",()=>keys.clear());
document.addEventListener("visibilitychange",()=>{
  if(document.hidden && ["ready","playing"].includes(mode)) togglePause();
  else syncMusic();
});
new ResizeObserver(resize).observe(field);
backdrop=makeBackdrop();
loadWall();
hud();
resize();
let last=performance.now(), lag=0;
function frame(now) {
  lag+=Math.min(.06,(now-last)/1000);
  last=now;
  while(lag>=1/180){update(1/180);lag-=1/180;}
  draw();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
