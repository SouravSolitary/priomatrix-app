// State Management
let tasks = JSON.parse(localStorage.getItem('workflow_tasks')) || [];
let userStats = JSON.parse(localStorage.getItem('workflow_user_stats')) || { 
  xp: 0, 
  level: 1, 
  streak: 0,
  lastCompletedDate: null,
  weeklyTarget: 10,
  weeklyProgress: 0,
  lastResetWeek: null,
  dailyHistory: {} 
};

let activeFilter = 'all';
let activeTag = 'all';
let chartInstance = null;
let audioCtx = null;

// ⏱️ Pomodoro Timer State
let pomoTimeLeft = 25 * 60;
let pomoTimerId = null;
let pomoIsWork = true;
let activePomoTask = null;

function initAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
}

// Synthesized Sound Effects
function playSound(type) {
  initAudio();
  if (!audioCtx) return;

  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }

  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.connect(gain);
  gain.connect(audioCtx.destination);

  const now = audioCtx.currentTime;

  if (type === 'complete') {
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(523.25, now);
    osc.frequency.setValueAtTime(659.25, now + 0.1);
    osc.frequency.setValueAtTime(783.99, now + 0.2);
    osc.frequency.setValueAtTime(1046.50, now + 0.3);

    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

    osc.start(now);
    osc.stop(now + 0.6);
  } else if (type === 'add') {
    osc.type = 'sine';
    osc.frequency.setValueAtTime(400, now);
    osc.frequency.exponentialRampToValueAtTime(800, now + 0.08);

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);

    osc.start(now);
    osc.stop(now + 0.08);
  } else if (type === 'levelup') {
    osc.type = 'square';
    osc.frequency.setValueAtTime(440, now);
    osc.frequency.setValueAtTime(554.37, now + 0.15);
    osc.frequency.setValueAtTime(659.25, now + 0.3);
    osc.frequency.setValueAtTime(880, now + 0.45);

    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.9);

    osc.start(now);
    osc.stop(now + 0.9);
  } else if (type === 'pomo-end') {
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.setValueAtTime(1174.66, now + 0.2);

    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);

    osc.start(now);
    osc.stop(now + 0.5);
  }
}

// Initialization
document.addEventListener('DOMContentLoaded', () => {
  const savedTheme = localStorage.getItem('theme') || 'dark';
  setTheme(savedTheme);
  checkStreakValidity();
  checkWeeklyReset();
  initChart();
  setupFilterListeners();
  setupBackupListeners();
  setupPomodoroControls();
  setupGoalEditListener();
  updateUI();
});

// 🎯 Weekly Goal Reset Check
function checkWeeklyReset() {
  const currentWeek = getWeekNumber(new Date());
  if (userStats.lastResetWeek !== currentWeek) {
    userStats.weeklyProgress = 0;
    userStats.lastResetWeek = currentWeek;
    localStorage.setItem('workflow_user_stats', JSON.stringify(userStats));
  }
}

function getWeekNumber(d) {
  d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

// Streak Verification
function checkStreakValidity() {
  if (!userStats.lastCompletedDate) return;

  const todayStr = new Date().toISOString().split('T')[0];
  const lastDate = new Date(userStats.lastCompletedDate);
  const today = new Date(todayStr);

  const diffTime = Math.abs(today - lastDate);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays > 1) {
    userStats.streak = 0;
    localStorage.setItem('workflow_user_stats', JSON.stringify(userStats));
  }
}

function updateStreakOnCompletion() {
  const todayStr = new Date().toISOString().split('T')[0];

  if (!userStats.lastCompletedDate) {
    userStats.streak = 1;
  } else {
    const lastDate = new Date(userStats.lastCompletedDate);
    const today = new Date(todayStr);
    const diffTime = Math.abs(today - lastDate);
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 1) {
      userStats.streak += 1;
    } else if (diffDays > 1) {
      userStats.streak = 1;
    }
  }

  userStats.lastCompletedDate = todayStr;
}

