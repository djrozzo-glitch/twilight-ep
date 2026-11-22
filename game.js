"use strict";
const get = id => document.getElementById(id);
const field = get("field");
const ctx = field.getContext("2d");
const W = 640, H = 570, LEFT = 23, RIGHT = W - LEFT, TOP = 20, BREACH_Y = 474, R = 10;
const DJ_BOTTOM = H - 4, DJ_DECK_ROW = 425/512, DJ_BOTTOM_ROW = 496/512;
const LIME = "#e2fc75", AMBER = "#ff9c61", BLUE = "#9fe1f1";
const stages = [
  { name:"The Arch", speed:327, advance:2.55, rows:[".V.I.", "I.P.L", "dVrLs"] },
  { name:"Soundcheck", speed:354, advance:2.95, rows:[".P.P.", "VL.IV", "IPPLV", "LsdrI"] },
  { name:"System Pressure", speed:380, advance:3.6, rows:["PL.IV", "IPLVI", "VPILP", "rIdPs"] },
];
const clubbers = {
  V:{sprite:"clubber-vip", color:BLUE},
  I:{sprite:"clubber-influencer", color:"#ff73b4"},
  P:{sprite:"clubber-puffer", color:"#fff2d5", hp:2},
  L:{sprite:"clubber-lime", color:LIME},
};
const bonusCarriers = {d:"V", s:"L", r:"I"};
const art = {};
const djProfiles = new Map();
function loadImage(key, path) {
  const image = new Image();
  image.src = path;
  art[key] = image;
}
// Frame names and timings match assets/sprites/dj-throw.json.
const throwFrames = [
  { sprite:"dj-00-idle", start:0 },
  { sprite:"dj-01-pickup", start:0 },
  { sprite:"dj-02-windup", start:80 },
  { sprite:"dj-03-release", start:180 },
  { sprite:"dj-04-follow-through", start:240 },
  { sprite:"dj-05-recovery", start:330 },
];
const releaseTime = throwFrames[3].start;
const throwDuration = 430;
for(const {sprite} of throwFrames) loadImage(sprite, "assets/sprites/frames/" + sprite + ".png");
loadImage("alley", "assets/backgrounds/london-alley.webp");
for(const name of ["dj-idle","dj-hit","clubber-vip","clubber-influencer","clubber-puffer","clubber-lime",
  "vinyl","vinyl-charged","bonus-dubplate","bonus-stack","bonus-rewind","fx-impact"]) {
  loadImage(name, "assets/sprites/" + name + ".png");
}
const tracks = [
  { title: "lowQ – Twilight", file: "lowQ - Twilight.mp3" },
  { title: "lowQ – Run from Babylon", file: "lowQ – Run from Babylon.mp3" },
];
const music = new Audio();
music.preload = "none";
music.volume = .8;
let trackIndex = 0;
let failedTracks = 0;
const powerups = {d:{name:"DUBPLATE",sprite:"bonus-dubplate",color:BLUE},s:{name:"STACK",sprite:"bonus-stack",color:LIME},r:{name:"REWIND",sprite:"bonus-rewind",color:AMBER}};
const keys = new Set();
const motion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const getBest = () => { try { return Number(localStorage.getItem("pressure-test-best")) || 0; } catch { return 0; } };
let best = getBest(), score = 0, level = 0, lives = 3, pressure = 0, mode = "menu", priorMode;
let crowd = [], balls = [], drops = [], impacts = [], bat = W / 2, wide = 0, rewind = false;
let flash = 0, time = 0, noticeUntil = 0, walkTime = 0, throwElapsed = -1, spriteAspect = 1;
let audio, master, sound = true;
let pointer;

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
function placeClubber(enemy) {
  const depth = clamp((enemy.feet-240)/(BREACH_Y-240),0,1);
  const spread = 38 + depth*98;
  const width = 32 + depth*38;
  const height = width*(enemy.kind === "P" ? 1.91 : 2.34)*spriteAspect;
  enemy.center = W/2 + enemy.lane*spread;
  enemy.w = width*.83;
  enemy.h = height*.88;
  enemy.x = enemy.center-enemy.w/2;
  enemy.y = enemy.feet-height*.94;
  enemy.drawW = width;
  enemy.drawH = height;
}
function loadWave() {
  const rows = stages[level].rows;
  crowd = rows.flatMap((row,r)=>[...row].flatMap((token,c)=>{
    if(token === ".") return [];
    const kind = bonusCarriers[token] ?? token;
    const feet = 242+r*44;
    const enemy = {kind, lane:c-2, feet, startFeet:feet, hp:clubbers[kind].hp ?? 1,
      bonus:bonusCarriers[token] ? token : null, phase:r*1.3+c*1.8, hurt:0};
    placeClubber(enemy);
    return [enemy];
  }));
}
function ready() {
  throwElapsed = -1;
  balls = [newBall(bat,readyBallY())];
  balls[0].attached = true;
  setActive("ready");
  announce("TAP OR PRESS SPACE TO LAUNCH",60);
}
function newBall(x,y) {return {x,y,vx:0,vy:0,pierce:0,attached:false};}
function startGame() {
  level = 0;
  score = 0;
  lives = 3;
  startWave();
  failedTracks = 0;
  loadTrack(0);
}
function startWave() {
  pressure = 0; bat = W/2; wide = 0; rewind = false; drops = []; impacts = []; walkTime = 0;
  loadWave();
  hud();
  ready();
}
function serve() {
  if(mode !== "ready" || throwElapsed >= 0) return;
  throwElapsed = 0;
  announce("");
}
function advanceThrow(dt) {
  if(throwElapsed < 0) return;
  throwElapsed += dt * 1000;
  if(mode === "ready" && throwElapsed >= releaseTime) {
    const ball = balls[0];
    const width = paddleWidth();
    // The hand in the release frame is above and to the right of the deck.
    ball.x = clamp(bat + width*.46,LEFT+R,RIGHT-R);
    ball.y = deckY() - width*.86*spriteAspect;
    ball.attached = false;
    launch(ball,bat < W/2 ? .31 : -.31);
    setActive("playing");
    announce(stages[level].name.toUpperCase());
  }
  if(throwElapsed >= throwDuration) throwElapsed = -1;
}
function launch(ball, angle) {
  const speed = stages[level].speed;
  ball.vx = Math.sin(angle)*speed;
  ball.vy = -Math.cos(angle)*speed;
}
function paddleWidth() {return wide > 0 ? 156 : 112;}
function djHeight() {return paddleWidth()*1.13*spriteAspect;}
function djTop() {return DJ_BOTTOM-djHeight()*DJ_BOTTOM_ROW;}
function deckY() {return djTop()+djHeight()*DJ_DECK_ROW;}
function readyBallY() {return djTop()+djHeight()*40/512-(R+3)*spriteAspect;}

