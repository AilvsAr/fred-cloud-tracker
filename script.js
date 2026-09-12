// =========================================
// 1. CONFIGURACIÓN DE FIREBASE 
// =========================================
const firebaseConfig = {
    apiKey: "AIzaSyDNvFQ8lnaGYmq8zZjaC-ZsfhBG4eYjNJg",
    authDomain: "fred-nexus-project.firebaseapp.com",
    projectId: "fred-nexus-project",
    storageBucket: "fred-nexus-project.firebasestorage.app",
    messagingSenderId: "298516398794",
    appId: "1:298516398794:web:e42b0dd02d65d29fd3aa33"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// =========================================
// 2. STATE MANAGEMENT & GLOBALS
// =========================================
let currentUser = null;
let projects = [];
let logs = [];
let todos = []; 
let userProfile = { name: '弗雷德', title: 'Fred Jitterbet ✨', picUrl: '' };
let tempProfilePicBase64 = ''; // Variable para almacenar la imagen temporalmente

let activeTimer = JSON.parse(localStorage.getItem('fred_cloud_active')) || null;
let timerInterval = null;
let nextAlertSecs = 1800; // 30 minutos

const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
function playCutePop() {
    if(audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain); gain.connect(audioCtx.destination);
    osc.type = 'sine'; osc.frequency.setValueAtTime(600, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1200, audioCtx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
    osc.start(); osc.stop(audioCtx.currentTime + 0.1);
}

function playCelebrationSound() {
    if(audioCtx.state === 'suspended') audioCtx.resume();
    const notes = [523.25, 659.25, 783.99, 1046.50, 1318.51, 1567.98]; // C5, E5, G5, C6, E6, G6
    notes.forEach((freq, i) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.type = 'sine';
        osc.frequency.value = freq;
        const startTime = audioCtx.currentTime + (i * 0.08);
        gain.gain.setValueAtTime(0, startTime);
        gain.gain.linearRampToValueAtTime(0.1, startTime + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.4);
        osc.start(startTime);
        osc.stop(startTime + 0.4);
    });
}

function applyTheme(themeName) {
    document.body.setAttribute('data-theme', themeName);
    localStorage.setItem('fred_theme', themeName);
    document.querySelectorAll('.theme-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.theme === themeName);
    });
}

// =========================================
// 4. AUTHENTICATION LOGIC 
// =========================================
auth.onAuthStateChanged(async (user) => {
    if (user) {
        currentUser = user;
        document.getElementById('loginOverlay').style.display = 'none';
        await loadCloudData();
        initApp();
    } else {
        currentUser = null;
        document.getElementById('loginOverlay').style.display = 'flex';
    }
});

document.getElementById('btnLoginGoogle').addEventListener('click', () => {
    playCutePop();
    const provider = new firebase.auth.GoogleAuthProvider();
    auth.signInWithPopup(provider).catch(err => alert("登录错误 (Login Error): " + err.message));
});

document.getElementById('btnLogout').addEventListener('click', () => {
    playCutePop();
    auth.signOut();
    projects = []; logs = []; todos = []; activeTimer = null;
    localStorage.removeItem('fred_cloud_active');
    stopAllFocusSounds();
});

