const BACKEND_URL = 'https://rps-backend-pm3s.onrender.com'; // Thay đúng backend bạn deploy

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
function notify(msg, timeout=2400) {
  const n = document.createElement('div');
  n.className='notify-message'; n.innerHTML=msg;
  document.getElementById('notify').appendChild(n);
  setTimeout(()=>n.remove(), timeout);
}

//==== APIs để call backend ===//
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
  localStorage.setItem('rps-token', data.token);
  window.localUser = {
    id: data.id, username: data.username, point: data.point, guest: false,
    avatar: data.avatar || '', token: data.token
  };
  saveLocalUser();
  updateMiniUser();
  connectSocket();
  return true;
}
async function changeUsername(newName) {
  const token = localStorage.getItem('rps-token');
  const res = await fetch(BACKEND_URL + '/api/user/change-name', {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({token, newName})
  });
  const data = await res.json();
  if(data.error) return notify(data.error);
  localUser.username = newName;
  saveLocalUser();
  updateMiniUser();
  notify('Đổi tên thành công!');
}
async function changeAvatar(newAvatarUrl) {
  const token = localStorage.getItem('rps-token');
  const res = await fetch(BACKEND_URL + '/api/auth/avatar', {
    method: 'POST',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ token, avatar: newAvatarUrl })
  });
  const data = await res.json();
  if(data.error) return notify(data.error);
  window.localUser.avatar = newAvatarUrl;
  saveLocalUser(); updateMiniUser();
  notify('Đổi avatar thành công!');
}

// ==== User trạng thái ==== //
function saveLocalUser() {
  if(localUser.guest) sessionStorage.setItem('rps-user', JSON.stringify(localUser));
  else localStorage.setItem('rps-user', JSON.stringify(localUser));
}
function loadLocalUser() {
  let x = sessionStorage.getItem('rps-user') || localStorage.getItem('rps-user');
  if(x) try {localUser = JSON.parse(x);} catch{} else localUser = {};
  if(!localUser.point) localUser.point = 0;
  if(!localUser.username) localUser.username = '';
}
function updateMiniUser() {
  let text = localUser?.username ? `👑 ${localUser.username}` : '';
  if(localUser.avatar) text = `<img src="${localUser.avatar}" style="width:27px;border-radius:36px;vertical-align:middle"> ${localUser.username}`;
  document.getElementById('mini-username').innerHTML = text;
  document.getElementById('mini-point').textContent = typeof localUser.point !== 'undefined' ? `★ ${localUser.point}` : '';
  document.getElementById('btn-logout').classList.toggle('hidden', localUser.guest);
}

// ==== Socket.io trạng thái online ==== //
function connectSocket() {
  if (!window.localUser?.id) return;
  if (window.socket) window.socket.disconnect();
  window.socket = io(BACKEND_URL, {transports:['websocket','polling']});
  socket = window.socket;
  socket.emit('user-online', { userId: localUser.id });
  window.addEventListener('beforeunload', ()=>{
    socket.emit('user-offline', { userId: localUser.id });
  });
}

// ==== Đăng ký / Đăng nhập / Guest ==== //
function initAuth() {
  showScreen('auth-screen');
  document.getElementById('btn-register').onclick = ()=> showScreen('register-screen');
  document.getElementById('btn-back-login').onclick = ()=> showScreen('auth-screen');
  document.getElementById('btn-guest').onclick = ()=>{
    localUser = { id:'guest'+(Math.random()*1e5|0), username: 'Guest'+(Math.random()*1e4|0), guest: true, point: 0, items: [] };
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
    if(ok) showScreen('main-menu');
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
    if(localUser.guest) sessionStorage.removeItem('rps-user');
    else localStorage.removeItem('rps-user');
    localUser = {}; updateMiniUser();
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

// ==== Đổi tên/Avatar ==== //
function showProfileScreen() {
  showScreen('profile-screen');
  document.getElementById('profile-block').innerHTML = `
    <div>
      <b>Tên:</b> 
      <input type="text" id="input-change-name" maxlength="30" minlength="4" value="${localUser.username || ''}">
      <button id="btn-do-change-name" class="btn-small">Đổi</button>
    </div>
    <div><b>ID:</b> <span id="profile-user-id">${localUser.id || ''}</span></div>
    <div><b>Điểm:</b> ${localUser.point || 0}</div>
    <div><b>Chế độ:</b> ${localUser.guest ? 'Khách' : 'Thành viên'}</div>
    <div><b>Số vật phẩm:</b> ${(localUser.items || []).length}</div>
  `;
  let itemHtml = '', rewardInventory = localUser.items||[];
  for(const item of rewardInventory) itemHtml += `<span class="item-card">${item}</span>`;
  document.getElementById('item-inventory').innerHTML = itemHtml || '<span>Chưa có vật phẩm nào!</span>';
  document.getElementById('btn-profile-back').onclick = ()=>showScreen('main-menu');

  document.getElementById('btn-do-change-name').onclick = async function() {
    const newName = document.getElementById('input-change-name').value.trim();
    if (!validateUsername(newName)) return notify('Tên: 4-30 ký tự và chỉ chữ số!');
    await changeUsername(newName);
    document.getElementById('input-change-name').value = localUser.username;
  };
  document.getElementById('btn-upload-avatar').onclick = async function() {
    const url = document.getElementById('input-avatar-url').value.trim();
    if (!/^https?:\/\//.test(url)) return notify('Phải là URL ảnh hợp lệ!');
    await changeAvatar(url);
    document.getElementById('input-avatar-url').value = '';
  };
}

// ==== Các phần chơi game, tạo phòng, PvP, Reward... giữ logic cũ như bản trước ==== //
// ... Bạn giữ nguyên mã startBotMode, startPvpGame, startGame, renderGame, playerMove ... như phiên bản đã gửi trước.

window.addEventListener('DOMContentLoaded', ()=>{
  loadLocalUser();
  updateMiniUser();
  initAuth();
  initMenu();
  // ... các sự kiện khởi tạo phòng, game còn lại ...
  document.getElementById('mini-username').addEventListener('click', showProfileScreen);
});
