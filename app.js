// =============================================
// Learning Hub - Auth Gate + Main App
// =============================================

// ---- Firebase 初始化 ----
var firebaseConfig = {
  apiKey: "AIzaSyDJRH0W5Lp-16mxDH9eq5Yu4N2WRKfWegM",
  authDomain: "learning-hub-b2fed.firebaseapp.com",
  databaseURL: "https://learning-hub-b2fed-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "learning-hub-b2fed",
  storageBucket: "learning-hub-b2fed.firebasestorage.app",
  messagingSenderId: "581676946196",
  appId: "1:581676946196:web:e72724404a48f9a582a801",
  measurementId: "G-BPEKXYWZLS"
};
firebase.initializeApp(firebaseConfig);
var fbDb = firebase.database();

// ---- 数据库层：读写 Firebase，localStorage 仅做缓存 ----
var DB = {
  get: function(key, fallback) {
    if (fallback === undefined) fallback = [];
    try { return JSON.parse(localStorage.getItem('learnhub_' + key)) || fallback; }
    catch(e) { return fallback; }
  },
  set: function(key, data) {
    localStorage.setItem('learnhub_' + key, JSON.stringify(data));
    // 同步写入 Firebase
    fbDb.ref('learnhub/' + key).set(data);
  }
};

// ---- Auth Gate ----
var AUTH_ANSWER = '薯条';
var AUTH_SESSION_KEY = 'learnhub_authed';

function verifyAnswer() {
  var input = document.getElementById('auth-input');
  var error = document.getElementById('auth-error');
  var card = document.querySelector('.auth-card');
  var answer = input.value.trim();
  if (answer === AUTH_ANSWER) {
    sessionStorage.setItem(AUTH_SESSION_KEY, 'true');
    document.getElementById('auth-gate').classList.add('hidden');
    document.getElementById('app').classList.remove('app-hidden');
    document.getElementById('app').classList.add('app-visible');
    loadFromFirebase();
  } else {
    error.textContent = '❌ 答案不对，再想想？';
    card.classList.remove('shake');
    void card.offsetWidth;
    card.classList.add('shake');
    input.value = '';
    input.focus();
  }
}

document.addEventListener('DOMContentLoaded', function() {
  var authInput = document.getElementById('auth-input');
  if (authInput) {
    authInput.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') verifyAnswer();
    });
  }
  if (sessionStorage.getItem(AUTH_SESSION_KEY) === 'true') {
    document.getElementById('auth-gate').classList.add('hidden');
    document.getElementById('app').classList.remove('app-hidden');
    document.getElementById('app').classList.add('app-visible');
    loadFromFirebase();
  }
});

// ---- 从 Firebase 加载数据，加载完成后才初始化界面 ----
function loadFromFirebase() {
  fbDb.ref('learnhub').once('value').then(function(snapshot) {
    var data = snapshot.val();
    if (data) {
      // Firebase 有数据，用 Firebase 的数据覆盖本地
      if (data.resources) { resources = data.resources; localStorage.setItem('learnhub_resources', JSON.stringify(data.resources)); }
      if (data.checkins)  { checkins  = data.checkins;  localStorage.setItem('learnhub_checkins',  JSON.stringify(data.checkins));  }
      if (data.notes)     { notes     = data.notes;     localStorage.setItem('learnhub_notes',     JSON.stringify(data.notes));     }
    } else {
      // Firebase 是空的，把本地已有数据上传到 Firebase（首次迁移）
      var localResources = DB.get('resources');
      var localCheckins  = DB.get('checkins');
      var localNotes     = DB.get('notes');
      if (localResources.length || localCheckins.length || localNotes.length) {
        fbDb.ref('learnhub').set({
          resources: localResources,
          checkins:  localCheckins,
          notes:     localNotes
        });
        resources = localResources;
        checkins  = localCheckins;
        notes     = localNotes;
      }
    }
    initApp();
    listenForChanges();
  }).catch(function(err) {
    console.warn('Firebase 加载失败，使用本地数据:', err);
    initApp();
  });
}

