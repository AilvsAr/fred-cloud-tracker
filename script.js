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
let userProfile = { name: '弗雷德', title: 'Fred Jitterbet ✨', picUrl: '', diamonds: 0, inventory: [], equipped: [] };
let tempProfilePicBase64 = ''; 

let currentKnownLevel = 0; 
let globalMinuteTicker = 0; // Para el sistema de alarmas de tareas

let activeTimer = JSON.parse(localStorage.getItem('fred_cloud_active')) || null;
let timerInterval = null;
let nextAlertSecs = 1800; // 30 minutos

let analyticsChartInstance = null;
let currentChartType = 'bar';
let currentTimeFilter = 'weekly';

// =========================================
// CATALOGO DE LA TIENDA Y EFECTOS
// =========================================
const shopItems = [
    { id: 'feature_radial_chart', name: '数据分析：环形图', desc: 'Unlock Radial Chart', price: 50, icon: '🍩', classStr: '', details: '解锁数据分析中的高级环形图表视图。(Desbloquea el gráfico radial en Analytics).' },
    { id: 'effect_avatar_float', name: '反重力头像', desc: 'Floating Avatar', price: 80, icon: '🎈', classStr: 'effect-avatar-float', details: '使你的自定义头像像失重一样上下浮动。(Haz que tu avatar flote de forma antigravedad).' },
    { id: 'feature_analytics', name: '高级数据分析模块', desc: 'Unlock Analytics Tab', price: 100, icon: '📊', classStr: '', details: '解锁完整的数据分析页面。(Desbloquea la página completa de Analytics).' },
    { id: 'feature_task_alarms', name: '智能任务警报系统', desc: 'Task Alarms System', price: 100, icon: '🔔', classStr: '', details: '解锁任务优先级提醒，紧急任务每10分钟报警！(Desbloquea alarmas para tareas urgentes cada 10 min).' },
    
    // COSMÉTICOS
    { id: 'effect_dark_fantasy', name: '暗黑幻想光标', desc: 'Dark Fantasy Cursor', price: 15, icon: '⚔️', classStr: 'effect-dark-fantasy', details: '将鼠标指针变为黑暗奇幻风格的十字线。 (Cambia el cursor a cruz oscura).' },
    { id: 'effect_cyberpunk', name: '赛博朋克边框', desc: 'Cyberpunk Inner Glow', price: 25, icon: '🌃', classStr: 'effect-cyberpunk', details: '为所有卡片添加赛博朋克风格的霓虹内发光。 (Añade resplandor neón interior).' },
    { id: 'cursor_writer', name: '羽毛笔光标', desc: 'Quill Pen Cursor', price: 30, icon: '✒️', classStr: 'cursor-writer', details: '写作时使用的古典羽毛笔光标。 (Cursor clásico de pluma).' },
    { id: 'cursor_med', name: '手术刀光标', desc: 'Scalpel Cursor', price: 30, icon: '🗡️', classStr: 'cursor-med', details: '高精度手术刀光标。 (Cursor en forma de bisturí).' },
    { id: 'effect_leopard', name: '雪豹之影', desc: 'Leopard Paws Background', price: 50, icon: '🐾', classStr: 'effect-leopard-paws', details: '背景应用复古滤镜。 (Filtro retro de leopardo).' },
    { id: 'effect_med_pulse', name: '医疗心跳脉冲', desc: 'Medical Heartbeat Avatar', price: 150, icon: '⚕️', classStr: 'effect-med-pulse', details: '你的头像会像心脏一样跳动。 (Tu avatar latirá con un aura roja).' },
    { id: 'profile_glitch', name: '故障艺术头像', desc: 'Glitch Profile Pic', price: 200, icon: '📺', classStr: 'profile-glitch', details: '为头像添加真正的色彩分离故障效果。 (Efecto de separación RGB en la foto de perfil).' },
    { id: 'menu_glassmorphism', name: '极致玻璃态', desc: 'Ultra Glassmorphism Menus', price: 300, icon: '🧊', classStr: 'menu-glassmorphism', details: '使侧边栏变得极致透明且模糊。 (Menús de cristal extra difuminados).' },
    { id: 'effect_cyber_grid', name: '科幻矩阵全息', desc: 'Sci-Fi Holographic Grid', price: 500, icon: '🛰️', classStr: 'effect-cyber-grid', details: '投影出全息科幻网格。 (Cuadrícula holográfica en el fondo).' },
    { id: 'effect_chongqing_leopard', name: '重庆赛博神', desc: 'Ultimate Chongqing Aura', price: 1000, icon: '🐆', classStr: 'effect-chongqing-leopard', details: '界面亮起强烈的赛博霓虹色彩。 (Colores de neón ciberpunk extremos).' },
    { id: 'effect_thunder_shatter', name: '雷霆碎裂', desc: 'Lightning Shatter', price: 1000, icon: '⚡', classStr: 'effect-thunder-shatter', details: '卡片产生真实的雷击碎裂闪光震撼效果。 (¡Efecto épico! Las tarjetas se agrietan con luz de relámpago).' }
];

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
    const notes = [523.25, 659.25, 783.99, 1046.50, 1318.51, 1567.98]; 
    notes.forEach((freq, i) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain); gain.connect(audioCtx.destination);
        osc.type = 'sine'; osc.frequency.value = freq;
        const startTime = audioCtx.currentTime + (i * 0.08);
        gain.gain.setValueAtTime(0, startTime);
        gain.gain.linearRampToValueAtTime(0.1, startTime + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.4);
        osc.start(startTime); osc.stop(startTime + 0.4);
    });
}