function djBounds() {
  const width = paddleWidth();
  const frame = throwElapsed < 0 ? throwFrames[0] : throwFrames.findLast(({start})=>start<=throwElapsed);
  if(imageReady(art[frame.sprite])) {
    const w = width*512/350;
    return {sprite:frame.sprite,x:bat-w/2,y:djTop(),w,h:djHeight()};
  }
  const legacy = throwElapsed >= releaseTime ? "dj-hit" : "dj-idle";
  if(imageReady(art[legacy])) {
    const h = width*.87*spriteAspect;
    return {sprite:legacy,x:bat-width/2,y:DJ_BOTTOM-h,w:width,h};
  }
  return {x:bat-width/2,y:deckY(),w:width,h:13};
}

function djProfile(spriteName) {
  if(djProfiles.has(spriteName)) return djProfiles.get(spriteName);
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const mask = canvas.getContext("2d",{willReadFrequently:true});
  mask.drawImage(art[spriteName],0,0,size,size);
  const {data} = mask.getImageData(0,0,size,size);
  const top = new Uint8Array(size).fill(size);
  const bottom = new Uint8Array(size);
  for(let y=0;y<size;y++) for(let x=0;x<size;x++) {
    if(data[(y*size+x)*4+3] < 110) continue;
    top[x] = Math.min(top[x],y);
    bottom[x] = y+1;
  }
  const profile = {top,bottom};
  djProfiles.set(spriteName,profile);
  return profile;
}

