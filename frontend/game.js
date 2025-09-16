// ======== Cài đặt kết nối socket.io backend ===========
const BACKEND_URL = 'https://rps-backend-pm3s.onrender.com'; // <--- Cập nhật đúng backend của bạn!
// const BACKEND_URL = 'http://localhost:3001';

let socket;
let localUser = {}; // user hiện tại (login hoặc guest)
let curRoomId = '';
let curGameType = ''; // 'bot' | 'pvp'
let gameSession = {}; // lưu version hiện tại của trận đấu
let rewardInventory = []; // item nhận được, demo lưu localStorage

// ======== Helper UI ===========
function showScreen(id) {
  for(const s of document.querySelectorAll('.screen')) s.classList.add('hidden');
  document.getElementById(id).classList.remove('hidden');
}
function notify(msg, timeout=2200) {
  const n = document.createElement('div');
  n.className='notify-message'; n.innerHTML=msg;
  document.getElementById('notify').appendChild(n);
  setTimeout(()=>n.remove(), timeout);
}
function updateMiniUser() {
  document.getElementById('mini-username').textContent = localUser?.username ? `👑 ${localUser.username}` : '';
  document.getElementById('mini-point').textContent = typeof localUser.point !== 'undefined' ? `★ ${localUser.point}` : '';
}
function saveLocalUser() {
  window.localStorage.setItem('rps-user', JSON.stringify(localUser));
}
function loadLocalUser() {
  const x = window.localStorage.getItem('rps-user');
  if(x) try { localUser = JSON.parse(x); } catch{} else localUser = {};
  if(!localUser.point) localUser.point = 0;
}

// ======== Đăng ký/Đăng nhập & Guest ===========
function initAuth() {
  showScreen('auth-screen');
  document.getElementById('btn-register').onclick = ()=>{ showScreen('register-screen'); };
  document.getElementById('btn-back-login').onclick = ()=>{ showScreen('auth-screen'); };
  document.getElementById('btn-guest').onclick = ()=>{
    localUser = {
      id: 'guest-'+(Math.random()*1e8|0),
      username: 'Guest'+(Math.random()*1e4|0),
      guest: true,
      point: 0, items:[]
    };
    saveLocalUser(); updateMiniUser();
    showScreen('main-menu'); notify('Chế độ khách! Mọi tiến trình sẽ mất nếu tắt trình duyệt');
  };
  document.getElementById('login-form').onsubmit = function(e) {
    e.preventDefault();
    const u = document.getElementById('login-username').value.trim();
    const p = document.getElementById('login-password').value;
    if(!u) return notify('Tên trống!');
    // fake: demo không backend, bỏ qua truy vấn!
    localUser = { id:'user-'+u, username: u, guest: false, point: 100, items:[] };
    saveLocalUser(); updateMiniUser();
    showScreen('main-menu'); notify('Đăng nhập demo thành công!');
  };
  document.getElementById('register-form').onsubmit = function(e) {
    e.preventDefault();
    const u = document.getElementById('register-username').value.trim();
    const p = document.getElementById('register-password').value;
    if(!u||!p||p.length<4) return notify('Điền đủ tên & mật khẩu tối thiểu 4 ký tự!');
    // fake: chỉ demo!
    localUser = { id:'user-'+u, username: u, guest: false, point: 100, items:[] };
    saveLocalUser(); updateMiniUser();
    showScreen('main-menu'); notify('Đăng ký tài khoản demo!');
  };
  document.getElementById('btn-logout').onclick = ()=>{
    localUser = {}; saveLocalUser(); updateMiniUser();
    showScreen('auth-screen');
  };
}

// ======== Main menu ===========
function initMenu() {
  document.getElementById('btn-start-bot').onclick = startBotMode;
  document.getElementById('btn-create-room').onclick = ()=>showScreen('room-create');
  document.getElementById('btn-room-back').onclick = ()=>showScreen('main-menu');
  document.getElementById('btn-join-room').onclick = ()=>showScreen('room-join');
  document.getElementById('btn-join-back').onclick = ()=>showScreen('main-menu');
  document.getElementById('btn-profile').onclick = showProfileScreen;
}