function playAlarmSound() {
    if(audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain); gain.connect(audioCtx.destination);
    osc.type = 'square';
    osc.frequency.setValueAtTime(880, audioCtx.currentTime);
    osc.frequency.setValueAtTime(1108, audioCtx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
    osc.start(); osc.stop(audioCtx.currentTime + 0.3);
}

function applyTheme(themeName) {
    document.body.setAttribute('data-theme', themeName);
    localStorage.setItem('fred_theme', themeName);
    document.querySelectorAll('.theme-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.theme === themeName);
    });
    if (analyticsChartInstance) renderAnalytics();
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
            userProfile = { ...userProfile, ...userDoc.data().profile };
        }
        if(!userProfile.inventory) userProfile.inventory = [];
        if(!userProfile.equipped) userProfile.equipped = []; 
        if(!userProfile.diamonds) userProfile.diamonds = 0;

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
    if(document.getElementById('view-reports').classList.contains('active')) renderAnalytics();
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
    if(document.getElementById('view-reports').classList.contains('active')) renderAnalytics();
}

async function deleteProjectFromCloud(projId) {
    await db.collection('users').doc(currentUser.uid).collection('projects').doc(projId).delete();
    projects = projects.filter(p => p.id !== projId);
    logs = logs.map(l => l.projectId === projId ? {...l, projectId: null} : l);
    renderProjects(); updateProjectSelects(); renderLogs();
    if(document.getElementById('view-reports').classList.contains('active')) renderAnalytics();
}

