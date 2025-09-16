const BACKEND_URL = 'https://rps-backend-pm3s.onrender.com'; // Update đúng backend của bạn!

let socket;
let localUser = {};
let curRoomId = '';
let curGameType = '';
let gameSession = {};
let rewardInventory = [];

function showScreen(id) {
  for(const s of document.querySelectorAll('.screen')) s.classList.add('hidden');
  document.getElementById(id).classList.remove('hidden');
}
function notify(msg, timeout=2100) {
  const n = document.createElement('div');
  n.className='notify-message'; n.innerHTML=msg;
  document.getElementById('notify').appendChild(n);
  setTimeout(()=>n.remove(), timeout);
}
function updateMiniUser() {
  let text = localUser?.username ? `👑 ${localUser.username}` : '';
  if(localUser.avatar) text = `<img src="${localUser.avatar}" style="width:27px;border-radius:36px;vertical-align:middle"> ${localUser.username}`;
  document.getElementById('mini-username').innerHTML = text;
  document.getElementById('mini-point').textContent = typeof localUser.point !== 'undefined' ? `★ ${localUser.point}` : '';
  document.getElementById('btn-logout').classList.toggle('hidden', !localUser || localUser.guest);
}

function saveLocalUser() {
  if(localUser.guest) sessionStorage.setItem('rps-user', JSON.stringify(localUser));
  else localStorage.setItem('rps-user', JSON.stringify(localUser));
}
function loadLocalUser() {
  let x = sessionStorage.getItem('rps-user');
  if (!x) x = localStorage.getItem('rps-user');
  if(x) try { localUser = JSON.parse(x); } catch{} else localUser = {};
  if(!localUser.point) localUser.point = 0;
  if(!localUser.userId) localUser.userId = randomUserId();
  rewardInventory = localUser.items || [];
}
function randomUserId() {
  return (Date.now() + '' + (Math.random()*1e6|0)).slice(0, 10);
}

function createGuestUser() {
  return {
    userId: randomUserId(),
    id: null,
    username: 'Guest' + (Math.random() * 1e4 | 0),
    guest: true,
    point: 0,
    items: []
  }
}

// ==== Google OAuth2 Sign in Handler
window.onGoogleSignIn = function(response) {
  const payload = JSON.parse(atob(response.credential.split('.')[1]));
  localUser = {
    id: 'gg-' + payload.sub,
    userId: payload.sub,
    username: payload.name,
    email: payload.email,
    avatar: payload.picture,
    guest: false,
    point: 100,
    items: []
  };
  saveLocalUser(); updateMiniUser();
  showScreen('main-menu');
  notify('Đăng nhập Gmail thành công!');
};

// ==== Đăng ký/Đăng nhập & Guest
function initAuth() {
  showScreen('auth-screen');
  document.getElementById('btn-register').onclick = ()=>{ showScreen('register-screen'); };
  document.getElementById('btn-back-login').onclick = ()=>{ showScreen('auth-screen'); };
  document.getElementById('btn-guest').onclick = ()=>{
    localUser = createGuestUser();
    saveLocalUser(); updateMiniUser();
    showScreen('main-menu'); notify('Chế độ khách! (Tự xoá khi đóng tab)');
  };
  document.getElementById('login-form').onsubmit = function(e) {
    e.preventDefault();
    const u = document.getElementById('login-username').value.trim();
    const p = document.getElementById('login-password').value;
    if(!u) return notify('Tên trống!');
    localUser = { id:'user-'+u, userId: randomUserId(), username: u, guest: false, point: 100, items:[] };
    saveLocalUser(); updateMiniUser();
    showScreen('main-menu'); notify('Đăng nhập demo!');
  };
  document.getElementById('register-form').onsubmit = function(e) {
    e.preventDefault();
    const u = document.getElementById('register-username').value.trim();
    const p = document.getElementById('register-password').value;
    if(!u||!p||p.length<4) return notify('Nhập đủ tên & mật khẩu ≥4 ký tự!');
    localUser = { id:'user-'+u, userId: randomUserId(), username: u, guest: false, point: 100, items:[] };
    saveLocalUser(); updateMiniUser();
    showScreen('main-menu'); notify('Đăng ký OK!');
  };
  document.getElementById('btn-logout').onclick = ()=>{
    if(localUser.guest) sessionStorage.removeItem('rps-user');
    else localStorage.removeItem('rps-user');
    localUser = {}; updateMiniUser();
    showScreen('auth-screen');
  };
}