// ======== Tạo/join phòng PVP ===========
function initRoom() {
  document.getElementById('btn-do-create-room').onclick = ()=>{
    curRoomId = Math.random().toString(36).substr(2,6);
    showScreen('wait-room');
    document.getElementById('roomLinkDisplay').innerHTML = `<b>Link:</b> <input id="auto-link" style="width:90%" readonly value="${window.location.origin+'?room='+curRoomId}" /> <br><b>Mã phòng:</b> <span id="auto-code">${curRoomId}</span>`;
    document.getElementById('btn-copy-link').onclick = function() {
      navigator.clipboard.writeText(window.location.origin+'?room='+curRoomId); notify('Đã copy link!');
    };
    setTimeout(()=>document.getElementById('room-waiting-status').textContent = "Sẵn sàng chơi! (Mô phỏng, không cần real socket)", 2000); // demo!
  };
  document.getElementById('btn-wait-cancel').onclick = ()=>showScreen('main-menu');
  document.getElementById('btn-do-join').onclick = ()=>{
    curRoomId = document.getElementById('join-room-id').value.trim();
    if(!curRoomId) return notify('Nhập mã phòng!');
    notify('Đã vào phòng '+curRoomId+'. Trận đấu demo bắt đầu!');
    startPvpGame();
  };
}

// ======== Game vs BOT ===========
function startBotMode() {
  curGameType = 'bot';
  gameSession = { me:0, op:0, round:1, total:3, battle:[], opName:'BOT' };
  notify('Đang chơi với máy!');
  startGame();
}

// ======== Game PvP demo (không socket) ===========
function startPvpGame() {
  curGameType = 'pvp';
  gameSession = { me:0, op:0, round:1, total:3, battle:[], opName:'Đối thủ' };
  startGame();
}

// ======== GAME MAIN ===========
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
  // Demo: đối thủ random move
  let opChoice = (curGameType ==='bot')
      ? ['rock','paper','scissors'][Math.random()*3|0]
      : ['rock','paper','scissors'][Math.random()*3|0];
  setTimeout(()=>{
    showResult(myChoice, opChoice);
  }, 600);
}

function showResult(my, op) {
  const map = { rock:'✊', paper:'✋', scissors:'✌️' };
  let result='';
  if(my===op) result='Hòa!';
  else if((my==='rock'&&op==='scissors')||(my==='scissors'&&op==='paper')||(my==='paper'&&op==='rock')) {
    result='Bạn thắng!';
    gameSession.me++;
  } else {
    result='Bạn thua!';
    gameSession.op++;
  }
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
    reward = `<div>🎁 Nhận được <b>${point}</b> điểm & vật phẩm: <span class="item-card">${item}</span></div>`;
  } else {
    reward = `Bạn nhận được <b>10 điểm</b> an ủi!`;
    localUser.point = (localUser.point||0)+10; saveLocalUser(); updateMiniUser();
  }
  document.getElementById('reward-list').innerHTML = reward;
  document.getElementById('btn-back-menu').onclick = ()=>showScreen('main-menu');
  document.getElementById('btn-play-again').onclick = ()=>{  // cho phép chơi lại nhanh
    if(curGameType==='bot') startBotMode(); else startPvpGame();
  };
}

// ======== Hồ sơ cá nhân & Item ========
function showProfileScreen() {
  showScreen('profile-screen');
  let block = '';
  block += `<div><b>Tên:</b> ${localUser.username||'Chưa đăng nhập'}</div>`;
  block += `<div><b>Điểm:</b> ${localUser.point||0}</div>`;
  block += `<div><b>Chế độ:</b> ${localUser.guest ? 'Khách' : 'Thành viên'}</div>`;
  block += `<div><b>Số vật phẩm:</b> ${(localUser.items||[]).length}</div>`;
  document.getElementById('profile-block').innerHTML = block;
  let itemHtml = '';
  rewardInventory = localUser.items||[];
  for(const item of rewardInventory) {
    itemHtml += `<span class="item-card">${item}</span>`;
  }
  document.getElementById('item-inventory').innerHTML = itemHtml || '<span>Chưa có vật phẩm nào!</span>';
  document.getElementById('btn-profile-back').onclick = ()=>showScreen('main-menu');
}

// ======== Start App ===========
window.addEventListener('DOMContentLoaded', ()=>{
  loadLocalUser();
  updateMiniUser();
  initAuth();
  initMenu();
  initRoom();
  document.getElementById('mini-username').addEventListener('click', showProfileScreen);
});