async function saveTodoToCloud(text, priority) {
    const newTodo = { text: text, priority: priority, done: false, createdAt: Date.now() };
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

async function syncProfile() {
    try {
        await db.collection('users').doc(currentUser.uid).set({ profile: userProfile }, { merge: true });
    } catch(e) { console.error("Error guardando el perfil", e); }
}

// =========================================
// 6. INITIALIZATION & EVENTS
// =========================================
function initApp() {
    setupNavigation();
    
    // 🔥 CÓDIGO DE TRAMPA VIP 🔥
    if (!userProfile.vipBonusClaimed) {
        userProfile.diamonds = (userProfile.diamonds || 0) + 100000;
        userProfile.vipBonusClaimed = true;
        if(!userProfile.equipped) userProfile.equipped = [];
        syncProfile(); 
        alert("💎 VIP ACCESS: Se han añadido 100,000 diamantes a tu cuenta de desarrollador. ¡Disfruta la tienda!");
    }

    updateProfileUI(); 
    initAnalytics(); 
    updateProjectSelects();
    renderLogs();
    renderProjects();
    renderTodos();
    
    const allTimeSecs = logs.reduce((acc, l) => acc + l.duration, 0);
    const initTotalXP = Math.floor(allTimeSecs / 60) * 10;
    currentKnownLevel = getLevelData(initTotalXP).level;
    
    updateDashboardStats();
    renderShop();
    applyPurchasedEffects();

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
        const priority = document.getElementById('newTodoPriority').value;
        if(text) { saveTodoToCloud(text, priority); document.getElementById('newTodoInput').value = ''; }
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

    // LÓGICA DEL EDITOR DE PERFIL
    document.getElementById('btnEditProfile').onclick = () => {
        playCutePop();
        document.getElementById('editProfileName').value = userProfile.name || '';
        document.getElementById('editProfileTitle').value = userProfile.title || '';
        tempProfilePicBase64 = userProfile.picUrl || ''; 
        const preview = document.getElementById('fileUploadPreview');
        if (tempProfilePicBase64) preview.innerText = '✅ 已加载当前图片 (Current image loaded)';
        else preview.innerText = '';
        document.getElementById('profileEditModal').style.display = 'flex';
    };

    document.getElementById('btnTriggerFileUpload').onclick = () => { document.getElementById('editProfilePicFile').click(); };

    document.getElementById('editProfilePicFile').addEventListener('change', function(event) {
        const file = event.target.files[0];
        if (file) {
            if(file.size > 1048576) { alert("图片太大！请选择小于 1MB 的图片。"); return; }
            const reader = new FileReader();
            reader.onload = function(e) {
                tempProfilePicBase64 = e.target.result; 
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
        document.getElementById('editProfilePicFile').value = ''; 
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
        await syncProfile();
        
        btn.innerHTML = '保存 <span class="sub-en" style="color:#fff;">Save</span>';
        document.getElementById('profileEditModal').style.display = 'none';
    };

    document.getElementById('btnTestPopup').onclick = () => { showMilestonePopup("测试动画", "这是来自测试的通知 ✨"); };

    document.onkeydown = (e) => { 
        if (e.ctrlKey && e.code === 'Space') { e.preventDefault(); toggleTimer(); } 
    };

    setInterval(() => {
        document.getElementById('liveClock').innerText = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    }, 1000);

    // BACKGROUND TICKER (ALARMAS CADA MINUTO)
    setInterval(() => {
        globalMinuteTicker++;
        if (!userProfile.inventory || !userProfile.inventory.includes('feature_task_alarms')) return; // No tiene la mejora comprada

        const hasUrgent = todos.some(t => !t.done && t.priority === 'urgent');
        const hasMod = todos.some(t => !t.done && t.priority === 'moderate');

        if (hasUrgent && globalMinuteTicker % 10 === 0) { // Cada 10 minutos
            playAlarmSound();
            showMilestonePopup("🚨 紧急任务提醒！", "你有未完成的紧急任务！(¡Tienes tareas URGENTES pendientes!)");
        } else if (hasMod && globalMinuteTicker % 60 === 0) { // Cada 60 minutos
            playAlarmSound();
            showMilestonePopup("⚠️ 中等任务提醒", "别忘了你的中等优先级任务。(No olvides tus tareas moderadas).");
        }
    }, 60000);

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
            const targetId = e.currentTarget.getAttribute('data-target');
            
            // LOCKS DE SEGURIDAD PARA FUNCIONES DE PAGA
            if(targetId === 'view-reports') {
                if(!userProfile.inventory || !userProfile.inventory.includes('feature_analytics')) {
                    alert('🔒 此功能已锁定！请在商店中购买"高级数据分析模块"。\n(¡Función bloqueada! Compra "Analytics" en la tienda por 100 💎).');
                    return;
                }
                renderAnalytics();
            }

            document.querySelectorAll('.nav-item, .view-section').forEach(el => el.classList.remove('active'));
            e.currentTarget.classList.add('active');
            document.getElementById(targetId).classList.add('active');
            
            if(targetId === 'view-shop') renderShop();
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
            if(duration > 1800) showMilestonePopup("30分钟过去了！", "干得好！继续保持 ✨");
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
            showMilestonePopup("30分钟过去了！", "干得好！继续保持 ✨");
            nextAlertSecs += 1800; 
        }
    }, 1000);
}

function showMilestonePopup(title, message) {
    document.getElementById('popupTitle').innerText = title;
    document.getElementById('popupMessage').innerText = message;
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
// 9. UI RENDERERS Y SISTEMA DE NIVELES
// =========================================

function updateProfileUI() {
    document.getElementById('sidebarName').innerText = userProfile.name;
    document.getElementById('sidebarTitle').innerText = userProfile.title;
    document.getElementById('topDiamondCount').innerText = userProfile.diamonds || 0;
    
    const mainName = document.getElementById('mainProfileName');
    const mainTitle = document.getElementById('mainProfileTitle');
    if (mainName) mainName.innerText = userProfile.name;
    if (mainTitle) mainTitle.innerText = userProfile.title;

    ['sidebarAvatarImg', 'mainAvatarImg'].forEach(id => {
        const img = document.getElementById(id);
        if (img) {
            if (userProfile.picUrl) { img.src = userProfile.picUrl; img.style.display = 'block'; } 
            else { img.style.display = 'none'; }
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
        // Badges de prioridad
        let pBadge = '';
        if(t.priority === 'urgent') pBadge = '<span class="badge-priority" style="background:#ff6b6b; color:#fff;">🔴 Urgente</span>';
        else if(t.priority === 'moderate') pBadge = '<span class="badge-priority" style="background:#feca57; color:#000;">🟡 Mod</span>';
        else pBadge = '<span class="badge-priority" style="background:var(--input-bg); color:var(--text-muted);">🟢 Normal</span>';

        list.innerHTML += `
            <div class="todo-item ${t.done ? 'done' : ''}">
                <input type="checkbox" class="todo-checkbox" ${t.done ? 'checked' : ''} onclick="toggleTodoCloud('${t.id}', ${t.done})">
                <span class="todo-text">${t.text} ${pBadge}</span>
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
    
    if (currentKnownLevel > 0 && levelData.level > currentKnownLevel) {
        const levelsGained = levelData.level - currentKnownLevel;
        const diamondsEarned = levelsGained * 10; 
        userProfile.diamonds = (userProfile.diamonds || 0) + diamondsEarned;
        syncProfile();
        updateProfileUI();
        showMilestonePopup("🎉 升级了！Level Up!", `你获得了 ${diamondsEarned} 💎 钻石!`);
        currentKnownLevel = levelData.level;
    } else {
        currentKnownLevel = levelData.level; 
    }

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

// =========================================
// 10. SHOP ENGINE (NUEVO SISTEMA DE EQUIPAR)
// =========================================
function renderShop() {
    const grid = document.getElementById('shopGrid');
    grid.innerHTML = '';
    
    if(!userProfile.inventory) userProfile.inventory = [];
    if(!userProfile.equipped) userProfile.equipped = [];
    
    shopItems.forEach(item => {
        const isOwned = userProfile.inventory.includes(item.id);
        const isEquipped = userProfile.equipped.includes(item.id);
        const canAfford = (userProfile.diamonds || 0) >= item.price;
        
        let btnHTML = '';
        if (isOwned) {
            // Si es un feature (funcionalidad), no necesita equiparse, solo se posee
            if (item.classStr === '') {
                btnHTML = `<button class="btn-buy disabled" style="background:var(--input-bg); color:var(--text-muted);">已拥有 Owned</button>`;
            } else if (isEquipped) {
                btnHTML = `<button class="btn-buy" style="background: #ff6b6b; color: #fff;" onclick="toggleEquipItem('${item.id}')">卸下 Unequip</button>`;
            } else {
                btnHTML = `<button class="btn-buy" style="background: #1dd1a1; color: #fff;" onclick="toggleEquipItem('${item.id}')">装备 Equip</button>`;
            }
        } else {
            btnHTML = `<button class="btn-buy ${!canAfford ? 'disabled' : ''}" onclick="buyItem('${item.id}', ${item.price})">购买 Buy</button>`;
        }

        grid.innerHTML += `
            <div class="shop-card ${isOwned ? 'owned' : ''} ${isEquipped ? 'equipped' : ''}">
                <span class="shop-icon">${item.icon}</span>
                <h3 style="margin-bottom: 5px; color: var(--text-dark);">${item.name}</h3>
                <p style="font-size: 0.8rem; color: var(--text-muted); height: 40px; margin-bottom:10px;">${item.desc}</p>
                <div class="shop-price">💎 ${item.price}</div>
                ${btnHTML}
            </div>
        `;
    });
}

async function buyItem(itemId, price) {
    if (userProfile.diamonds < price) {
        alert("钻石不足！请多学习升级以获取钻石 💎\n(¡No tienes suficientes diamantes! Estudia y sube de nivel para ganar más).");
        return;
    }
    
    const item = shopItems.find(i => i.id === itemId);
    
    userProfile.diamonds -= price;
    if(!userProfile.inventory) userProfile.inventory = [];
    if(!userProfile.equipped) userProfile.equipped = [];
    
    userProfile.inventory.push(itemId);
    if(item.classStr !== '') userProfile.equipped.push(itemId); // Solo los cosméticos se equipan
    
    updateProfileUI();
    renderShop();
    applyPurchasedEffects();
    await syncProfile();
    
    showMilestonePopup("购买成功！(Purchased!)", `✨ ${item.details}`);
}

async function toggleEquipItem(itemId) {
    playCutePop();
    if(!userProfile.equipped) userProfile.equipped = [];
    
    const index = userProfile.equipped.indexOf(itemId);
    if (index > -1) {
        userProfile.equipped.splice(index, 1); 
    } else {
        userProfile.equipped.push(itemId); 
    }
    
    renderShop();
    applyPurchasedEffects();
    await syncProfile();
}

function applyPurchasedEffects() {
    shopItems.forEach(item => {
        if(item.classStr !== '') document.body.classList.remove(item.classStr);
    });
    
    if(!userProfile.equipped) return;
    
    shopItems.forEach(item => {
        if (item.classStr !== '' && userProfile.equipped.includes(item.id)) {
            document.body.classList.add(item.classStr);
        }
    });
}

// =========================================
// 11. CHART.JS ANALYTICS ENGINE
// =========================================

function initAnalytics() {
    document.querySelectorAll('.btn-filter').forEach(btn => {
        btn.onclick = (e) => {
            playCutePop();
            document.querySelectorAll('.btn-filter').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            currentTimeFilter = e.target.dataset.filter;
            renderAnalytics();
        }
    });

    document.querySelectorAll('.btn-toggle').forEach(btn => {
        btn.onclick = (e) => {
            playCutePop();
            // BLOQUEO DE GRÁFICO RADIAL
            if(e.currentTarget.dataset.type === 'doughnut') {
                if(!userProfile.inventory || !userProfile.inventory.includes('feature_radial_chart')) {
                    alert('🔒 环形图表已锁定！请在商店购买。\n(¡Gráfico Radial bloqueado! Cómpralo en la tienda por 50 💎).');
                    return;
                }
            }

            document.querySelectorAll('.btn-toggle').forEach(b => b.classList.remove('active'));
            e.currentTarget.classList.add('active');
            currentChartType = e.currentTarget.dataset.type;
            renderAnalytics();
        }
    });
}

function renderAnalytics() {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const dayOfWeek = now.getDay() === 0 ? 6 : now.getDay() - 1; 
    const startOfWeek = startOfToday - (dayOfWeek * 86400000);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const startOfYear = new Date(now.getFullYear(), 0, 1).getTime();

    let filteredLogs = logs.filter(l => {
        if(currentTimeFilter === 'all') return true;
        if(currentTimeFilter === 'daily') return l.start >= startOfToday;
        if(currentTimeFilter === 'weekly') return l.start >= startOfWeek;
        if(currentTimeFilter === 'monthly') return l.start >= startOfMonth;
        if(currentTimeFilter === 'yearly') return l.start >= startOfYear;
        return true;
    });

    const totalSecs = filteredLogs.reduce((acc, l) => acc + l.duration, 0);
    document.getElementById('repTotalTime').innerText = formatDurationStr(totalSecs);
    document.getElementById('repTotalSessions').innerText = filteredLogs.length;

    if (totalSecs === 0) {
        document.getElementById('repFavProject').innerText = '-';
        if(analyticsChartInstance) { analyticsChartInstance.destroy(); analyticsChartInstance = null; }
        return;
    }

    const projTotals = {};
    filteredLogs.forEach(l => { 
        const pId = l.projectId || 'none';
        projTotals[pId] = (projTotals[pId] || 0) + l.duration; 
    });
    const sorted = Object.entries(projTotals).sort((a,b) => b[1] - a[1]);
    
    const favProjId = sorted[0][0];
    const favProj = favProjId === 'none' ? {name: '日常 (General)'} : projects.find(p => p.id === favProjId);
    document.getElementById('repFavProject').innerText = favProj ? favProj.name : '-';

    const labels = [];
    const dataVals = [];
    const bgColors = [];

    sorted.forEach(([pid, duration]) => {
        const proj = pid === 'none' ? {name: '日常 (Gen)', color: '#636e72'} : projects.find(p => p.id === pid);
        if(!proj) return;
        labels.push(proj.name);
        dataVals.push(duration / 3600); 
        bgColors.push(proj.color || '#636e72');
    });

    const isDark = document.body.getAttribute('data-theme') !== 'pastel';
    const textColor = isDark ? '#f8fafc' : '#2d3436';

    const ctx = document.getElementById('analyticsChart').getContext('2d');
    if (analyticsChartInstance) { analyticsChartInstance.destroy(); }

    analyticsChartInstance = new Chart(ctx, {
        type: currentChartType, 
        data: {
            labels: labels,
            datasets: [{
                label: '小时 (Hours)',
                data: dataVals,
                backgroundColor: bgColors,
                borderWidth: currentChartType === 'doughnut' ? 2 : 0,
                borderColor: isDark ? '#121212' : '#ffffff',
                borderRadius: currentChartType === 'bar' ? 8 : 0,
                hoverOffset: 10
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: currentChartType === 'doughnut', position: 'right', labels: { color: textColor, font: { family: 'Noto Sans SC', size: 14 } } },
                tooltip: { callbacks: { label: function(context) { let val = context.raw; let hrs = Math.floor(val); let mins = Math.round((val - hrs) * 60); return ` ${hrs}h ${mins}m`; } } }
            },
            scales: currentChartType === 'bar' ? {
                y: { beginAtZero: true, ticks: { color: textColor }, grid: { color: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' } },
                x: { ticks: { color: textColor, font: { family: 'Noto Sans SC', weight: 'bold' } }, grid: { display: false } }
            } : { x: {display: false}, y: {display: false} }
        }
    });
}

function launchConfetti() {
    const overlay = document.getElementById('confettiOverlay');
    const emojis = ['🎉', '✨', '🐾', '🔥', '🌸', '🏆', '💎', '💎', '📖', '🍵']; 
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