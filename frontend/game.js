// ==== CONFIG BACKEND ====
const BACKEND_URL = 'https://rps-backend-pm3s.onrender.com'; // Sửa đúng backend của bạn nếu khác!

// ==== VALIDATORS ==== //
function validateUsername(username) {
  return /^[a-zA-Z0-9]{4,30}$/.test(username);
}
function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
function validatePassword(password) {
  return (
    typeof password === 'string'
    && password.length >= 8
    && /[A-Z]/.test(password)
    && /[a-z]/.test(password)
    && /[0-9]/.test(password)
    && /[^A-Za-z0-9]/.test(password)
  );
}
function notify(msg, timeout=2000) {
  const n = document.createElement('div');
  n.className='notify-message'; n.innerHTML=msg;
  document.getElementById('notify').appendChild(n);
  setTimeout(()=>n.remove(), timeout);
}

// ==== localUser LƯU GLOBALLY TRÊN window (không bao giờ ghi đè bằng let/const localUser) ==== //
window.localUser = {}; // luôn dùng window.localUser

function saveLocalUser() {
  if (window.localUser.guest) sessionStorage.setItem('rps-user', JSON.stringify(window.localUser));
  else localStorage.setItem('rps-user', JSON.stringify(window.localUser));
}
function loadLocalUser() {
  let x = sessionStorage.getItem('rps-user') || localStorage.getItem('rps-user');
  if(x) try {window.localUser = JSON.parse(x);} catch{window.localUser = {};}
  if(!window.localUser || typeof window.localUser !== 'object') window.localUser = {};
  if(typeof window.localUser.point !== 'number') window.localUser.point = 0;
  if(!window.localUser.username) window.localUser.username = '';
  if(!window.localUser.items) window.localUser.items = [];
}
function updateMiniUser() {
  let text = window.localUser?.username ? `👑 ${window.localUser.username}` : '';
  if(window.localUser.avatar) text = `<img src="${window.localUser.avatar}" style="width:27px;border-radius:36px;vertical-align:middle"> ${window.localUser.username}`;
  document.getElementById('mini-username').innerHTML = text;
  document.getElementById('mini-point').textContent = (typeof window.localUser.point === 'number') ? `★ ${window.localUser.point}` : '';
  // Nút đăng xuất chỉ hiện khi user đã login (không phải guest và phải có username thực)
  const showLogout = window.localUser && !window.localUser.guest && !!window.localUser.username;
  document.getElementById('btn-logout').classList.toggle('hidden', !showLogout);
}

// ==== APIs kết nối backend ==== //
async function registerUser(username, email, password) {
  try {
    const res = await fetch(BACKEND_URL + '/api/auth/register', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ username, email, password })
    });
    const data = await res.json();
    if(data.error) return notify(data.error), false;
    notify('Đăng ký thành công!');
    return true;
  } catch (e) { notify('Có lỗi server!'); return false; }
}
async function loginUser(username, password) {
  const res = await fetch(BACKEND_URL + '/api/auth/login', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({ username, password })
  });
  const data = await res.json();
  if (data.error) { notify(data.error); return false; }
  // Lưu ĐẦY ĐỦ user info vào window.localUser
  window.localUser = {
    id: data.id || data._id || '',
    username: data.username || '',
    point: (typeof data.point === 'number') ? data.point : 0,
    guest: false,
    avatar: data.avatar || '',
    items: data.items || [],
    token: data.token
  };
  saveLocalUser();
  updateMiniUser();
  connectSocket();
  return true;
}
async function changeUsername(newName) {
  const token = window.localUser.token;
  const res = await fetch(BACKEND_URL + '/api/user/change-name', {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({token, newName})
  });
  const data = await res.json();
  if(data.error) return notify(data.error);
  window.localUser.username = newName;
  saveLocalUser();
  updateMiniUser();
  notify('Đổi tên thành công!');
  document.getElementById('input-change-name').value = window.localUser.username;
}
async function changeAvatar(newAvatarUrl) {
  const token = window.localUser.token;
  const res = await fetch(BACKEND_URL + '/api/auth/avatar', {
    method: 'POST',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ token, avatar: newAvatarUrl })
  });
  const data = await res.json();
  if(data.error) return notify(data.error);
  window.localUser.avatar = newAvatarUrl;
  saveLocalUser(); 
  updateMiniUser();
  notify('Đổi avatar thành công!');
}

// ==== Socket.io trạng thái online ==== //
let socket = null;
function connectSocket() {
  if (!window.localUser?.id) return;
  if (window.socket) window.socket.disconnect();
  window.socket = io(BACKEND_URL, {transports:['websocket','polling']});
  socket = window.socket;
  socket.emit('user-online', { userId: window.localUser.id });
  window.addEventListener('beforeunload', ()=>{
    socket.emit('user-offline', { userId: window.localUser.id });
  });
}