// ==== Menu
function initMenu() {
  document.getElementById('btn-start-bot').onclick = startBotMode;
  document.getElementById('btn-create-room').onclick = ()=>showScreen('room-create');
  document.getElementById('btn-room-back').onclick = ()=>showScreen('main-menu');
  document.getElementById('btn-join-room').onclick = ()=>showScreen('room-join');
  document.getElementById('btn-join-back').onclick = ()=>showScreen('main-menu');
  document.getElementById('btn-profile').onclick = showProfileScreen;
}

// ==== Room demo
function initRoom() {
  document.getElementById('btn-do-create-room').onclick = ()=>{
    curRoomId = Math.random().toString(36).substr(2,6);
    showScreen('wait-room');
    document.getElementById('roomLinkDisplay').innerHTML = `<b>Link:</b> <input id="auto-link" style="width:90%" readonly value="${window.location.origin+'?room='+curRoomId}" /> <br><b>Mã phòng:</b> <span id="auto-code">${curRoomId}</span>`;
    document.getElementById('btn-copy-link').onclick = function() {
      navigator.clipboard.writeText(window.location.origin+'?room='+curRoomId); notify('Đã copy link!');
    };
    setTimeout(()=>document.getElementById('room-waiting-status').textContent = "Sẵn sàng chơi! (Mô phỏng)", 2000);
  };
  document.getElementById('btn-wait-cancel').onclick = ()=>showScreen('main-menu');
  document.getElementById('btn-do-join').onclick = ()=>{
    curRoomId = document.getElementById('join-room-id').value.trim();
    if(!curRoomId) return notify('Nhập mã phòng!');
    notify('Đã vào phòng '+curRoomId+'. Bắt đầu demo trận!');
    startPvpGame();
  };
}

// ==== Game BOT
function startBotMode() {
  curGameType = 'bot';
  gameSession = { me:0, op:0, round:1, total:3, battle:[], opName:'BOT' };
  notify('Đang chơi với máy!');
  startGame();
}

// ==== PvP demo
function startPvpGame() {
  curGameType = 'pvp';
  gameSession = { me:0, op:0, round:1, total:3, battle:[], opName:'Đối thủ' };
  startGame();
}

// ==== Main game
function startGame() {
  showScreen('game-screen'); renderGame();
  document.querySelectorAll('.choice-btn').forEach(btn=>{
    btn.disabled = false; btn.classList.remove('selected');
    btn.onclick = ()=>playerMove(btn.dataset.choice);
  });
  document.getElementById('btn-leave-game').onclick = ()=>showScreen('main-menu');
  document.getElementById('vs-title').textContent = `Bạn vs ${gameSession.opName}`;
  document.getElementById('round-result-msg').textContent = '';
}
function renderGame() {
  document.getElementById('you-score').textContent = gameSession.me;
  document.getElementById('op-score').textContent = gameSession.op;
  document.getElementById('round-info').textContent = `Ván ${gameSession.round}/${gameSession.total}`;
}
function playerMove(myChoice) {
  document.querySelectorAll('.choice-btn').forEach(btn => {
    btn.classList.toggle('selected', btn.dataset.choice === myChoice);
    btn.disabled = true;
  });
  let opChoice = (curGameType ==='bot')
      ? ['rock','paper','scissors'][Math.random()*3|0]
      : ['rock','paper','scissors'][Math.random()*3|0];
  setTimeout(()=>{ showResult(myChoice, opChoice); }, 600);
}
function showResult(my, op) {
  const map = { rock:'✊', paper:'✋', scissors:'✌️' };
  let result='';
  if(my===op) result='Hòa!';
  else if((my==='rock'&&op==='scissors')||(my==='scissors'&&op==='paper')||(my==='paper'&&op==='rock')) {
    result='Bạn thắng!'; gameSession.me++;
  } else { result='Bạn thua!'; gameSession.op++; }
  gameSession.battle.push({my, op, result});
  document.getElementById('round-result-msg').textContent = `Bạn: ${map[my]}  – ${map[op]}  ${gameSession.opName}: ${result}`;
  renderGame();
  setTimeout(()=>{
    if(gameSession.me > gameSession.total/2 || gameSession.op > gameSession.total/2 || gameSession.round===gameSession.total) {
      showFinalResult();
    } else {
      gameSession.round++;
      renderGame();
      document.getElementById('round-result-msg').textContent='';
      document.querySelectorAll('.choice-btn').forEach(btn=>{ btn.disabled = false; btn.classList.remove('selected'); });
    }
  },1500);
}
function showFinalResult() {
  showScreen('game-result');
  let msg='';
  if(gameSession.me>gameSession.op) msg='🏆 Bạn chiến thắng!';
  else if(gameSession.op>gameSession.me) msg='😢 Thua cuộc!';
  else msg='🤝 Hoà!';
  document.getElementById('game-final-title').textContent = msg;
  document.getElementById('game-final-score').textContent = `Tỷ số: ${gameSession.me} - ${gameSession.op}`;
  let reward='';
  if(gameSession.me>gameSession.op) {
    const point = 30+10*Math.random()|0;
    localUser.point = (localUser.point||0) + point;
    let item = ['Búa vàng','Bao may mắn','Kéo siêu tốc'][Math.random()*3|0];
    rewardInventory.push(item); localUser.items = rewardInventory;
    saveLocalUser(); updateMiniUser();
    reward = `<div>🎁 Nhận <b>${point}</b> điểm & vật phẩm: <span class="item-card">${item}</span></div>`;
  } else {
    reward = `Bạn nhận <b>10 điểm</b> an ủi!`;
    localUser.point = (localUser.point||0)+10; saveLocalUser(); updateMiniUser();
  }
  document.getElementById('reward-list').innerHTML = reward;
  document.getElementById('btn-back-menu').onclick = ()=>showScreen('main-menu');
  document.getElementById('btn-play-again').onclick = ()=>{  if(curGameType==='bot') startBotMode(); else startPvpGame(); };
}