// Theme Switcher
const themeBtn = document.getElementById('theme-toggle');
themeBtn.addEventListener('click', () => {
  const isLight = document.body.classList.contains('light-theme');
  setTheme(isLight ? 'dark' : 'light');
});

function setTheme(theme) {
  if (theme === 'light') {
    document.body.classList.add('light-theme');
    themeBtn.innerText = '🌙 Dark';
  } else {
    document.body.classList.remove('light-theme');
    themeBtn.innerText = '☀️ Light';
  }
  localStorage.setItem('theme', theme);
}

// Slider Live Updates
document.getElementById('impact').oninput = (e) => {
  document.getElementById('impact-val').innerText = e.target.value;
};
document.getElementById('confidence').oninput = (e) => {
  document.getElementById('conf-val').innerText = e.target.value + '%';
};

// Add Task
document.getElementById('task-form').onsubmit = (e) => {
  e.preventDefault();
  playSound('add');

  const title = document.getElementById('title').value;
  const tag = document.getElementById('tag').value;
  const impact = parseFloat(document.getElementById('impact').value);
  const confidence = parseFloat(document.getElementById('confidence').value);
  const effort = parseFloat(document.getElementById('effort').value);
  const dueDateInput = document.getElementById('due-date').value;
  const dueDate = new Date(dueDateInput);

  const hoursToDue = (dueDate - new Date()) / (1000 * 60 * 60);
  const urgencyBonus = (hoursToDue <= 48 && hoursToDue > 0) ? 15 : 0;
  const score = Math.round(((impact * 20) * (confidence / 100)) / Math.max(effort, 0.5) + urgencyBonus);

  tasks.push({ 
    id: Date.now(), 
    title, 
    tag,
    impact, 
    effort, 
    score, 
    dueDateISO: dueDateInput,
    dueDate: dueDate.toLocaleDateString() 
  });

  saveAndRender();
  e.target.reset();
  
  document.getElementById('impact-val').innerText = '3';
  document.getElementById('conf-val').innerText = '80%';
};

// Complete Task
function deleteTask(id) {
  const completedTask = tasks.find(t => t.id === id);
  if (completedTask) {
    updateStreakOnCompletion();

    userStats.weeklyProgress = (userStats.weeklyProgress || 0) + 1;

    const multiplier = userStats.streak >= 2 ? 1.5 : 1.0;
    let baseXP = 20;
    if (completedTask.score >= 40) baseXP = 100;
    else if (completedTask.score >= 20) baseXP = 50;

    const earnedXP = Math.round(baseXP * multiplier);
    const oldLevel = Math.floor(userStats.xp / 500) + 1;

    userStats.xp += earnedXP;
    const newLevel = Math.floor(userStats.xp / 500) + 1;

    const today = new Date().toISOString().split('T')[0];
    if (!userStats.dailyHistory[today]) {
      userStats.dailyHistory[today] = { impactSum: 0, effortSum: 0 };
    }
    userStats.dailyHistory[today].impactSum += completedTask.impact;
    userStats.dailyHistory[today].effortSum += completedTask.effort;

    triggerConfetti();

    if (newLevel > oldLevel) {
      setTimeout(() => triggerLevelUpModal(newLevel), 300);
    } else {
      playSound('complete');
    }
  }

  tasks = tasks.filter(task => task.id !== id);
  saveAndRender();
}

// Clear All Tasks
document.getElementById('clear-all-btn').addEventListener('click', () => {
  if (tasks.length === 0) return;
  if (confirm('Are you sure you want to clear all active tasks?')) {
    tasks = [];
    saveAndRender();
  }
});

// Storage and UI Refresh
function saveAndRender() {
  tasks.sort((a, b) => b.score - a.score);
  localStorage.setItem('workflow_tasks', JSON.stringify(tasks));
  localStorage.setItem('workflow_user_stats', JSON.stringify(userStats));
  updateUI();
}

function updateUI() {
  renderTaskList();
  updateGamificationDashboard();
  updateWeeklyGoalTracker();
  updateChartData();
}

