"use strict";
const get = id => document.getElementById(id);
const field = get("field");
const touchStrip = get("touch-strip");
const ctx = field.getContext("2d");
const W = 640, H = 570, LEFT = 23, RIGHT = W - LEFT, TOP = 20, BREACH_Y = 474, R = 10;
const DJ_BOTTOM = H - 4, DJ_DECK_ROW = 425/512, DJ_BOTTOM_ROW = 496/512;
// The entrance is the ground under the arch in london-alley.webp.
const ALLEY_W = 1122, ALLEY_H = 1402, ARCH_X = .505, ARCH_Y = .446;
const FRONT_ROW_Y = 356, ENTRY_DEPTH = 20;
const LIME = "#e2fc75", AMBER = "#ff9c61", BLUE = "#9fe1f1";
const stages = [
  {name:"The Arch", speed:326, advance:1.25, rows:["NI.LV","ILNP.","IVHVI",".NILH","d.V.s"], incoming:[".LHP.","I.r.N"]},
  {name:"Side Street", speed:338, advance:1.38, rows:["I.OPL","PINH.","VOLVN",".IVPH","Vs.Od"], incoming:["I.bOL",".V.rP"]},
  {name:"Soundcheck", speed:350, advance:1.52, rows:["VP.OH","NOLPI","IPH.L","PLONP",".dP.s"], incoming:["N.mLV",".rPl."]},
  {name:"Back Door", speed:362, advance:1.68, rows:["LIP.O","AILVP","HVPOL","VP.NA","ds.PV"], incoming:[".mH.P","V.lPI","I.bOr"]},
  {name:"Last Entry", speed:374, advance:1.85, rows:["PL.OA","HLPNP","LPVHL","PILPV","IVsPd"], incoming:[".lPLO","Vw.Hr",".VcLP"]},
  {name:"The Queue", speed:388, advance:2.05, rows:["IPLA.","CPLON","PLOPV","HLVPC","dPsIV"], incoming:["b.CwP","Lm.AP","Irl.C"]},
  {name:"Lock-In", speed:403, advance:2.24, rows:["CLVAI","VPIPL","OLPHC","PAIVL","IdPsV"], incoming:[".uPbI","Vm.HP","lVrCw"]},
  {name:"No Guest List", speed:418, advance:2.42, rows:["CLPPI","LIOVA","VPIPL","HPALM","PsdVL"], incoming:["wMP.V","Pm.bO","lVPIr","IcHuP"]},
  {name:"Peak Time", speed:435, advance:2.63, rows:["PVMLP","LPIOV","VPCLA","IPVPM","sPdPV"], incoming:["PmHbV","u.PwL","IVlAr","P.cMP"]},
  {name:"System Pressure", speed:455, advance:2.82, rows:["APMCL","LPPVO","PVAPP","IPPML","LsdPP"], incoming:["mVPwI","OlPbV","PrMuP","PL.cC"]},
];
const clubbers = {
  V:{sprite:"clubber-vip", color:BLUE},
  I:{sprite:"clubber-influencer", color:"#ff73b4"},
  P:{sprite:"clubber-puffer", color:"#fff2d5", hp:2},
  L:{sprite:"clubber-lime", color:LIME},
  N:{sprite:"enemy-normie", color:"#c8cfd4", aspect:352/640},
  H:{sprite:"enemy-neighbour", color:"#ff977f", aspect:352/640},
  O:{sprite:"enemy-office", color:BLUE, aspect:352/640},
  A:{sprite:"enemy-residents-chair", color:"#c696ed", aspect:352/640, hp:2},
  C:{sprite:"enemy-promoter", color:"#ff9d86", aspect:352/640},
  M:{sprite:"enemy-noise-inspector", color:AMBER, aspect:352/640},
};
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
const tracks = [
  { title: "lowQ – Twilight", file: "lowQ - Twilight.mp3" },
  { title: "lowQ – Run from Babylon", file: "lowQ – Run from Babylon.mp3" },
];
const music = new Audio();
music.preload = "none";
music.volume = .8;
let trackIndex = 0;
let failedTracks = 0;
const powerups = {
  d:{name:"Dubplate", note:"EXTRA VINYL", carrier:"V", sprite:"bonus-dubplate", color:BLUE},
  s:{name:"Stack", note:"WIDER DECK", carrier:"L", sprite:"bonus-stack", color:LIME, duration:14},
  r:{name:"Rewind", note:"SAVE ARMED", carrier:"I", sprite:"bonus-rewind", color:AMBER},
  b:{name:"Brake", note:"SLOWER CROWD", carrier:"H", sprite:"bonus-brake", icon:"II", color:BLUE, duration:9},
  c:{name:"Charge", note:"PRESSURE FULL", carrier:"C", sprite:"bonus-charge", icon:"+", color:LIME},
  m:{name:"Half Size", note:"DJ SHRINKS", carrier:"A", sprite:"hazard-half-size", icon:"½", color:"#ff85b8", duration:7, hazard:true},
  l:{name:"Reverse", note:"LEFT AND RIGHT SWAPPED", carrier:"O", sprite:"hazard-reverse", icon:"↔", color:"#ff85b8", duration:6, hazard:true},
  w:{name:"Warp", note:"UNEVEN BOUNCES", carrier:"N", sprite:"hazard-warp", icon:"~", color:"#ff85b8", duration:8, hazard:true},
  u:{name:"Rush", note:"FASTER CROWD", carrier:"M", sprite:"hazard-rush", icon:">>", color:"#ff85b8", duration:7, hazard:true},
};
for(const name of ["dj-idle","dj-hit","vinyl","vinyl-charged","fx-impact",
  ...Object.values(clubbers).map(({sprite})=>sprite),
  ...Object.values(powerups).map(({sprite})=>sprite)]) {
  loadImage(name, "assets/sprites/" + name + ".png");
}
const keys = new Set();
const motion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const getBest = () => { try { return Number(localStorage.getItem("pressure-test-best")) || 0; } catch { return 0; } };
let best = getBest(), score = 0, level = 0, lives = 3, pressure = 0, mode = "menu", priorMode;
let crowd = [], balls = [], drops = [], impacts = [], bat = W / 2, wide = 0, rewind = false;
let incomingRows = [], rowCount = 0, brake = 0, hazard = null, hazardTime = 0, warpDirection = 1;
let alleyCrop, archX = W*ARCH_X, archY = H*ARCH_Y;
const incomingStatus = get("incoming");
const effectStatus = get("effects");
let flash = 0, time = 0, noticeUntil = 0, walkTime = 0, throwElapsed = -1, spriteAspect = 1;
let audio, master, sound = true;
let pointer;