// =========================================
// 5. CLOUD DATA SYNC
// =========================================
async function loadCloudData() {
    try {
        const userDoc = await db.collection('users').doc(currentUser.uid).get();
        if(userDoc.exists && userDoc.data().profile) {
            userProfile = userDoc.data().profile;
        }

        const pSnap = await db.collection('users').doc(currentUser.uid).collection('projects').get();
        projects = pSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        const lSnap = await db.collection('users').doc(currentUser.uid).collection('logs').orderBy('start', 'desc').get();
        logs = lSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        const tSnap = await db.collection('users').doc(currentUser.uid).collection('todos').orderBy('createdAt', 'desc').get();
        todos = tSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (e) { console.error("Error", e); }
}

async function saveLogToCloud(desc, projectId, tags, start, end, duration) {
    const newLog = { desc, projectId, tags, start, end, duration };
    const docRef = await db.collection('users').doc(currentUser.uid).collection('logs').add(newLog);
    logs.unshift({ id: docRef.id, ...newLog });
    renderLogs(); updateDashboardStats();
}

async function saveProjectToCloud(name, color) {
    const docRef = await db.collection('users').doc(currentUser.uid).collection('projects').add({ name, color });
    projects.push({ id: docRef.id, name, color });
    renderProjects(); updateProjectSelects();
}

async function deleteLogFromCloud(logId) {
    await db.collection('users').doc(currentUser.uid).collection('logs').doc(logId).delete();
    logs = logs.filter(l => l.id !== logId);
    renderLogs(); updateDashboardStats();
}

async function deleteProjectFromCloud(projId) {
    await db.collection('users').doc(currentUser.uid).collection('projects').doc(projId).delete();
    projects = projects.filter(p => p.id !== projId);
    logs = logs.map(l => l.projectId === projId ? {...l, projectId: null} : l);
    renderProjects(); updateProjectSelects(); renderLogs();
}

async function saveTodoToCloud(text) {
    const newTodo = { text: text, done: false, createdAt: Date.now() };
    const docRef = await db.collection('users').doc(currentUser.uid).collection('todos').add(newTodo);
    todos.unshift({ id: docRef.id, ...newTodo });
    renderTodos();
}

async function toggleTodoCloud(todoId, currentStatus) {
    await db.collection('users').doc(currentUser.uid).collection('todos').doc(todoId).update({ done: !currentStatus });
    const t = todos.find(t => t.id === todoId);
    if(t) t.done = !currentStatus;
    renderTodos();
}

async function deleteTodoCloud(todoId) {
    await db.collection('users').doc(currentUser.uid).collection('todos').doc(todoId).delete();
    todos = todos.filter(t => t.id !== todoId);
    renderTodos();
}

// =========================================
// 6. INITIALIZATION & EVENTS
// =========================================
function initApp() {
    setupNavigation();
    updateProfileUI(); 
    updateProjectSelects();
    renderLogs();
    renderProjects();
    renderTodos();
    updateDashboardStats();

    const savedTheme = localStorage.getItem('fred_theme') || 'pastel';
    applyTheme(savedTheme);
    document.querySelectorAll('.theme-btn').forEach(btn => {
        btn.onclick = () => { playCutePop(); applyTheme(btn.dataset.theme); }
    });

    const neonToggle = document.getElementById('neonFlowToggle');
    const savedNeon = localStorage.getItem('fred_neon_flow') === 'true';
    if (savedNeon) { document.body.classList.add('neon-flow-active'); neonToggle.checked = true; }
    neonToggle.addEventListener('change', (e) => {
        playCutePop();
        if (e.target.checked) { document.body.classList.add('neon-flow-active'); localStorage.setItem('fred_neon_flow', 'true'); } 
        else { document.body.classList.remove('neon-flow-active'); localStorage.setItem('fred_neon_flow', 'false'); }
    });

    const btnToggle = document.getElementById('btnToggle');
    const newBtnToggle = btnToggle.cloneNode(true);
    btnToggle.parentNode.replaceChild(newBtnToggle, btnToggle);
    newBtnToggle.addEventListener('click', toggleTimer);

    document.getElementById('btnAddProject').onclick = () => {
        playCutePop();
        const name = document.getElementById('newProjName').value.trim();
        const color = document.getElementById('newProjColor').value;
        if (name) { saveProjectToCloud(name, color); document.getElementById('newProjName').value = ''; }
    };

    document.getElementById('btnAddTodo').onclick = () => {
        playCutePop();
        const text = document.getElementById('newTodoInput').value.trim();
        if(text) { saveTodoToCloud(text); document.getElementById('newTodoInput').value = ''; }
    };

    document.getElementById('btnExportCSV').onclick = exportToCSV;
    
    document.getElementById('btnOpenManual').onclick = () => {
        const p = document.getElementById('manualAddPanel');
        p.style.display = p.style.display === 'none' ? 'flex' : 'none';
    };
    document.getElementById('btnCancelManual').onclick = () => {
        document.getElementById('manualAddPanel').style.display = 'none';
    };
    
    document.getElementById('btnSaveManual').onclick = () => {
        const mins = parseInt(document.getElementById('manualMinutes').value);
        if(isNaN(mins) || mins <= 0) return alert("请输入有效时间 (Valid minutes please).");
        
        const desc = document.getElementById('taskDesc').value || '手动记录 (Manual Session) ✍️';
        const projId = document.getElementById('taskProject').value;
        const tags = document.getElementById('taskTags').value;
        const duration = mins * 60;
        const end = Date.now();
        const start = end - (duration * 1000);

        saveLogToCloud(desc, projId || null, tags, start, end, duration);
        
        document.getElementById('manualAddPanel').style.display = 'none';
        document.getElementById('manualMinutes').value = '';
        document.getElementById('taskDesc').value = '';
        playCutePop();
    };

    // --- LÓGICA DEL EDITOR DE PERFIL (CON SUBIDA DE ARCHIVOS) ---
    document.getElementById('btnEditProfile').onclick = () => {
        playCutePop();
        document.getElementById('editProfileName').value = userProfile.name || '';
        document.getElementById('editProfileTitle').value = userProfile.title || '';
        
        tempProfilePicBase64 = userProfile.picUrl || ''; 
        const preview = document.getElementById('fileUploadPreview');
        if (tempProfilePicBase64) {
            preview.innerText = '✅ 已加载当前图片 (Current image loaded)';
        } else {
            preview.innerText = '';
        }
        
        document.getElementById('profileEditModal').style.display = 'flex';
    };

    document.getElementById('btnTriggerFileUpload').onclick = () => {
        document.getElementById('editProfilePicFile').click();
    };

    // MAGIA DE FILE READER (Convierte imagen local a texto para guardar en nube)
    document.getElementById('editProfilePicFile').addEventListener('change', function(event) {
        const file = event.target.files[0];
        if (file) {
            // Límite de 1MB para proteger tu base de datos de Firebase
            if(file.size > 1048576) {
                alert("图片太大！请选择小于 1MB 的图片。\n(¡La imagen es muy grande! Por favor elige una de menos de 1MB).");
                return;
            }
            const reader = new FileReader();
            reader.onload = function(e) {
                tempProfilePicBase64 = e.target.result; // El resultado es un string Base64
                document.getElementById('fileUploadPreview').innerText = '✅ 图片就绪 (¡Imagen lista!)';
                playCutePop();
            };
            reader.readAsDataURL(file);
        }
    });

    document.getElementById('btnRemoveProfilePic').onclick = () => {
        playCutePop();
        tempProfilePicBase64 = '';
        document.getElementById('fileUploadPreview').innerText = '🐾 已恢复默认头像 (Avatar por defecto activado)';
        document.getElementById('editProfilePicFile').value = ''; // Limpiar el input
    };

    document.getElementById('btnCancelProfile').onclick = () => {
        playCutePop();
        document.getElementById('profileEditModal').style.display = 'none';
    };

    document.getElementById('btnSaveProfile').onclick = async () => {
        playCutePop();
        const btn = document.getElementById('btnSaveProfile');
        btn.innerText = '保存中...'; 

        userProfile.name = document.getElementById('editProfileName').value.trim() || '弗雷德';
        userProfile.title = document.getElementById('editProfileTitle').value.trim() || 'Fred Jitterbet ✨';
        userProfile.picUrl = tempProfilePicBase64; 

        updateProfileUI(); 
        
        try {
            await db.collection('users').doc(currentUser.uid).set({ profile: userProfile }, { merge: true });
        } catch(e) {
            console.error("Error guardando el perfil", e);
        }
        
        btn.innerHTML = '保存 <span class="sub-en" style="color:#fff;">Save</span>';
        document.getElementById('profileEditModal').style.display = 'none';
    };
    // -----------------------------------

    document.getElementById('btnTestPopup').onclick = () => { showMilestonePopup(); };

    document.onkeydown = (e) => { 
        if (e.ctrlKey && e.code === 'Space') { e.preventDefault(); toggleTimer(); } 
    };

    setInterval(() => {
        document.getElementById('liveClock').innerText = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    }, 1000);

    const hour = new Date().getHours();
    const greetings = [
        {cn: "早上好，弗雷德！☀️", en: "Good Morning, Fred!"},
        {cn: "下午好，弗雷德！☕", en: "Good Afternoon, Fred!"},
        {cn: "晚上好，弗雷德！🌙", en: "Good Evening, Fred!"}
    ];
    const gIndex = hour < 12 ? 0 : hour < 18 ? 1 : 2;
    document.getElementById('greetingText').innerHTML = `${greetings[gIndex].cn} <span class="sub-en">${greetings[gIndex].en}</span>`;

    if (activeTimer && activeTimer.isRunning) {
        document.getElementById('taskDesc').value = activeTimer.desc;
        document.getElementById('taskProject').value = activeTimer.projectId;
        document.getElementById('taskTags').value = activeTimer.tags;
        startVisualTimer();
    }
}

function setupNavigation() {
    document.querySelectorAll('.nav-item').forEach(item => {
        item.onclick = (e) => {
            playCutePop();
            document.querySelectorAll('.nav-item, .view-section').forEach(el => el.classList.remove('active'));
            e.currentTarget.classList.add('active');
            const targetId = e.currentTarget.getAttribute('data-target');
            document.getElementById(targetId).classList.add('active');
            
            if(targetId === 'view-reports') renderVerticalChart();
        };
    });
}

// =========================================
// 8. TIMER & MILESTONES
// =========================================
function toggleTimer() {
    playCutePop();
    const desc = document.getElementById('taskDesc').value;
    const projId = document.getElementById('taskProject').value;
    const tags = document.getElementById('taskTags').value;

    if (!activeTimer || !activeTimer.isRunning) {
        activeTimer = { isRunning: true, start: Date.now(), desc: desc || '专注时间 (Focusing) ✨', projectId: projId || null, tags: tags };
        startVisualTimer();
    } else {
        const end = Date.now();
        const duration = Math.floor((end - activeTimer.start) / 1000);
        
        if (duration > 3) { 
            saveLogToCloud(activeTimer.desc, activeTimer.projectId, activeTimer.tags, activeTimer.start, end, duration);
            if(duration > 1800) launchConfetti(); 
        }
        stopVisualTimer();
    }
    localStorage.setItem('fred_cloud_active', JSON.stringify(activeTimer));
}

function startVisualTimer() {
    document.querySelector('.tracker-main').classList.add('running');
    document.querySelector('.btn-icon').innerText = '■';
    ['taskDesc', 'taskProject', 'taskTags'].forEach(id => document.getElementById(id).disabled = true);
    
    const currentElapsed = Math.floor((Date.now() - activeTimer.start) / 1000);
    nextAlertSecs = (Math.floor(currentElapsed / 1800) + 1) * 1800;
    
    timerInterval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - activeTimer.start) / 1000);
        document.getElementById('liveTimer').innerText = formatTime(elapsed);

        if (elapsed >= nextAlertSecs) {
            showMilestonePopup();
            nextAlertSecs += 1800; 
        }
    }, 1000);
}