// Filters setup
function setupFilterListeners() {
  const filterBtns = document.querySelectorAll('.filter-btn');
  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeFilter = btn.getAttribute('data-filter');
      renderTaskList();
    });
  });

  const tagBtns = document.querySelectorAll('.tag-filter-btn');
  tagBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      tagBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeTag = btn.getAttribute('data-tag');
      renderTaskList();
    });
  });
}

function renderTaskList() {
  const taskList = document.getElementById('task-list');
  taskList.innerHTML = '';

  const filteredTasks = tasks.filter(task => {
    let matchesPriority = true;
    if (activeFilter === 'high') matchesPriority = task.score >= 40;
    else if (activeFilter === 'med') matchesPriority = task.score >= 20 && task.score < 40;
    else if (activeFilter === 'low') matchesPriority = task.score < 20;

    let matchesTag = activeTag === 'all' || task.tag === activeTag;

    return matchesPriority && matchesTag;
  });

  if (filteredTasks.length === 0) {
    taskList.innerHTML = `<p style="color: var(--text-muted); font-size: 0.9rem; text-align: center; padding: 12px;">No matching tasks found.</p>`;
    return;
  }

  filteredTasks.forEach(task => {
    let badgeClass = 'low';
    let badgeText = '💡 Backlog (+20 XP)';
    if (task.score >= 40) { 
      badgeClass = 'high'; 
      badgeText = '🔥 Do First (+100 XP)'; 
    } else if (task.score >= 20) { 
      badgeClass = 'med'; 
      badgeText = '📅 Schedule (+50 XP)'; 
    }

    const tagEmoji = { Work: '💼', Personal: '👤', Study: '📚', Health: '🏋️' }[task.tag] || '🏷️';
    
    // Calendar Links
    const gCalUrl = createGoogleCalendarUrl(task);
    const icsData = createIcalDataUrl(task);

    taskList.innerHTML += `
      <div class="task-item">
        <div class="task-header">
          <div>
            <strong>${escapeHtml(task.title)}</strong>
            <span class="tag-label">${tagEmoji} ${task.tag || 'General'}</span>
          </div>
          <span class="badge ${badgeClass}">${badgeText}</span>
        </div>
        <div class="task-footer">
          <span class="task-details">Effort: ${task.effort}h | Due: ${task.dueDate}</span>
          <div class="task-actions">
            <button class="action-btn" onclick="attachToPomo('${escapeHtml(task.title)}')">⏱️ Focus</button>
            <a href="${gCalUrl}" target="_blank" class="action-btn" title="Add to Google Calendar">📅 GCal</a>
            <a href="${icsData}" download="${task.title}.ics" class="action-btn" title="Download iCal .ics file">📥 iCal</a>
            <button class="delete-btn" onclick="deleteTask(${task.id})">✓ Complete</button>
          </div>
        </div>
      </div>
    `;
  });
}

function escapeHtml(str) {
  return str.replace(/[&<>"']/g, function(m) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m];
  });
}

// 📅 Calendar URL Generators
function createGoogleCalendarUrl(task) {
  const dateStr = (task.dueDateISO || new Date().toISOString().split('T')[0]).replace(/-/g, '');
  const title = encodeURIComponent(`PrioMatrix Task: ${task.title}`);
  const details = encodeURIComponent(`Priority Score: ${task.score} | Estimated Effort: ${task.effort} hours.`);
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${dateStr}/${dateStr}&details=${details}`;
}

function createIcalDataUrl(task) {
  const dateStr = (task.dueDateISO || new Date().toISOString().split('T')[0]).replace(/-/g, '');
  const icsContent = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
SUMMARY:${task.title}
DESCRIPTION:Priority Score: ${task.score} | Effort: ${task.effort}h
DTSTART;VALUE=DATE:${dateStr}
END:VEVENT
END:VCALENDAR`;
  return 'data:text/calendar;charset=utf8,' + encodeURIComponent(icsContent);
}