// ---- 实时监听：别人编辑的内容会自动同步到你这里 ----
function listenForChanges() {
  fbDb.ref('learnhub/resources').on('value', function(snapshot) {
    var data = snapshot.val();
    if (data) {
      resources = data;
      localStorage.setItem('learnhub_resources', JSON.stringify(data));
      renderResources();
      updateFilterTags();
      updateDashboard();
    }
  });
  fbDb.ref('learnhub/checkins').on('value', function(snapshot) {
    var data = snapshot.val();
    if (data) {
      checkins = data;
      localStorage.setItem('learnhub_checkins', JSON.stringify(data));
      renderCalendar();
      renderCheckinLog();
      updateDashboard();
    }
  });
  fbDb.ref('learnhub/notes').on('value', function(snapshot) {
    var data = snapshot.val();
    if (data) {
      notes = data;
      localStorage.setItem('learnhub_notes', JSON.stringify(data));
      renderNotes();
      updateDashboard();
    }
  });
}

// =============================================
// Main Application
// =============================================

var resources = DB.get('resources');
var checkins = DB.get('checkins');
var notes = DB.get('notes');
var currentMonth = new Date();
var editingResourceId = null;
var editingNoteId = null;
var selectedMood = '';
var activeNoteId = null;
var CATEGORIES = ['英语', '西班牙语', 'AI', 'Human Resources', '阅读', '其他'];
var categoryEmoji = { '英语': '🇬🇧', '西班牙语': '🇪🇸', 'AI': '🤖', 'Human Resources': '👥', '阅读': '📖', '其他': '📦' };
var categoryLabel = { '英语': '🇬🇧 English', '西班牙语': '🇪🇸 Español', 'AI': '🤖 AI & Tech', 'Human Resources': '👥 HR & People', '阅读': '📖 Reading', '其他': '📦 Others' };
var categoryClass = { '英语': 'cat-english', '西班牙语': 'cat-spanish', 'AI': 'cat-ai', 'Human Resources': 'cat-hr', '阅读': 'cat-reading', '其他': 'cat-other' };
var categoryBarColor = {
  '英语': 'rgba(96,165,250,0.7)',
  '西班牙语': 'rgba(251,191,36,0.7)',
  'AI': 'rgba(167,139,250,0.7)',
  'Human Resources': 'rgba(52,211,153,0.7)',
  '阅读': 'rgba(244,114,182,0.7)',
  '其他': 'rgba(139,148,158,0.6)'
};

function initApp() {
  seedIfEmpty();
  updateDashboard();
  renderResources();
  renderCalendar();
  renderCheckinLog();
  renderNotes();
  renderHeatmap();
  updateFilterTags();
  document.getElementById('today-date').textContent = formatDate(new Date(), 'full');
  document.getElementById('heatmap-year').textContent = new Date().getFullYear();
}

// ---- Navigation ----
function switchPage(page, el) {
  document.querySelectorAll('.page').forEach(function(p) { p.classList.remove('active'); });
  document.querySelectorAll('.nav-item').forEach(function(n) { n.classList.remove('active'); });
  document.getElementById('page-' + page).classList.add('active');
  el.classList.add('active');
  if (page === 'dashboard') updateDashboard();
  if (page === 'checkin') { renderCalendar(); renderCheckinLog(); }
}