function showMilestonePopup() {
    const popup = document.getElementById('milestonePopup');
    popup.style.display = 'flex';
    playCelebrationSound(); 
    launchConfetti(); 
    setTimeout(() => { popup.style.display = 'none'; }, 5000);
}

function stopVisualTimer() {
    clearInterval(timerInterval); activeTimer = null;
    document.querySelector('.tracker-main').classList.remove('running');
    document.querySelector('.btn-icon').innerText = '▶';
    ['taskDesc', 'taskProject', 'taskTags'].forEach(id => document.getElementById(id).disabled = false);
    document.getElementById('taskDesc').value = '';
    document.getElementById('taskTags').value = '';
    document.getElementById('liveTimer').innerText = '00:00:00';
}

// =========================================
// 9. UI RENDERERS Y SISTEMA DE NIVELES PROGRESIVO
// =========================================

function updateProfileUI() {
    document.getElementById('sidebarName').innerText = userProfile.name;
    document.getElementById('sidebarTitle').innerText = userProfile.title;
    
    const mainName = document.getElementById('mainProfileName');
    const mainTitle = document.getElementById('mainProfileTitle');
    if (mainName) mainName.innerText = userProfile.name;
    if (mainTitle) mainTitle.innerText = userProfile.title;

    ['sidebarAvatarImg', 'mainAvatarImg'].forEach(id => {
        const img = document.getElementById(id);
        if (img) {
            if (userProfile.picUrl) {
                img.src = userProfile.picUrl;
                img.style.display = 'block';
            } else {
                img.style.display = 'none'; 
            }
        }
    });
}