// 🎯 Weekly Goal Tracker UI Update
function updateWeeklyGoalTracker() {
  const target = userStats.weeklyTarget || 10;
  const progress = userStats.weeklyProgress || 0;
  const pct = Math.min(Math.round((progress / target) * 100), 100);

  document.getElementById('goal-target-num').innerText = target;
  document.getElementById('goal-fill').style.width = `${pct}%`;
  document.getElementById('goal-text').innerText = `${progress} / ${target} tasks completed this week`;
  document.getElementById('goal-percent').innerText = `${pct}%`;
}

function setupGoalEditListener() {
  document.getElementById('edit-goal-btn').addEventListener('click', () => {
    const newTarget = prompt('Set your weekly target completed tasks:', userStats.weeklyTarget || 10);
    if (newTarget && !isNaN(newTarget) && parseInt(newTarget) > 0) {
      userStats.weeklyTarget = parseInt(newTarget);
      saveAndRender();
    }
  });
}

// ⏱️ Pomodoro Focus Timer Logic
function setupPomodoroControls() {
  document.getElementById('pomo-start-btn').addEventListener('click', startPomoTimer);
  document.getElementById('pomo-pause-btn').addEventListener('click', pausePomoTimer);
  document.getElementById('pomo-reset-btn').addEventListener('click', resetPomoTimer);
}

function attachToPomo(taskTitle) {
  activePomoTask = taskTitle;
  document.getElementById('pomo-task-name').innerText = `Active Task: ${taskTitle}`;
  resetPomoTimer();
}

function startPomoTimer() {
  if (pomoTimerId) return;
  initAudio();
  
  document.getElementById('pomo-start-btn').style.display = 'none';
  document.getElementById('pomo-pause-btn').style.display = 'inline-block';

  pomoTimerId = setInterval(() => {
    pomoTimeLeft--;
    updatePomoDisplay();

    if (pomoTimeLeft <= 0) {
      clearInterval(pomoTimerId);
      pomoTimerId = null;
      playSound('pomo-end');

      if (pomoIsWork) {
        alert('Work Session Finished! Time for a 5-minute break.');
        pomoIsWork = false;
        pomoTimeLeft = 5 * 60;
        document.getElementById('pomo-status').innerText = '5m Break';
        document.getElementById('pomo-status').style.background = '#10b981';
      } else {
        alert('Break Over! Ready to lock back in?');
        pomoIsWork = true;
        pomoTimeLeft = 25 * 60;
        document.getElementById('pomo-status').innerText = 'Work Session';
        document.getElementById('pomo-status').style.background = '#38bdf8';
      }
      resetPomoTimer();
    }
  }, 1000);
}

function pausePomoTimer() {
  clearInterval(pomoTimerId);
  pomoTimerId = null;
  document.getElementById('pomo-start-btn').style.display = 'inline-block';
  document.getElementById('pomo-pause-btn').style.display = 'none';
}

function resetPomoTimer() {
  pausePomoTimer();
  pomoIsWork = true;
  pomoTimeLeft = 25 * 60;
  document.getElementById('pomo-status').innerText = 'Work Session';
  document.getElementById('pomo-status').style.background = '#38bdf8';
  updatePomoDisplay();
}