// ==== Đăng ký / Đăng nhập / Guest ==== //
function initAuth() {
  showScreen('auth-screen');
  document.getElementById('btn-register').onclick = ()=> showScreen('register-screen');
  document.getElementById('btn-back-login').onclick = ()=> showScreen('auth-screen');
  document.getElementById('btn-guest').onclick = ()=>{
    window.localUser = { id:'guest'+(Math.random()*1e5|0), username: 'Guest'+(Math.random()*1e4|0), guest: true, point: 0, items: [] };
    saveLocalUser(); updateMiniUser();
    showScreen('main-menu');
    notify('Chơi với tư cách khách (tạm thời)');
  };
  document.getElementById('login-form').onsubmit = async function(e) {
    e.preventDefault();
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value;
    if(!validateUsername(username)) return notify('Tên phải 4-30 ký tự, chỉ chữ/số!');
    if(!validatePassword(password)) return notify('Mật khẩu chưa đủ mạnh!');
    const ok = await loginUser(username, password);
    if(ok) {
      showScreen('main-menu'); 
      updateMiniUser();
    }
  };
  document.getElementById('register-form').onsubmit = async function(e) {
    e.preventDefault();
    const username = document.getElementById('register-username').value.trim();
    const email = document.getElementById('register-email').value.trim();
    const password = document.getElementById('register-password').value;
    if(!validateUsername(username)) return notify('Tên phải từ 4-30 ký tự, chỉ chữ số!');
    if(!validateEmail(email)) return notify('Email không hợp lệ!');
    if(!validatePassword(password)) return notify('Mật khẩu yếu: tối thiểu 8 ký tự, hoa, thường, số và ký tự đặc biệt!');
    const ok = await registerUser(username, email, password);
    if (ok) showScreen('auth-screen');
  };
  document.getElementById('btn-logout').onclick = ()=>{
    if(window.localUser.guest) sessionStorage.removeItem('rps-user');
    else localStorage.removeItem('rps-user');
    window.localUser = {}; updateMiniUser();
    showScreen('auth-screen');
  };
}

// ==== Main menu, Profile, Avatar ==== //
function initMenu() {
  document.getElementById('btn-start-bot').onclick = startBotMode;
  document.getElementById('btn-create-room').onclick = ()=>showScreen('room-create');
  document.getElementById('btn-room-back').onclick = ()=>showScreen('main-menu');
  document.getElementById('btn-join-room').onclick = ()=>showScreen('room-join');
  document.getElementById('btn-join-back').onclick = ()=>showScreen('main-menu');
  document.getElementById('btn-profile').onclick = showProfileScreen;
}

// ==== Đổi tên, avatar ==== //
function showProfileScreen() {
  showScreen('profile-screen');
  // lấy đúng window.localUser và không tạo biến cục bộ nào localUser ở đây!
  const u = window.localUser;
  console.log("===> Show Profile", u);
  document.getElementById('profile-block').innerHTML = `
    <div>
      <b>Tên:</b> 
      <input type="text" id="input-change-name" maxlength="30" minlength="4" value="${u.username || ''}">
      <button id="btn-do-change-name" class="btn-small">Đổi</button>
    </div>
    <div><b>ID:</b> <span id="profile-user-id">${u.id || ''}</span></div>
    <div><b>Điểm:</b> ${typeof u.point === 'number' ? u.point : 0}</div>
    <div><b>Chế độ:</b> ${u.guest ? 'Khách' : 'Thành viên'}</div>
    <div><b>Số vật phẩm:</b> ${(u.items || []).length}</div>
  `;
  let itemHtml = '', rewardInventory = u.items||[];
  for(const item of rewardInventory) itemHtml += `<span class="item-card">${item}</span>`;
  document.getElementById('item-inventory').innerHTML = itemHtml || '<span>Chưa có vật phẩm nào!</span>';
  document.getElementById('btn-profile-back').onclick = ()=>showScreen('main-menu');

  document.getElementById('btn-do-change-name').onclick = async function() {
    const newName = document.getElementById('input-change-name').value.trim();
    if (!validateUsername(newName)) return notify('Tên: 4-30 ký tự và chỉ chữ số!');
    await changeUsername(newName);
    document.getElementById('input-change-name').value = window.localUser.username;
  };
  document.getElementById('btn-upload-avatar').onclick = async function() {
    const url = document.getElementById('input-avatar-url').value.trim();
    if (!/^https?:\/\//.test(url)) return notify('Phải là URL ảnh hợp lệ!');
    await changeAvatar(url);
    document.getElementById('input-avatar-url').value = '';
  };
}

// ==== GAME LOGIC (DEMO) ==== //
let curGameType = '', gameSession = {}, curRoomId = '', rewardInventory = [];
function startBotMode() {
  curGameType = 'bot';
  gameSession = { me:0, op:0, round:1, total:3, battle:[], opName:'BOT' };
  notify('Đang chơi với máy!');
  startGame();
}
function startPvpGame() {
  curGameType = 'pvp';
  gameSession = { me:0, op:0, round:1, total:3, battle:[], opName:'Đối thủ' };
  startGame();
}
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
    window.localUser.point = (window.localUser.point||0) + point;
    let item = ['Búa vàng','Bao may mắn','Kéo siêu tốc'][Math.random()*3|0];
    rewardInventory.push(item); window.localUser.items = rewardInventory;
    saveLocalUser(); updateMiniUser();
    reward = `<div>🎁 Nhận <b>${point}</b> điểm & vật phẩm: <span class="item-card">${item}</span></div>`;
  } else {
    reward = `Bạn nhận <b>10 điểm</b> an ủi!`;
    window.localUser.point = (window.localUser.point||0)+10; saveLocalUser(); updateMiniUser();
  }
  document.getElementById('reward-list').innerHTML = reward;
  document.getElementById('btn-back-menu').onclick = ()=>showScreen('main-menu');
  document.getElementById('btn-play-again').onclick = ()=>{  if(curGameType==='bot') startBotMode(); else startPvpGame(); };
}

// ==== KHỞI ĐỘNG APP ==== //
window.addEventListener('DOMContentLoaded', ()=>{
  loadLocalUser();
  updateMiniUser();
  initAuth();
  initMenu();
  document.getElementById('mini-username').addEventListener('click', showProfileScreen);
});

// ==== Google Sign-In callback (nếu không dùng xóa đi) ==== //
//window.onGoogleSignIn = function(){};
function showScreen(id) {
  for(const s of document.querySelectorAll('.screen')) s.classList.add('hidden');
  document.getElementById(id).classList.remove('hidden');
}