function getLevelData(totalXP) {
    let level = 1;
    let xpRequired = 1000;
    let currentLevelXP = totalXP;

    while (currentLevelXP >= xpRequired) {
        currentLevelXP -= xpRequired;
        level++;
        xpRequired = Math.floor(xpRequired * 1.2); 
    }
    return { level, currentLevelXP, xpRequired };
}

function updateProjectSelects() {
    const select = document.getElementById('taskProject');
    select.innerHTML = '<option value="">无项目 (No Project) ☁️</option>';
    projects.forEach(p => select.innerHTML += `<option value="${p.id}">${p.name}</option>`);
}

function renderProjects() {
    const list = document.getElementById('projectList');
    list.innerHTML = '';
    projects.forEach(p => {
        list.innerHTML += `
            <div class="project-card bouncy-hover" style="border-top-color: ${p.color}">
                <h3>${p.name}</h3>
                <button class="btn-delete" style="opacity: 1;" onclick="deleteProjectFromCloud('${p.id}')">🗑️</button>
            </div>
        `;
    });
}

function renderTodos() {
    const list = document.getElementById('todoList');
    list.innerHTML = '';
    todos.forEach(t => {
        list.innerHTML += `
            <div class="todo-item ${t.done ? 'done' : ''}">
                <input type="checkbox" class="todo-checkbox" ${t.done ? 'checked' : ''} onclick="toggleTodoCloud('${t.id}', ${t.done})">
                <span class="todo-text">${t.text}</span>
                <button class="btn-delete" style="opacity:1;" onclick="deleteTodoCloud('${t.id}')">✖</button>
            </div>
        `;
    });
}