// ==== Hồ sơ cá nhân & Đổi tên ====
function showProfileScreen() {
  showScreen('profile-screen');
  document.getElementById('profile-block').innerHTML = `
    <div><b>Tên:</b> <input type="text" id="input-change-name" maxlength="16" value="${localUser.username || ''}">
      <button id="btn-do-change-name" class="btn-small">Đổi</button>
    </div>
    <div><b>ID:</b> <span id="profile-user-id">${localUser.userId || localUser.id}</span></div>
    <div><b>Điểm:</b> ${localUser.point || 0}</div>
    <div><b>Chế độ:</b> ${localUser.guest ? 'Khách' : 'Thành viên'}</div>
    <div><b>Số vật phẩm:</b> ${(localUser.items || []).length}</div>
  `;
  let itemHtml = '';
  rewardInventory = localUser.items||[];
  for(const item of rewardInventory) { itemHtml += `<span class="item-card">${item}</span>`; }
  document.getElementById('item-inventory').innerHTML = itemHtml || '<span>Chưa có vật phẩm nào!</span>';
  document.getElementById('btn-profile-back').onclick = ()=>showScreen('main-menu');
  document.getElementById('input-change-name').onchange = function(e) {
    localUser.username = this.value.trim().slice(0, 16);
  }
  document.getElementById('btn-do-change-name').onclick = function() {
    localUser.username = document.getElementById('input-change-name').value.trim().slice(0, 16) || localUser.username;
    saveLocalUser(); updateMiniUser();
    notify('Đã đổi tên thành công!');
  };
}

// ==== Start App
window.addEventListener('DOMContentLoaded', ()=>{
  loadLocalUser();
  updateMiniUser();
  initAuth();
  initMenu();
  initRoom();
  document.getElementById('mini-username').addEventListener('click', showProfileScreen);
});

// Đăng ký check:
function validateUsername(username){
  return /^[a-zA-Z0-9]{4,30}$/.test(username);
}
function validateEmail(email){
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
function validatePassword(password){
  return (
    typeof password === 'string'
    && password.length >= 8
    && /[A-Z]/.test(password)
    && /[a-z]/.test(password)
    && /[0-9]/.test(password)
    && /[^A-Za-z0-9]/.test(password)
  );
}

// ...khi user submit:
if(!validateUsername(username)) return showNotify('Tên 4-30 ký tự chữ/số không dấu!');
if(!validateEmail(email)) return showNotify('Email không hợp lệ!');
if(!validatePassword(password)) return showNotify('Mật khẩu mạnh: đủ 8 ký tự, hoa thường số, ký tự đặc biệt!');