function updatePomoDisplay() {
  const mins = Math.floor(pomoTimeLeft / 60);
  const secs = pomoTimeLeft % 60;
  document.getElementById('pomo-display').innerText = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function updateGamificationDashboard() {
  const newLevel = Math.floor(userStats.xp / 500) + 1;
  const currentLevelXP = userStats.xp % 500;
  const xpPct = (currentLevelXP / 500) * 100;

  userStats.level = newLevel;

  document.getElementById('total-xp').innerText = userStats.xp;
  document.getElementById('player-level').innerText = `Level ${newLevel}`;
  document.getElementById('xp-fill').style.width = `${xpPct}%`;
  document.getElementById('xp-next').innerText = `${currentLevelXP} / 500 XP to Level ${newLevel + 1}`;

  const titles = ['Novice Planner', 'Focus Apprentice', 'Priority Knight', 'Time Master', 'Efficiency Legend'];
  const rankTitle = titles[Math.min(newLevel - 1, titles.length - 1)];
  document.getElementById('player-title').innerText = `Rank: ${rankTitle}`;

  document.getElementById('streak-display').innerText = `🔥 ${userStats.streak} Day Streak`;
  const multiplier = userStats.streak >= 2 ? '1.5x XP' : '1.0x XP';
  document.getElementById('multiplier-badge').innerText = multiplier;
}

// Level Up Modal
function triggerLevelUpModal(level) {
  playSound('levelup');

  const titles = ['Novice Planner', 'Focus Apprentice', 'Priority Knight', 'Time Master', 'Efficiency Legend'];
  const rankTitle = titles[Math.min(level - 1, titles.length - 1)];

  document.getElementById('modal-level-title').innerText = `Level ${level}!`;
  document.getElementById('modal-rank-text').innerText = `Rank: ${rankTitle}`;

  const modal = document.getElementById('levelup-modal');
  modal.classList.remove('hidden');

  document.getElementById('modal-close-btn').onclick = () => {
    modal.classList.add('hidden');
  };
}

// Backup & Import
function setupBackupListeners() {
  document.getElementById('export-btn').addEventListener('click', exportBackupJSON);
  const importInput = document.getElementById('import-file');
  document.getElementById('import-btn-trigger').addEventListener('click', () => importInput.click());
  importInput.addEventListener('change', importBackupJSON);
}

function exportBackupJSON() {
  const data = { tasks, userStats, exportDate: new Date().toISOString() };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `priomatrix_backup_${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function importBackupJSON(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (event) => {
    try {
      const parsed = JSON.parse(event.target.result);
      if (parsed.tasks && parsed.userStats) {
        tasks = parsed.tasks;
        userStats = parsed.userStats;
        saveAndRender();
        alert('Data successfully restored!');
      } else {
        alert('Invalid backup file format.');
      }
    } catch (err) {
      alert('Error parsing JSON file.');
    }
  };
  reader.readAsText(file);
}

// Chart.js Setup
function initChart() {
  const ctx = document.getElementById('efficiencyChart').getContext('2d');
  chartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: [],
      datasets: [{
        label: 'Efficiency Rate (%)',
        data: [],
        backgroundColor: '#38bdf8',
        borderRadius: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: { beginAtZero: true, max: 100, ticks: { color: '#94a3b8' } },
        x: { ticks: { color: '#94a3b8' } }
      },
      plugins: { legend: { display: false } }
    }
  });
}

function updateChartData() {
  if (!chartInstance) return;

  const labels = [];
  const scores = [];

  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });

    labels.push(dayName);

    const record = userStats.dailyHistory[dateStr];
    if (record && record.effortSum > 0) {
      const rate = Math.min(Math.round((record.impactSum / record.effortSum) * 20), 100);
      scores.push(rate);
    } else {
      scores.push(0);
    }
  }

  chartInstance.data.labels = labels;
  chartInstance.data.datasets[0].data = scores;
  chartInstance.update();

  const todayScore = scores[6] || 0;
  document.getElementById('today-efficiency').innerText = `Today: ${todayScore}%`;
}

// Confetti Particle Engine
function triggerConfetti() {
  const canvas = document.getElementById('confetti-canvas');
  const ctx = canvas.getContext('2d');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const particles = Array.from({ length: 50 }, () => ({
    x: canvas.width / 2,
    y: canvas.height / 2,
    vx: (Math.random() - 0.5) * 12,
    vy: (Math.random() - 0.5) * 12 - 4,
    color: ['#fbbf24', '#38bdf8', '#10b981', '#8b5cf6'][Math.floor(Math.random() * 4)],
    size: Math.random() * 6 + 4
  }));

  let frame = 0;
  function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.2;
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x, p.y, p.size, p.size);
    });
    if (++frame < 50) {
      requestAnimationFrame(animate);
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }
  animate();
}