function renderLogs() {
    const container = document.getElementById('logListContainer');
    container.innerHTML = '';
    
    logs.slice(0, 30).forEach(log => {
        const proj = projects.find(p => p.id === log.projectId) || { name: '日常 (General)', color: 'var(--text-muted)' };
        let tagsHtml = log.tags ? `<span class="log-tags-small">${log.tags.split(',').map(t => `#${t.trim()}`).join(' ')}</span>` : '';
        
        container.innerHTML += `
            <div class="log-item slide-in-bottom" style="border-left-color: ${proj.color}">
                <div class="log-color-poly" style="background: ${proj.color};"></div>
                <div class="log-desc">${log.desc} ${tagsHtml}</div>
                <div class="log-project-badge" style="border-color: ${proj.color}; color: ${proj.color}">${proj.name}</div>
                <div class="log-time">${formatTimeRange(log.start, log.end)}</div>
                <div class="log-duration" style="color: ${proj.color}">${formatDurationStr(log.duration)}</div>
                <button class="btn-delete" onclick="deleteLogFromCloud('${log.id}')">✖</button>
            </div>
        `;
    });
}

function updateDashboardStats() {
    const today = new Date().setHours(0,0,0,0);
    const todayLogs = logs.filter(l => l.start >= today);
    document.getElementById('tasksDone').innerText = todayLogs.length;
    
    const qsList = document.getElementById('quickStatsList');
    if(todayLogs.length === 0) {
        qsList.innerHTML = '<li>等待你的第一个任务... <span class="sub-en">Waiting for first task... 🐾</span></li>';
        document.getElementById('dailyFocusFill').style.width = `0%`;
        document.getElementById('focusText').innerHTML = `0 小时 / 4 小时目标 <span class="sub-en">0 hrs / 4 hrs goal</span>`;
    } else {
        const tSecs = todayLogs.reduce((acc, l) => acc + l.duration, 0);
        qsList.innerHTML = `
            <li>✔️ 今日完成 ${todayLogs.length} 项任务 <span class="sub-en">Tasks completed today</span></li>
            <li>⏱️ 追踪了 ${formatDurationStr(tSecs)} <span class="sub-en">Tracked today</span></li>
            <li>🔥 保持动力！ <span class="sub-en">Keep the momentum going!</span></li>
        `;
        document.getElementById('dailyFocusFill').style.width = `${Math.min((tSecs / 14400) * 100, 100)}%`;
        document.getElementById('focusText').innerHTML = `${(tSecs/3600).toFixed(1)} 小时 / 4 小时目标 <span class="sub-en">hrs / 4 hrs goal</span>`;
    }

    const allTimeSecs = logs.reduce((acc, l) => acc + l.duration, 0);
    const totalXP = Math.floor(allTimeSecs / 60) * 10;
    
    const levelData = getLevelData(totalXP);
    const progressPct = (levelData.currentLevelXP / levelData.xpRequired) * 100;
    
    document.getElementById('rpgLevel').innerText = levelData.level;
    document.getElementById('rpgXpText').innerText = `${levelData.currentLevelXP} / ${levelData.xpRequired} XP`;
    document.getElementById('rpgXpFill').style.width = `${progressPct}%`;
    
    const elProfileLevel = document.getElementById('profileLevel');
    if(elProfileLevel) {
        elProfileLevel.innerText = `Lv. ${levelData.level}`;
        document.getElementById('profileXpText').innerText = `${levelData.currentLevelXP} / ${levelData.xpRequired} XP`;
        document.getElementById('profileXpFill').style.width = `${progressPct}%`;
        document.getElementById('profileTotalXP').innerText = totalXP;
        document.getElementById('profileMed').innerText = `+${Math.floor(totalXP * 0.15)}`; 
        document.getElementById('profileWriting').innerText = `+${Math.floor(totalXP * 0.08)}`; 
    }
}