function rect(x,y,w,h,color) {ctx.fillStyle=color;ctx.fillRect(x,y,w,h);}
function clamp(v,min,max) {return Math.max(min,Math.min(max,v));}
function hud() {
  get("level").textContent = `${String(level + 1).padStart(2,"0")} / ${stages.length}`;
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
  if(document.pointerLockElement === field) document.exitPointerLock();
  mode = kind;
  announce("",0);
  get("overlay").hidden = false;
  touchStrip.disabled = true;
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
  touchStrip.disabled = false;
  get("pause").disabled = false;
  get("pause").textContent = "Pause";
}
function placeClubber(enemy) {
  const distance = Math.max(0,enemy.feet-archY);
  const depth = clamp(distance/(BREACH_Y-archY),0,1);
  const spread = 18 + depth*128;
  const width = 23 + depth*68;
  enemy.visibility = clamp(distance/ENTRY_DEPTH,0,1);
  const info = clubbers[enemy.kind];
  const heightRatio = info.hp===2 ? 1.91 : 2.34;
  const height = width*heightRatio*spriteAspect;
  const drawWidth = info.aspect ? width*heightRatio*info.aspect : width;
  enemy.center = archX+(W/2-archX)*depth + (enemy.lane+enemy.stagger)*spread;
  enemy.w = width*.83;
  enemy.h = height*.88;
  enemy.x = enemy.center-enemy.w/2;
  enemy.y = enemy.feet-height*.94;
  enemy.drawW = drawWidth;
  enemy.drawH = height;
}
function addRow(row, feet) {
  const stagger = rowCount++ % 2 ? .16 : -.16;
  for(const [lane,token] of [...row].entries()) {
    if(token === ".") continue;
    const item = powerups[token];
    const kind = item?.carrier ?? token;
    const enemy = {kind,lane:lane-2,stagger,feet,hp:clubbers[kind].hp ?? 1,
      bonus:item ? token : null,phase:lane*1.8+feet*.03,hurt:0};
    placeClubber(enemy);
    crowd.push(enemy);
  }
}
function rowSpacing() {
  return (FRONT_ROW_Y-archY-ENTRY_DEPTH)/(stages[level].rows.length-1);
}
function loadWave() {
  const stage = stages[level];
  crowd = [];
  rowCount = 0;
  stage.rows.forEach((row,index)=>addRow(row,archY+ENTRY_DEPTH+index*rowSpacing()));
  incomingRows = [...stage.incoming];
  incomingStatus.textContent = `Incoming rows ${incomingRows.length}`;
}
function reinforce() {
  if(!incomingRows.length) return;
  const back = crowd.reduce((feet,enemy)=>Math.min(feet,enemy.feet),BREACH_Y);
  if(back < archY+rowSpacing()) return;
  addRow(incomingRows.shift(),archY);
  crowd.sort((a,b)=>a.feet-b.feet);
  incomingStatus.textContent = `Incoming rows ${incomingRows.length}`;
}
function updateEffects(dt) {
  wide = Math.max(0,wide-dt);
  brake = Math.max(0,brake-dt);
  hazardTime = Math.max(0,hazardTime-dt);
  if(hazardTime === 0) hazard = null;
  const effects = [];
  if(hazard) effects.push(`${powerups[hazard].name} ${Math.ceil(hazardTime)}s`);
  if(wide) effects.push(`Stack ${Math.ceil(wide)}s`);
  if(brake) effects.push(`Brake ${Math.ceil(brake)}s`);
  if(rewind) effects.push("Rewind ready");
  const text = effects.join(" · ");
  if(effectStatus.textContent !== text) {
    effectStatus.textContent = text;
    effectStatus.hidden = !text;
    effectStatus.classList.toggle("hazard",Boolean(hazard));
  }
}
function resetEffects() {
  wide = 0; brake = 0; hazardTime = 0; rewind = false; warpDirection = 1;
  updateEffects(0);
}
function ready() {
  throwElapsed = -1;
  balls = [newBall(bat,readyBallY())];
  balls[0].attached = true;
  setActive("ready");
  announce("TAP BELOW OR PRESS SPACE TO LAUNCH",60);
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
  pressure = 0; bat = W/2; drops = []; impacts = []; walkTime = 0;
  resetEffects();
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
function paddleWidth() {return (wide > 0 ? 156 : 112) * (hazard === "m" ? .5 : 1);}
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
  if(hazard === "w") {
    angle = clamp(angle + .40*warpDirection,-1.14,1.14);
    warpDirection *= -1;
  }
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
    show("won","ALL TEN LEVELS CLEARED","SYSTEM CLEAR.",`Final score ${score.toLocaleString("en-GB")}.`,"Play again");
    syncMusic();
    return;
  }
  show("clear","LEVEL CLEARED",stages[level].name.toUpperCase()+".",`Next up · ${stages[level+1].name}`,"Next level");
}
function loseBall(breach = false) {
  if(breach) {
    const setback = (330-archY)/(BREACH_Y-archY);
    for(const enemy of crowd) {
      enemy.feet = archY+(enemy.feet-archY)*setback;
      placeClubber(enemy);
    }
    flash = .42;
    soundHit(80,.19,"sawtooth");
  }
  if(rewind && !breach) {
    rewind = false;
    updateEffects(0);
    ready();
    announce("REWIND · VINYL SAVED",3);
    soundHit(98,.22,"triangle");
    return;
  }
  lives--;
  pressure = 0;
  resetEffects();
  drops = [];
  hud();
  if(lives === 0) {
    show("lost","END OF SET","SIGNAL LOST.",`Score ${score.toLocaleString("en-GB")} · Best ${best.toLocaleString("en-GB")}`,"Play again");
    syncMusic();
    return;
  }
  ready();
  announce(`${breach ? "CROWD REACHED THE DECK · " : ""}${lives} ${lives === 1 ? "LIFE" : "LIVES"} LEFT · TAP BELOW TO LAUNCH`,8);
}
function collect(type) {
  const item = powerups[type];
  if(item.hazard) {
    hazard = type;
    hazardTime = item.duration;
    warpDirection = 1;
  }
  if(type === "s") wide = item.duration;
  if(type === "r") rewind = true;
  if(type === "b") brake = item.duration;
  if(type === "c") pressure = 6;
  if(type === "d" && balls.length < 4) {
    const extra = newBall(bat,readyBallY());
    launch(extra, bat < W/2 ? .66 : -.66);
    balls.push(extra);
  }
  updateEffects(0);
  announce(`${item.name.toUpperCase()} · ${item.note}`);
  soundHit(item.hazard?105:350,.14,item.hazard?"sawtooth":"triangle");
  if(item.hazard) hud();
  else addScore(50);
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
    addScore(clubbers[enemy.kind].hp === 2 ? 180 : 100);
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
  if(direction) bat = clamp(bat+direction*(hazard==="l"?-1:1)*530*dt,LEFT+paddleWidth()/2,RIGHT-paddleWidth()/2);
  advanceThrow(dt);
  if(mode === "ready") {balls[0].x = bat;balls[0].y = readyBallY();return;}
  updateEffects(dt);
  reinforce();
  bat = clamp(bat,LEFT+paddleWidth()/2,RIGHT-paddleWidth()/2);
  const crowdRate = (brake ? .55 : 1) * (hazard === "u" ? 1.55 : 1);
  walkTime += dt*crowdRate;
  for(const enemy of crowd) {
    enemy.feet += dt*stages[level].advance*crowdRate;
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
      if(b.visibility < .25) return false;
      const dx = ball.x-clamp(ball.x,b.x,b.x+b.w), dy = ball.y-clamp(ball.y,b.y,b.y+b.h);
      return dx*dx+dy*dy<=R*R;
    });
    if(enemy) hitClubber(ball,enemy,oldX,oldY);
    if(!crowd.length && !incomingRows.length) {waveCleared();return;}
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
  const {x,y,w,h} = alleyCrop;
  ctx.drawImage(image,x,y,w,h,0,0,W,H);
  rect(0,0,W,H,"#0c10142a");
}
function drawClubber(enemy) {
  if(enemy.visibility <= 0) return;
  ctx.save();
  ctx.globalAlpha = enemy.visibility;
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
  ctx.restore();
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
    const w = item.icon ? 34 : 42, h = (item.icon ? 34 : 31)*spriteAspect;
    if(item.sprite && sprite(item.sprite,drop.x-w/2,drop.y-h/2,w,h)) continue;
    ctx.save();
    ctx.translate(drop.x,drop.y);
    ctx.scale(1,spriteAspect);
    if(item.hazard) ctx.rotate(Math.PI/4);
    rect(-12,-12,24,24,"#221d29");
    ctx.strokeStyle=item.color;
    ctx.lineWidth=2;
    ctx.strokeRect(-12,-12,24,24);
    if(item.hazard) ctx.rotate(-Math.PI/4);
    ctx.font="bold 15px monospace";
    ctx.textAlign="center";
    ctx.textBaseline="middle";
    ctx.fillStyle=item.color;
    ctx.fillText(item.icon ?? "+",0,1);
    ctx.restore();
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
  const aspect = field.width/field.height;
  const w = Math.min(ALLEY_W,ALLEY_H*aspect);
  const h = Math.min(ALLEY_H,ALLEY_W/aspect);
  alleyCrop = {x:(ALLEY_W-w)/2,y:(ALLEY_H-h)*ARCH_Y,w,h};
  const previousArch = archY;
  archX = (ALLEY_W*ARCH_X-alleyCrop.x)*W/w;
  archY = (ALLEY_H*ARCH_Y-alleyCrop.y)*H/h;
  for(const enemy of crowd) {
    const progress = (enemy.feet-previousArch)/(BREACH_Y-previousArch);
    enemy.feet = archY+progress*(BREACH_Y-archY);
    placeClubber(enemy);
  }
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
    if(priorMode==="ready" && throwElapsed < 0) announce("TAP BELOW OR PRESS SPACE TO LAUNCH",60);
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
  if(mode==="paused") {togglePause(); if(priorMode === "playing") lockDesktopPointer();}
  else if(mode==="clear") {level++;startWave();}
  else if(["menu","lost","won"].includes(mode)) startGame();
}
// Pointer lock keeps the desktop cursor inside the game, including on trackpads.
let usedPointerLock = false;
function lockDesktopPointer() {
  if(!field.requestPointerLock || document.pointerLockElement === field) return;
  try {
    const pending = field.requestPointerLock();
    if(pending && pending.catch) pending.catch(()=>{});
  } catch {}
}
document.addEventListener("pointerlockchange",()=>{
  const locked = document.pointerLockElement === field;
  field.classList.toggle("pointer-locked",locked);
  touchStrip.classList.toggle("pointer-locked",locked);
  if(locked) usedPointerLock = true;
  else if(usedPointerLock && mode === "playing") togglePause();
});
document.addEventListener("mousemove",event=>{
  if(document.pointerLockElement !== field || !["playing","ready"].includes(mode)) return;
  const scale = W / Math.max(1,field.getBoundingClientRect().width);
  const direction = hazard === "l" ? -1 : 1;
  bat = clamp(bat + event.movementX*scale*direction,LEFT+paddleWidth()/2,RIGHT-paddleWidth()/2);
});
function movePointer(event) {
  if(document.pointerLockElement === field) return;
  const box = event.currentTarget.getBoundingClientRect();
  const position = (event.clientX-box.left)*W/box.width;
  bat = clamp(hazard === "l" ? W-position : position,LEFT+paddleWidth()/2,RIGHT-paddleWidth()/2);
}
function serveFromInput() {
  initAudio();
  if(music.paused) syncMusic();
  serve();
}
for(const surface of [field,touchStrip]) {
  surface.addEventListener("pointerdown",event=>{
    if(event.button !== 0 || pointer !== undefined || !["ready","playing"].includes(mode)) return;
    if(event.pointerType === "mouse") {
      movePointer(event);
      serveFromInput();
      lockDesktopPointer();
      return;
    }
    pointer = event.pointerId;
    surface.setPointerCapture(pointer);
    movePointer(event);
    serveFromInput();
  });
  surface.addEventListener("pointermove",event=>{
    if(!["ready","playing"].includes(mode)) return;
    if(document.pointerLockElement !== field && (event.pointerId === pointer || (pointer === undefined && surface === field && event.pointerType === "mouse"))) {
      movePointer(event);
    }
  });
  surface.addEventListener("lostpointercapture",event=>{
    if(pointer === event.pointerId) pointer = undefined;
  });
}
touchStrip.addEventListener("click",event=>{
  if(event.detail === 0) {serveFromInput(); lockDesktopPointer();}
});
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
  if(event.code==="Space" && mode==="ready") {event.preventDefault();serveFromInput();lockDesktopPointer();}
});
window.addEventListener("keyup",event=>keys.delete(event.code));
window.addEventListener("blur",()=>keys.clear());
document.addEventListener("visibilitychange",()=>{
  if(document.hidden && ["ready","playing"].includes(mode)) togglePause();
  else syncMusic();
});
new ResizeObserver(resize).observe(field);
resize();
loadWave();
hud();
let last=performance.now(), lag=0;
function frame(now) {
  lag+=Math.min(.06,(now-last)/1000);
  last=now;
  while(lag>=1/180){update(1/180);lag-=1/180;}
  draw();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