function djContact(ball, previousY, dj) {
  const radiusY = R*spriteAspect;
  if(ball.vy <= 0 || ball.y+radiusY < dj.y || previousY-radiusY > dj.y+dj.h ||
    ball.x+R < dj.x || ball.x-R > dj.x+dj.w) return undefined;
  const {top,bottom} = dj.sprite ? djProfile(dj.sprite) : {top:[0],bottom:[1]};
  const stepX = dj.w/top.length, stepY = dj.h/top.length;
  const first = Math.max(0,Math.floor((ball.x-R-dj.x)/stepX));
  const last = Math.min(top.length-1,Math.floor((ball.x+R-dj.x)/stepX));
  let contact;
  for(let col=first;col<=last;col++) {
    if(bottom[col] === 0) continue;
    const left = dj.x+col*stepX;
    const dx = ball.x-clamp(ball.x,left,left+stepX);
    const reach = radiusY*Math.sqrt(Math.max(0,1-(dx/R)**2));
    const surface = dj.y+top[col]*stepY-reach;
    if(ball.y >= surface && previousY <= dj.y+bottom[col]*stepY+reach) {
      contact = contact === undefined ? surface : Math.min(contact,surface);
    }
  }
  return contact;
}

function hitBat(ball, contact) {
  const offset = clamp((ball.x-bat)/(paddleWidth()/2),-1,1);
  let angle = offset * 1.04;
  if(Math.abs(angle)<.13) angle = (angle || ball.vx || 1) < 0 ? -.13 : .13;
  launch(ball,angle);
  throwElapsed = releaseTime;
  ball.y = contact-.25;
  if(pressure === 6) {
    ball.pierce = 4;
    pressure = 0;
    flash = .7;
    announce("PRESSURE RELEASE");
    soundHit(64,.20,"triangle");
    hud();
  } else soundHit(150,.065,"sine");
}
function waveCleared() {
  addScore(250);
  if(level === stages.length-1) {
    show("won","ALL THREE WAVES CLEARED","SYSTEM CLEAR.",`Final score ${score.toLocaleString("en-GB")}.`,"Play again");
    syncMusic();
    return;
  }
  show("clear","WAVE CLEARED",stages[level].name.toUpperCase()+".",`Next up · ${stages[level+1].name}`,"Next wave");
}
function loseBall(breach = false) {
  if(breach) {
    for(const enemy of crowd) {
      enemy.feet = enemy.startFeet;
      placeClubber(enemy);
    }
    flash = .42;
    soundHit(80,.19,"sawtooth");
  }
  if(rewind && !breach) {
    rewind = false;
    ready();
    announce("REWIND · VINYL SAVED",3);
    soundHit(98,.22,"triangle");
    return;
  }
  lives--;
  pressure = 0;
  wide = 0;
  rewind = false;
  drops = [];
  hud();
  if(lives === 0) {
    show("lost","END OF SET","SIGNAL LOST.",`Score ${score.toLocaleString("en-GB")} · Best ${best.toLocaleString("en-GB")}`,"Play again");
    syncMusic();
    return;
  }
  ready();
  announce(`${breach ? "CROWD REACHED THE DECK · " : ""}${lives} ${lives === 1 ? "LIFE" : "LIVES"} LEFT · TAP TO LAUNCH`,8);
}
function collect(type) {
  if(type === "s") wide = 14;
  if(type === "r") rewind = true;
  if(type === "d" && balls.length < 4) {
    const extra = newBall(bat,readyBallY());
    launch(extra, bat < W/2 ? .66 : -.66);
    balls.push(extra);
  }
  announce(type === "r" ? "REWIND · SAVE ARMED" : type === "s" ? "STACK · WIDER DECK" : "DUBPLATE · EXTRA VINYL");
  soundHit(350,.14,"triangle");
  addScore(50);
}
function hitClubber(ball, enemy, oldX, oldY) {
  const charged = ball.pierce > 0;
  const breaking = charged || enemy.hp === 1;
  if(charged) ball.pierce--;
  else {
    if(oldY+R <= enemy.y) {ball.vy = -Math.abs(ball.vy);ball.y = enemy.y-R-.25;}
    else if(oldY-R >= enemy.y+enemy.h) {ball.vy = Math.abs(ball.vy);ball.y = enemy.y+enemy.h+R+.25;}
    else if(oldX+R <= enemy.x) {ball.vx = -Math.abs(ball.vx);ball.x = enemy.x-R-.25;}
    else if(oldX-R >= enemy.x+enemy.w) {ball.vx = Math.abs(ball.vx);ball.x = enemy.x+enemy.w+R+.25;}
    else {
      ball.vy *= -1;
      ball.y = ball.vy < 0 ? enemy.y-R-.25 : enemy.y+enemy.h+R+.25;
    }
  }
  if(!motion) impacts.push({x:ball.x,y:ball.y,life:.24});
  if(breaking) {
    crowd.splice(crowd.indexOf(enemy),1);
    if(enemy.bonus) drops.push({x:enemy.center,y:enemy.y+enemy.h/2,type:enemy.bonus});
    pressure = Math.min(6,pressure+1);
    addScore(enemy.kind === "P" ? 180 : 100);
    if(pressure === 6 && !get("notice").textContent) announce("PRESSURE READY");
  } else {
    enemy.hp--;
    enemy.hurt = .18;
    addScore(25);
  }
  soundHit(breaking?136:75,.072,breaking?"triangle":"sine");
}
function update(dt) {
  time += dt;
  if(time >= noticeUntil && get("notice").textContent) announce("",0);
  if(mode !== "ready" && mode !== "playing") return;
  flash = Math.max(0,flash-dt*2.4);
  const direction = Number(keys.has("ArrowRight")||keys.has("KeyD"))-Number(keys.has("ArrowLeft")||keys.has("KeyA"));
  if(direction) bat = clamp(bat+direction*530*dt,LEFT+paddleWidth()/2,RIGHT-paddleWidth()/2);
  advanceThrow(dt);
  if(mode === "ready") {balls[0].x = bat;balls[0].y = readyBallY();return;}
  wide = Math.max(0,wide-dt);
  bat = clamp(bat,LEFT+paddleWidth()/2,RIGHT-paddleWidth()/2);
  walkTime += dt;
  for(const enemy of crowd) {
    enemy.feet += dt*stages[level].advance;
    enemy.hurt = Math.max(0,enemy.hurt-dt);
    placeClubber(enemy);
  }
  const dj = djBounds();
  for(const ball of balls) {
    const oldX = ball.x, oldY = ball.y;
    ball.x += ball.vx*dt;
    ball.y += ball.vy*dt;
    if(ball.x-R<LEFT || ball.x+R>RIGHT) {
      ball.x = clamp(ball.x,LEFT+R,RIGHT-R);
      ball.vx *= -1;
    }
    if(ball.y-R<TOP) {ball.y=TOP+R;ball.vy=Math.abs(ball.vy);}
    const contact = djContact(ball,oldY,dj);
    if(contact !== undefined) {
      hitBat(ball,contact);
      continue;
    }
    const enemy = crowd.find(b=>{
      const dx = ball.x-clamp(ball.x,b.x,b.x+b.w), dy = ball.y-clamp(ball.y,b.y,b.y+b.h);
      return dx*dx+dy*dy<=R*R;
    });
    if(enemy) hitClubber(ball,enemy,oldX,oldY);
    if(!crowd.length) {waveCleared();return;}
  }
  if(crowd.some(enemy=>enemy.feet >= BREACH_Y)) {loseBall(true);return;}
  balls = balls.filter(ball=>ball.y < H+R);
  if(!balls.length) {loseBall();return;}
  for(const drop of drops) {
    const previous = drop.y;
    const deck = deckY();
    drop.y += 171*dt;
    if(previous+11<deck && drop.y+11>=deck && Math.abs(drop.x-bat)<paddleWidth()/2+17) {
      collect(drop.type);
      drop.y = H+30;
    }
  }
  drops = drops.filter(drop=>drop.y<H+15);
  impacts = impacts.filter(impact=>(impact.life-=dt)>0);
}