function renderVerticalChart() {
    const totalSecs = logs.reduce((acc, l) => acc + l.duration, 0);
    document.getElementById('repTotalTime').innerText = formatDurationStr(totalSecs);
    document.getElementById('repTotalSessions').innerText = logs.length;
    const container = document.getElementById('verticalChart');
    container.innerHTML = '';

    if (totalSecs === 0) {
        container.innerHTML = '<p style="align-self: center; color: var(--text-muted); font-size: 1.2rem;">暂无数据 <span class="sub-en">No data yet 🌸</span></p>';
        document.getElementById('repFavProject').innerText = '-'; return;
    }

    const projTotals = {};
    logs.forEach(l => { projTotals[l.projectId || 'none'] = (projTotals[l.projectId || 'none'] || 0) + l.duration; });
    const sorted = Object.entries(projTotals).sort((a,b) => b[1] - a[1]);
    
    const favProj = sorted[0][0] === 'none' ? {name: '日常 (General)'} : projects.find(p => p.id == sorted[0][0]);
    document.getElementById('repFavProject').innerText = favProj ? favProj.name : '-';

    sorted.forEach(([pid, duration]) => {
        const proj = pid === 'none' ? {name: '日常 (Gen)', color: 'var(--text-muted)'} : projects.find(p => p.id == pid);
        if(!proj) return;
        const hPct = Math.max((duration / sorted[0][1]) * 100, 10); 
        container.innerHTML += `
            <div class="chart-bar-wrapper" title="${proj.name}: ${formatDurationStr(duration)}">
                <div class="chart-bar" style="height: ${hPct}%; background-color: ${proj.color};">
                    <span class="chart-value">${formatDurationStr(duration)}</span>
                </div>
                <div class="chart-label-bottom">${proj.name}</div>
            </div>`;
    });
}

function launchConfetti() {
    const overlay = document.getElementById('confettiOverlay');
    const emojis = ['🎉', '✨', '🐾', '🔥', '🌸', '🏆', '⚕️', '💉', '📖', '🍵']; 
    for(let i=0; i<60; i++) {
        const drop = document.createElement('div');
        drop.className = 'emoji-drop';
        drop.innerText = emojis[Math.floor(Math.random() * emojis.length)];
        drop.style.left = (Math.random() * 100) + '%'; 
        drop.style.animationDuration = (Math.random() * 3 + 2) + 's'; 
        drop.style.animationDelay = (Math.random() * 0.5) + 's';
        overlay.appendChild(drop);
        setTimeout(() => drop.remove(), 6000);
    }
}