// ---- Toast ----
function showToast(msg, type) {
  if (!type) type = 'success';
  var c = document.querySelector('.toast-container');
  if (!c) { c = document.createElement('div'); c.className = 'toast-container'; document.body.appendChild(c); }
  var t = document.createElement('div');
  t.className = 'toast toast-' + type;
  t.textContent = msg;
  c.appendChild(t);
  setTimeout(function() { t.remove(); }, 2500);
}
function genId() { return Date.now().toString(36) + Math.random().toString(36).substr(2, 5); }
function formatDate(d, mode) {
var date = new Date(d);
if (mode === 'full') {
return date.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });
}
return date.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' });
}
function getDateStr(d) {
if (!d) d = new Date();
var date = new Date(d);
return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
}
function timeAgo(dateStr) {
var diff = Date.now() - new Date(dateStr).getTime();
var mins = Math.floor(diff / 60000);
if (mins < 1) return '刚刚';
if (mins < 60) return mins + '分钟前';
var hrs = Math.floor(mins / 60);
if (hrs < 24) return hrs + '小时前';
var days = Math.floor(hrs / 24);
if (days < 30) return days + '天前';
return Math.floor(days / 30) + '月前';
}
function escapeHtml(str) {
var div = document.createElement('div');
div.textContent = str;
return div.innerHTML;
}
// ---- Dashboard ----
function updateDashboard() {
document.getElementById('stat-resources').textContent = resources.length;
var uniqueDays = [];
var seen = {};
checkins.forEach(function(c) { if (!seen[c.date]) { seen[c.date] = true; uniqueDays.push(c.date); } });
document.getElementById('stat-checkins').textContent = uniqueDays.length;
var streak = calcStreak();
document.getElementById('stat-streak').textContent = streak;
document.getElementById('stat-notes').textContent = notes.length;
document.getElementById('sidebar-streak').textContent = streak;
document.getElementById('checkin-streak-num').textContent = streak;
var todayStr = getDateStr();
var todayChecked = checkins.some(function(c) { return c.date === todayStr; });
var statusEl = document.getElementById('checkin-today-status');
if (todayChecked) {
statusEl.textContent = '✅ 今日已打卡';
statusEl.className = 'checkin-today-status checked';
document.getElementById('checkin-btn').disabled = true;
document.getElementById('checkin-btn').innerHTML = '<span>✅</span> 已打卡';
} else {
statusEl.textContent = '⏳ 今日尚未打卡';
statusEl.className = 'checkin-today-status unchecked';
document.getElementById('checkin-btn').disabled = false;
document.getElementById('checkin-btn').innerHTML = '<span>✅</span> 今日打卡';
}
renderRecentActivity();
renderCategoryBars();
renderHeatmap();
}
function calcStreak() {
var dateSet = {};
checkins.forEach(function(c) { dateSet[c.date] = true; });
var dates = Object.keys(dateSet).sort().reverse();
if (dates.length === 0) return 0;
var streak = 0;
var d = new Date();
var todayStr = getDateStr(d);
if (dates[0] !== todayStr) {
d.setDate(d.getDate() - 1);
if (getDateStr(d) !== dates[0]) return 0;
}
for (var i = 0; i < dates.length; i++) {
var expected = getDateStr(d);
if (dates[i] === expected) {
streak++;
d.setDate(d.getDate() - 1);
} else break;
}
return streak;
}
function renderRecentActivity() {
var activities = [];
resources.forEach(function(r) { activities.push({ text: '添加了资源「' + r.name + '」(' + (categoryLabel[r.category] || r.category) + ')', time: r.createdAt, icon: '🔗' }); });
checkins.forEach(function(c) { activities.push({ text: '完成学习打卡 ' + (c.mood || ''), time: c.createdAt, icon: '✅' }); });
notes.forEach(function(n) { activities.push({ text: '写了笔记「' + n.title + '」', time: n.createdAt, icon: '📝' }); });
activities.sort(function(a, b) { return new Date(b.time) - new Date(a.time); });
var el = document.getElementById('recent-activity');
if (activities.length === 0) {
el.innerHTML = '<div class="empty-state-small">暂无动态，开始学习吧！</div>';
return;
}
el.innerHTML = activities.slice(0, 8).map(function(a) {
return '<div class="activity-item"><span class="activity-icon">' + a.icon + '</span><div class="activity-info"><div class="activity-text">' + a.text + '</div><div class="activity-time">' + timeAgo(a.time) + '</div></div></div>';
}).join('');
}
function renderCategoryBars() {
var counts = {};
resources.forEach(function(r) { counts[r.category] = (counts[r.category] || 0) + 1; });
var el = document.getElementById('platform-bars');
var entries = Object.entries(counts).sort(function(a, b) { return b[1] - a[1]; });
if (entries.length === 0) {
el.innerHTML = '<div class="empty-state-small">添加资源后显示类别分布</div>';
return;
}
var max = Math.max.apply(null, entries.map(function(e) { return e[1]; }));
el.innerHTML = entries.map(function(entry) {
var name = entry[0], count = entry[1];
var pct = Math.round(count / max * 100);
return '<div class="platform-bar-item"><span class="platform-bar-label">' + (categoryLabel[name] || name) + '</span><div class="platform-bar-track"><div class="platform-bar-fill" style="width:' + pct + '%;background:' + (categoryBarColor[name] || 'rgba(167,139,250,0.7)') + '">' + count + '</div></div></div>';
}).join('');
}
// ---- Heatmap ----
function renderHeatmap() {
var el = document.getElementById('heatmap');
var monthsEl = document.getElementById('heatmap-months');
var today = new Date();
var yearStart = new Date(today.getFullYear(), 0, 1);
var dayOfWeek = yearStart.getDay();
var startDate = new Date(yearStart);
startDate.setDate(startDate.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
var dateCounts = {};
checkins.forEach(function(c) { dateCounts[c.date] = (dateCounts[c.date] || 0) + 1; });
notes.forEach(function(n) { var d = getDateStr(new Date(n.createdAt)); dateCounts[d] = (dateCounts[d] || 0) + 1; });
var weeks = [];
var currentDate = new Date(startDate);
var currentWeek = [];
var endDate = new Date(today.getFullYear(), 11, 31);
while (currentDate <= endDate) {
var dateStr = getDateStr(currentDate);
var count = dateCounts[dateStr] || 0;
var level = 0;
if (count >= 4) level = 4;
else if (count >= 3) level = 3;
else if (count >= 2) level = 2;
else if (count >= 1) level = 1;
currentWeek.push({ date: dateStr, level: level, count: count });
if (currentWeek.length === 7) { weeks.push(currentWeek); currentWeek = []; }
currentDate.setDate(currentDate.getDate() + 1);
}
if (currentWeek.length > 0) weeks.push(currentWeek);
el.innerHTML = weeks.map(function(week) {
return '<div class="heatmap-week">' + week.map(function(day) {
return '<div class="heatmap-day level-' + day.level + '" title="' + day.date + ': ' + day.count + '次活动"></div>';
}).join('') + '</div>';
}).join('');
var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
monthsEl.innerHTML = months.map(function(m) { return '<span>' + m + '</span>'; }).join('');
}
// ---- Resources ----
function openResourceModal(id) {
editingResourceId = id || null;
if (id) {
var r = resources.find(function(r) { return r.id === id; });
document.getElementById('res-name').value = r.name;
document.getElementById('res-url').value = r.url;
document.getElementById('res-category').value = r.category;
document.getElementById('res-tags').value = (r.tags || []).join(', ');
document.getElementById('res-note').value = r.note || '';
document.getElementById('resource-modal-title').textContent = '编辑资源';
} else {
document.getElementById('res-name').value = '';
document.getElementById('res-url').value = '';
document.getElementById('res-category').value = '英语';
document.getElementById('res-tags').value = '';
document.getElementById('res-note').value = '';
document.getElementById('resource-modal-title').textContent = '添加学习资源';
}
document.getElementById('resource-modal').classList.add('active');
}
function closeResourceModal() {
document.getElementById('resource-modal').classList.remove('active');
editingResourceId = null;
}
function saveResource() {
var name = document.getElementById('res-name').value.trim();
var url = document.getElementById('res-url').value.trim();
var category = document.getElementById('res-category').value;
var tagsStr = document.getElementById('res-tags').value.trim();
var note = document.getElementById('res-note').value.trim();
if (!name || !url) { showToast('请填写资源名称和链接', 'error'); return; }
var tags = tagsStr ? tagsStr.split(/[,，]/).map(function(t) { return t.trim(); }).filter(Boolean) : [];
if (editingResourceId) {
var idx = resources.findIndex(function(r) { return r.id === editingResourceId; });
resources[idx] = Object.assign({}, resources[idx], { name: name, url: url, category: category, tags: tags, note: note, updatedAt: new Date().toISOString() });
showToast('资源已更新');
} else {
resources.push({ id: genId(), name: name, url: url, category: category, tags: tags, note: note, createdAt: new Date().toISOString() });
showToast('资源已添加');
}
DB.set('resources', resources);
closeResourceModal();
renderResources();
updateFilterTags();
updateDashboard();
}
function deleteResource(id) {
if (!confirm('确定删除该资源？')) return;
resources = resources.filter(function(r) { return r.id !== id; });
DB.set('resources', resources);
renderResources();
updateFilterTags();
updateDashboard();
showToast('资源已删除');
}
function renderResources(filter, search) {
if (!filter) filter = 'all';
if (!search) search = '';
var el = document.getElementById('resources-grid');
var filtered = resources;
if (filter !== 'all') filtered = filtered.filter(function(r) { return r.category === filter; });
if (search) {
var q = search.toLowerCase();
filtered = filtered.filter(function(r) {
return r.name.toLowerCase().includes(q) || (r.note || '').toLowerCase().includes(q) || (r.tags || []).some(function(t) { return t.toLowerCase().includes(q); });
});
}
if (filtered.length === 0) {
el.innerHTML = '<div class="empty-state"><div class="empty-icon">📭</div><h3>' + (resources.length === 0 ? '还没有学习资源' : '没有找到匹配的资源') + '</h3><p>' + (resources.length === 0 ? '点击「添加资源」开始聚合你的学习内容' : '试试其他关键词') + '</p></div>';
return;
}
filtered.sort(function(a, b) { return new Date(b.createdAt) - new Date(a.createdAt); });
el.innerHTML = filtered.map(function(r) {
return '<div class="resource-card">' +
'<div class="resource-header"><div class="resource-name">' + escapeHtml(r.name) + '</div><div class="resource-actions"><button class="action-btn" onclick="openResourceModal(\'' + r.id + '\')" title="编辑">✏️</button><button class="action-btn delete" onclick="deleteResource(\'' + r.id + '\')" title="删除">🗑</button></div></div>' +
'<div class="resource-platform ' + (categoryClass[r.category] || 'cat-other') + '">' + (categoryEmoji[r.category] || '📦') + ' ' + r.category + '</div>' +
'<a href="' + escapeHtml(r.url) + '" target="_blank" class="resource-url">' + escapeHtml(r.url) + '</a>' +
(r.note ? '<div class="resource-note">' + escapeHtml(r.note) + '</div>' : '') +
(r.tags && r.tags.length ? '<div class="resource-tags">' + r.tags.map(function(t) { return '<span class="resource-tag">' + escapeHtml(t) + '</span>'; }).join('') + '</div>' : '') +
'<div class="resource-date">添加于 ' + timeAgo(r.createdAt) + '</div>' +
'</div>';
}).join('');
}
var currentCategoryFilter = 'all';
function filterResources() {
var search = document.getElementById('resource-search').value;
renderResources(currentCategoryFilter, search);
}
function filterByCategory(category, el) {
currentCategoryFilter = category;
document.querySelectorAll('.filter-tags .tag-btn').forEach(function(b) { b.classList.remove('active'); });
el.classList.add('active');
filterResources();
}
function updateFilterTags() {
var catsSet = {};
resources.forEach(function(r) { catsSet[r.category] = true; });
var cats = Object.keys(catsSet);
var el = document.getElementById('filter-tags');
el.innerHTML = '<button class="tag-btn active" onclick="filterByCategory(\'all\', this)">全部</button>' +
cats.map(function(c) { return '<button class="tag-btn" onclick="filterByCategory(\'' + c + '\', this)">' + (categoryLabel[c] || c) + '</button>'; }).join('');
}
// ---- Check-in ----
function doCheckin() {
var todayStr = getDateStr();
if (checkins.some(function(c) { return c.date === todayStr; })) { showToast('今天已经打过卡了', 'error'); return; }
selectedMood = '';
document.getElementById('checkin-content').value = '';
document.getElementById('checkin-duration').value = '';
document.querySelectorAll('.mood-btn').forEach(function(b) { b.classList.remove('selected'); });
document.getElementById('checkin-city').value = '';
document.getElementById('checkin-modal').classList.add('active');
}
function selectMood(mood, el) {
selectedMood = mood;
document.querySelectorAll('.mood-btn').forEach(function(b) { b.classList.remove('selected'); });
el.classList.add('selected');
}
function closeCheckinModal() { document.getElementById('checkin-modal').classList.remove('active'); }
function confirmCheckin() {
var content = document.getElementById('checkin-content').value.trim();
var duration = parseInt(document.getElementById('checkin-duration').value) || 0;
var city = document.getElementById('checkin-city').value.trim();
checkins.push({ id: genId(), date: getDateStr(), content: content, duration: duration, mood: selectedMood, city: city, createdAt: new Date().toISOString() });
DB.set('checkins', checkins);
closeCheckinModal();
renderCalendar();
renderCheckinLog();
updateDashboard();
showToast('🎉 打卡成功！' + selectedMood);
}
function renderCalendar() {
var el = document.getElementById('calendar-grid');
var label = document.getElementById('calendar-month-label');
var year = currentMonth.getFullYear();
var month = currentMonth.getMonth();
label.textContent = year + '年' + (month + 1) + '月';
var firstDay = new Date(year, month, 1);
var lastDay = new Date(year, month + 1, 0);
var startDay = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;
var checkedDates = {};
checkins.forEach(function(c) { checkedDates[c.date] = true; });
var todayStr = getDateStr();
var headers = ['一','二','三','四','五','六','日'];
var html = headers.map(function(h) { return '<div class="calendar-header-cell">' + h + '</div>'; }).join('');
var prevMonth = new Date(year, month, 0);
for (var i = startDay - 1; i >= 0; i--) {
html += '<div class="calendar-day other-month">' + (prevMonth.getDate() - i) + '</div>';
}
for (var d = 1; d <= lastDay.getDate(); d++) {
var dateStr = year + '-' + String(month + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
var classes = ['calendar-day'];
if (dateStr === todayStr) classes.push('today');
if (checkedDates[dateStr]) classes.push('checked');
html += '<div class="' + classes.join(' ') + '">' + d + '</div>';
}
var remaining = 42 - (startDay + lastDay.getDate());
for (var d2 = 1; d2 <= remaining; d2++) {
html += '<div class="calendar-day other-month">' + d2 + '</div>';
}
el.innerHTML = html;
}
function changeMonth(delta) { currentMonth.setMonth(currentMonth.getMonth() + delta); renderCalendar(); }
function renderCheckinLog() {
var el = document.getElementById('checkin-log');
var sorted = checkins.slice().sort(function(a, b) { return new Date(b.createdAt) - new Date(a.createdAt); });
if (sorted.length === 0) { el.innerHTML = '<div class="empty-state-small">暂无打卡记录</div>'; return; }
el.innerHTML = sorted.map(function(c) {
return '<div class="checkin-log-item"><div class="checkin-log-date">' + c.date + '</div><div class="checkin-log-content">' + escapeHtml(c.content || '无备注') + '</div><div class="checkin-log-meta">' + (c.city ? '📍 ' + escapeHtml(c.city) + ' ' : '') + (c.duration ? '⏱ ' + c.duration + 'min ' : '') + (c.mood || '') + '</div></div>';
}).join('');
}
// ---- Notes ----
function openNoteModal(id) {
editingNoteId = id || null;
updateNoteResourceSelect();
if (id) {
var n = notes.find(function(n) { return n.id === id; });
document.getElementById('note-title').value = n.title;
document.getElementById('note-resource').value = n.resourceId || '';
document.getElementById('note-tags').value = (n.tags || []).join(', ');
document.getElementById('note-content').value = n.content;
document.getElementById('note-modal-title').textContent = '编辑笔记';
} else {
document.getElementById('note-title').value = '';
document.getElementById('note-resource').value = '';
document.getElementById('note-tags').value = '';
document.getElementById('note-content').value = '';
document.getElementById('note-modal-title').textContent = '新建笔记';
}
document.getElementById('note-modal').classList.add('active');
}
function closeNoteModal() { document.getElementById('note-modal').classList.remove('active'); editingNoteId = null; }
function updateNoteResourceSelect() {
var sel = document.getElementById('note-resource');
sel.innerHTML = '<option value="">无关联</option>' +
resources.map(function(r) { return '<option value="' + r.id + '">' + escapeHtml(r.name) + '</option>'; }).join('');
}
function saveNote() {
var title = document.getElementById('note-title').value.trim();
var content = document.getElementById('note-content').value.trim();
var resourceId = document.getElementById('note-resource').value;
var tagsStr = document.getElementById('note-tags').value.trim();
if (!title || !content) { showToast('请填写标题和内容', 'error'); return; }
var tags = tagsStr ? tagsStr.split(/[,，]/).map(function(t) { return t.trim(); }).filter(Boolean) : [];
if (editingNoteId) {
var idx = notes.findIndex(function(n) { return n.id === editingNoteId; });
notes[idx] = Object.assign({}, notes[idx], { title: title, content: content, resourceId: resourceId, tags: tags, updatedAt: new Date().toISOString() });
showToast('笔记已更新');
} else {
notes.push({ id: genId(), title: title, content: content, resourceId: resourceId, tags: tags, createdAt: new Date().toISOString() });
showToast('笔记已保存');
}
DB.set('notes', notes);
closeNoteModal();
renderNotes();
updateDashboard();
if (activeNoteId || editingNoteId) showNotePreview(editingNoteId || notes[notes.length - 1].id);
}
function deleteNote(id) {
if (!confirm('确定删除该笔记？')) return;
notes = notes.filter(function(n) { return n.id !== id; });
DB.set('notes', notes);
renderNotes();
updateDashboard();
document.getElementById('note-preview').innerHTML = '<div class="empty-state"><div class="empty-icon">👈</div><h3>选择一个笔记查看</h3></div>';
showToast('笔记已删除');
}
function renderNotes() {
var el = document.getElementById('notes-list');
if (notes.length === 0) {
el.innerHTML = '<div class="empty-state"><div class="empty-icon">📝</div><h3>还没有笔记</h3><p>点击「新建笔记」记录你的学习心得</p></div>';
return;
}
var sorted = notes.slice().sort(function(a, b) { return new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt); });
el.innerHTML = sorted.map(function(n) {
var resource = resources.find(function(r) { return r.id === n.resourceId; });
return '<div class="note-card ' + (activeNoteId === n.id ? 'active' : '') + '" onclick="showNotePreview(\'' + n.id + '\')">' +
'<div class="note-card-title">' + escapeHtml(n.title) + '</div>' +
'<div class="note-card-meta"><span>' + timeAgo(n.updatedAt || n.createdAt) + '</span>' + (resource ? '<span>📎 ' + escapeHtml(resource.name) + '</span>' : '') + '</div>' +
'<div class="note-card-preview">' + escapeHtml(n.content.substring(0, 100)) + '</div>' +
(n.tags && n.tags.length ? '<div class="note-card-tags">' + n.tags.map(function(t) { return '<span class="resource-tag">' + escapeHtml(t) + '</span>'; }).join('') + '</div>' : '') +
'</div>';
}).join('');
}
function showNotePreview(id) {
activeNoteId = id;
var n = notes.find(function(n) { return n.id === id; });
if (!n) return;
var resource = resources.find(function(r) { return r.id === n.resourceId; });
var el = document.getElementById('note-preview');
el.innerHTML =
'<div class="note-preview-header">' +
'<div class="note-preview-title">' + escapeHtml(n.title) + '</div>' +
'<div class="note-preview-meta">' +
'<span>📅 ' + new Date(n.createdAt).toLocaleDateString('zh-CN') + '</span>' +
(n.updatedAt ? '<span>✏️ 更新于 ' + timeAgo(n.updatedAt) + '</span>' : '') +
(resource ? '<span>📎 <a href="' + escapeHtml(resource.url) + '" target="_blank" style="color:var(--accent-blue)">' + escapeHtml(resource.name) + '</a></span>' : '') +
(n.tags && n.tags.length ? '<span>🏷 ' + n.tags.join(', ') + '</span>' : '') +
'</div></div>' +
'<div class="note-preview-content">' + renderMarkdown(n.content) + '</div>' +
'<div class="note-preview-actions">' +
'<button class="btn btn-ghost btn-sm" onclick="openNoteModal(\'' + n.id + '\')">✏️ 编辑</button>' +
'<button class="btn btn-danger btn-sm" onclick="deleteNote(\'' + n.id + '\')">🗑 删除</button>' +
'</div>';
renderNotes();
}
function renderMarkdown(text) {
var html = escapeHtml(text);
html = html.replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>');
html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');
html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
html = html.replace(/^&gt; (.+)$/gm, '<blockquote>$1</blockquote>');
html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
html = html.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>');
html = html.replace(/\n\n/g, '</p><p>');
html = html.replace(/\n/g, '<br>');
html = '<p>' + html + '</p>';
html = html.replace(/<p><\/p>/g, '');
html = html.replace(/<p>(<h[123]>)/g, '$1');
html = html.replace(/(<\/h[123]>)<\/p>/g, '$1');
html = html.replace(/<p>(<pre>)/g, '$1');
html = html.replace(/(<\/pre>)<\/p>/g, '$1');
html = html.replace(/<p>(<blockquote>)/g, '$1');
html = html.replace(/(<\/blockquote>)<\/p>/g, '$1');
html = html.replace(/<p>(<ul>)/g, '$1');
html = html.replace(/(<\/ul>)<\/p>/g, '$1');
return html;
}
// ---- Seed demo data ----
function seedIfEmpty() {
// No demo data - start fresh
}