function imageReady(image) {return image.complete && image.naturalWidth>0;}
function sprite(name,x,y,w,h) {
  const image = art[name];
  if(!imageReady(image)) return false;
  ctx.drawImage(image,x,y,w,h);
  return true;
}
function background() {
  rect(0,0,W,H,"#141a27");
  const image = art.alley;
  if(!imageReady(image)) return;
  const aspect = field.width/field.height;
  const sw = Math.min(image.naturalWidth,image.naturalHeight*aspect);
  const sh = Math.min(image.naturalHeight,image.naturalWidth/aspect);
  ctx.drawImage(image,(image.naturalWidth-sw)/2,(image.naturalHeight-sh)*.4,sw,sh,0,0,W,H);
  rect(0,0,W,H,"#0c10142a");
}
function drawClubber(enemy) {
  const info = clubbers[enemy.kind];
  const step = walkTime*7.1+enemy.phase;
  const active = mode === "playing" && !motion;
  const sway = active ? Math.sin(step)*2 : 0;
  const lift = active ? Math.abs(Math.sin(step))*2.6 : 0;
  const foot = enemy.feet-lift;
  ctx.fillStyle="#080a0cb0";
  ctx.beginPath();
  ctx.ellipse(enemy.center,enemy.feet-2,enemy.drawW*.38,6,0,0,Math.PI*2);
  ctx.fill();
  if(enemy.hurt > 0) {
    ctx.shadowColor = info.color;
    ctx.shadowBlur = 14;
  }
  if(!sprite(info.sprite,enemy.center-enemy.drawW/2+sway,foot-enemy.drawH,enemy.drawW,enemy.drawH)) {
    rect(enemy.x,enemy.y,enemy.w,enemy.h,info.color);
  }
  ctx.shadowBlur = 0;
  if(enemy.hp>1) rect(enemy.center-7,foot+3,14,2,info.color);
}
function drawDJ() {
  const dj = djBounds();
  if(dj.sprite) sprite(dj.sprite,dj.x,dj.y,dj.w,dj.h);
  else rect(dj.x,dj.y,dj.w,dj.h,"#555548");
  if(pressure===6 || rewind) {
    const width = paddleWidth();
    const trim = pressure===6?LIME:AMBER;
    rect(bat-width/2+3,deckY()-1,16,2,trim);
    rect(bat+width/2-19,deckY()-1,16,2,trim);
  }
}
function draw() {
  ctx.setTransform(field.width/W,0,0,field.height/H,0,0);
  background();
  rect(LEFT,BREACH_Y,RIGHT-LEFT,1,flash>0?"#dcb872aa":"#dcb87238");
  for(const enemy of crowd) drawClubber(enemy);
  for(const impact of impacts) {
    const size = 34 + (.24-impact.life)*150;
    ctx.globalAlpha = Math.min(1,impact.life*7);
    sprite("fx-impact",impact.x-size/2,impact.y-size*spriteAspect/2,size,size*spriteAspect);
  }
  ctx.globalAlpha=1;
  for(const drop of drops) {
    const item = powerups[drop.type];
    const w = 42, h = 31*spriteAspect;
    if(!sprite(item.sprite,drop.x-w/2,drop.y-h/2,w,h)) rect(drop.x-11,drop.y-7,22,14,item.color);
  }
  drawDJ();
  for(const ball of balls) {
    if(ball.attached && throwElapsed >= 0) continue;
    const size = R*2+4, height = size*spriteAspect;
    const name = ball.pierce ? "vinyl-charged" : "vinyl";
    if(sprite(name,ball.x-size/2,ball.y-height/2,size,height)) continue;
    ctx.beginPath();
    ctx.fillStyle = ball.pierce?LIME:"#fff5d8";
    ctx.arc(ball.x,ball.y,R,0,Math.PI*2);
    ctx.fill();
  }
}
function resize() {
  const box=field.getBoundingClientRect(), dpr=Math.min(2,devicePixelRatio || 1);
  field.width=Math.max(1,Math.round(box.width*dpr));
  field.height=Math.max(1,Math.round(box.height*dpr));
  spriteAspect = clamp((field.width/W)/(field.height/H),.5,1.18);
  crowd.forEach(placeClubber);
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
    if(priorMode==="ready" && throwElapsed < 0) announce("TAP OR PRESS SPACE TO LAUNCH",60);
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
  else if(mode==="clear") {level++;startWave();}
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
loadWave();
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