function exportToCSV() {
    if (logs.length === 0) return alert("没有记录可导出 (No logs to export)!");
    let csvContent = "data:text/csv;charset=utf-8,Date,Description,Project,Tags,Duration (Minutes)\n";
    logs.forEach(log => {
        const date = new Date(log.start).toLocaleDateString();
        const proj = projects.find(p => p.id === log.projectId);
        const pName = proj ? proj.name : "General";
        const mins = (log.duration / 60).toFixed(2);
        csvContent += `${date},"${log.desc.replace(/"/g, '""')}","${pName}","${(log.tags || '').replace(/"/g, '""')}",${mins}\n`;
    });
    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csvContent));
    link.setAttribute("download", `Fred_Cloud_Export.csv`);
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
}

let currentSoundNode = null;
function stopAllFocusSounds() {
    if (currentSoundNode) { currentSoundNode.stop(); currentSoundNode.disconnect(); currentSoundNode = null; }
    document.querySelectorAll('.sound-card').forEach(c => c.classList.remove('playing'));
}

document.getElementById('btnStopSounds').onclick = stopAllFocusSounds;

document.getElementById('btnRain').onclick = function() {
    stopAllFocusSounds(); this.parentElement.classList.add('playing');
    if(audioCtx.state === 'suspended') audioCtx.resume();
    const bufferSize = audioCtx.sampleRate * 2;
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const output = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) { output[i] = Math.random() * 2 - 1; }
    currentSoundNode = audioCtx.createBufferSource();
    currentSoundNode.buffer = buffer; currentSoundNode.loop = true;
    const filter = audioCtx.createBiquadFilter();
    filter.type = 'lowpass'; filter.frequency.value = 1000;
    const gain = audioCtx.createGain(); gain.gain.value = 0.5;
    currentSoundNode.connect(filter); filter.connect(gain); gain.connect(audioCtx.destination);
    currentSoundNode.start(0);
};

document.getElementById('btnWaves').onclick = function() {
    stopAllFocusSounds(); this.parentElement.classList.add('playing');
    if(audioCtx.state === 'suspended') audioCtx.resume();
    const bufferSize = audioCtx.sampleRate * 2;
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const output = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) { output[i] = (Math.random() * 2 - 1) * 0.5; }
    currentSoundNode = audioCtx.createBufferSource();
    currentSoundNode.buffer = buffer; currentSoundNode.loop = true;
    const filter = audioCtx.createBiquadFilter();
    filter.type = 'lowpass'; filter.frequency.value = 400;
    const lfo = audioCtx.createOscillator();
    lfo.type = 'sine'; lfo.frequency.value = 0.15;
    const gain = audioCtx.createGain(); lfo.connect(gain.gain);
    currentSoundNode.connect(filter); filter.connect(gain); gain.connect(audioCtx.destination);
    currentSoundNode.start(0); lfo.start(0);
};

document.getElementById('btnBrown').onclick = function() {
    stopAllFocusSounds(); this.parentElement.classList.add('playing');
    if(audioCtx.state === 'suspended') audioCtx.resume();
    const bufferSize = audioCtx.sampleRate * 2;
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const output = buffer.getChannelData(0);
    let lastOut = 0;
    for (let i = 0; i < bufferSize; i++) {
        let white = Math.random() * 2 - 1;
        output[i] = (lastOut + (0.02 * white)) / 1.02; lastOut = output[i]; output[i] *= 3.5;
    }
    currentSoundNode = audioCtx.createBufferSource(); currentSoundNode.buffer = buffer; currentSoundNode.loop = true;
    const gain = audioCtx.createGain(); gain.gain.value = 0.8;
    currentSoundNode.connect(gain); gain.connect(audioCtx.destination); currentSoundNode.start(0);
};

function formatTime(s) { return `${String(Math.floor(s/3600)).padStart(2,'0')}:${String(Math.floor((s%3600)/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`; }
function formatDurationStr(s) { const h = Math.floor(s/3600), m = Math.floor((s%3600)/60); return h === 0 && m === 0 ? `${s}s` : h > 0 ? `${h}h ${m}m` : `${m}m`; }
function formatTimeRange(st, en) { return `${new Date(st).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})} - ${new Date(en).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}`; }