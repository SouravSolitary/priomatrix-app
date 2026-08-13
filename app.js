let tasks = JSON.parse(localStorage.getItem('workflow_tasks')) || [];
let userStats = JSON.parse(localStorage.getItem('workflow_user_stats')) || { xp: 0, level: 1, dailyHistory: {} };

let chartInstance = null;

document.addEventListener('DOMContentLoaded', () => {
  const savedTheme = localStorage.getItem('theme') || 'dark';
  setTheme(savedTheme);
  initChart();
  updateUI();
});

// Theme Switcher
const themeBtn = document.getElementById('theme-toggle');
themeBtn.addEventListener('click', () => {
  const currentTheme = document.body.classList.contains('light-theme') ? 'light' : 'dark';
  setTheme(currentTheme === 'dark' ? 'light' : 'dark');
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

// Live Sliders
document.getElementById('impact').oninput = (e) => document.getElementById('impact-val').innerText = e.target.value;
document.getElementById('confidence').oninput = (e) => document.getElementById('conf-val').innerText = e.target.value + '%';

// Add Task
document.getElementById('task-form').onsubmit = (e) => {
  e.preventDefault();
  
  const title = document.getElementById('title').value;
  const impact = parseFloat(document.getElementById('impact').value);
  const confidence = parseFloat(document.getElementById('confidence').value);
  const effort = parseFloat(document.getElementById('effort').value);
  const dueDateInput = document.getElementById('due-date').value;
  const dueDate = new Date(dueDateInput);

  const hoursToDue = (dueDate - new Date()) / (1000 * 60 * 60);
  const urgencyBonus = hoursToDue <= 48 && hoursToDue > 0 ? 15 : 0;
  const score = Math.round(((impact * 20) * (confidence / 100)) / Math.max(effort, 0.5) + urgencyBonus);

  tasks.push({ id: Date.now(), title, impact, effort, score, dueDate: dueDate.toLocaleDateString() });
  saveAndRender();
  e.target.reset();
};

// Complete Task & Award Reward Points (XP)
function deleteTask(id) {
  const completedTask = tasks.find(t => t.id === id);
  if (completedTask) {
    // 🏆 Reward Points Logic
    let earnedXP = 20;
    if (completedTask.score >= 40) earnedXP = 100;
    else if (completedTask.score >= 20) earnedXP = 50;

    userStats.xp += earnedXP;

    // Track Daily Efficiency Score
    const today = new Date().toISOString().split('T')[0];
    if (!userStats.dailyHistory[today]) userStats.dailyHistory[today] = { impactSum: 0, effortSum: 0 };
    userStats.dailyHistory[today].impactSum += completedTask.impact;
    userStats.dailyHistory[today].effortSum += completedTask.effort;

    triggerConfetti();
  }

  tasks = tasks.filter(task => task.id !== id);
  saveAndRender();
}

// Clear All
document.getElementById('clear-all-btn').addEventListener('click', () => {
  if (tasks.length === 0) return;
  if (confirm('Are you sure you want to clear all active tasks?')) {
    tasks = [];
    saveAndRender();
  }
});

function saveAndRender() {
  tasks.sort((a, b) => b.score - a.score);
  localStorage.setItem('workflow_tasks', JSON.stringify(tasks));
  localStorage.setItem('workflow_user_stats', JSON.stringify(userStats));
  updateUI();
}

function updateUI() {
  const taskList = document.getElementById('task-list');
  taskList.innerHTML = '';

  if (tasks.length === 0) {
    taskList.innerHTML = `<p style="color: var(--text-muted); font-size: 0.9rem; text-align: center; padding: 10px;">No active tasks. Time to add new goals!</p>`;
  }

  tasks.forEach(task => {
    let badgeClass = 'low';
    let badgeText = '💡 Backlog (+20 XP)';
    if (task.score >= 40) { badgeClass = 'high'; badgeText = '🔥 Do First (+100 XP)'; }
    else if (task.score >= 20) { badgeClass = 'med'; badgeText = '📅 Schedule (+50 XP)'; }

    taskList.innerHTML += `
      <div class="task-item">
        <div class="task-header">
          <strong>${task.title}</strong>
          <span class="badge ${badgeClass}">${badgeText}</span>
        </div>
        <div class="task-footer">
          <span class="task-details">Effort: ${task.effort}h | Due: ${task.dueDate}</span>
          <button class="delete-btn" onclick="deleteTask(${task.id})">✓ Complete</button>
        </div>
      </div>
    `;
  });

  updateGamificationDashboard();
  updateChartData();
}

function updateGamificationDashboard() {
  // Level Calculation: Level up every 500 XP
  const newLevel = Math.floor(userStats.xp / 500) + 1;
  const currentLevelXP = userStats.xp % 500;
  const xpPct = (currentLevelXP / 500) * 100;

  userStats.level = newLevel;

  document.getElementById('total-xp').innerText = userStats.xp;
  document.getElementById('player-level').innerText = `Level ${newLevel}`;
  document.getElementById('xp-fill').style.width = `${xpPct}%`;
  document.getElementById('xp-next').innerText = `${currentLevelXP} / 500 XP to Level ${newLevel + 1}`;

  // Title ranks
  const titles = ['Novice Planner', 'Focus Apprentice', 'Priority Knight', 'Time Master', 'Efficiency Legend'];
  const rankTitle = titles[Math.min(newLevel - 1, titles.length - 1)];
  document.getElementById('player-title').innerText = `Rank: ${rankTitle}`;
}

// Initialize Chart.js Bar Chart
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

  // Get last 7 days dates
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });

    labels.push(dayName);

    const record = userStats.dailyHistory[dateStr];
    if (record && record.effortSum > 0) {
      // Efficiency ratio: (Impact Sum / Effort Sum) converted to 0-100% scale
      const rate = Math.min(Math.round((record.impactSum / record.effortSum) * 20), 100);
      scores.push(rate);
    } else {
      scores.push(0);
    }
  }

  chartInstance.data.labels = labels;
  chartInstance.data.datasets[0].data = scores;
  chartInstance.update();

  const todayStr = new Date().toISOString().split('T')[0];
  const todayScore = scores[6] || 0;
  document.getElementById('today-efficiency').innerText = `Today: ${todayScore}%`;
}

function triggerConfetti() {
  const canvas = document.getElementById('confetti-canvas');
  const ctx = canvas.getContext('2d');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const particles = Array.from({ length: 50 }, () => ({
    x: canvas.width / 2, y: canvas.height / 2,
    vx: (Math.random() - 0.5) * 12, vy: (Math.random() - 0.5) * 12 - 4,
    color: ['#fbbf24', '#38bdf8', '#10b981', '#8b5cf6'][Math.floor(Math.random() * 4)],
    size: Math.random() * 6 + 4
  }));

  let frame = 0;
  function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach(p => {
      p.x += p.vx; p.y += p.vy; p.vy += 0.2;
      ctx.fillStyle = p.color; ctx.fillRect(p.x, p.y, p.size, p.size);
    });
    if (++frame < 50) requestAnimationFrame(animate);
    else ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
  animate();
}
