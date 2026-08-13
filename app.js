let tasks = JSON.parse(localStorage.getItem('workflow_tasks')) || [];
const MAX_CAPACITY = 40;
let currentFilter = 'all';
let searchQuery = '';

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
  const savedTheme = localStorage.getItem('theme') || 'dark';
  setTheme(savedTheme);
  updateUI();
  registerServiceWorker();
});

// Theme Switcher Logic
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

  tasks.push({ id: Date.now(), title, score, effort, dueDate: dueDate.toLocaleDateString() });
  saveAndRender();
  e.target.reset();
};

// Complete Task + Trigger Confetti
function deleteTask(id) {
  triggerConfetti();
  tasks = tasks.filter(task => task.id !== id);
  saveAndRender();
}

// Clear All Tasks
document.getElementById('clear-all-btn').addEventListener('click', () => {
  if (tasks.length === 0) return;
  if (confirm('Are you sure you want to clear all tasks?')) {
    tasks = [];
    saveAndRender();
  }
});

// Filter & Search Handlers
document.getElementById('search-input').addEventListener('input', (e) => {
  searchQuery = e.target.value.toLowerCase();
  updateUI();
});

document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    e.target.classList.add('active');
    currentFilter = e.target.dataset.filter;
    updateUI();
  });
});

// CSV Export
document.getElementById('export-csv-btn').addEventListener('click', () => {
  if (tasks.length === 0) return alert('No tasks to export!');
  let csv = 'Title,Score,Effort (hrs),Due Date\n';
  tasks.forEach(t => csv += `"${t.title}",${t.score},${t.effort},"${t.dueDate}"\n`);
  downloadFile(csv, 'priomatrix_tasks.csv', 'text/csv');
});

// JSON Backup Export
document.getElementById('export-json-btn').addEventListener('click', () => {
  if (tasks.length === 0) return alert('No tasks to export!');
  downloadFile(JSON.stringify(tasks, null, 2), 'priomatrix_backup.json', 'application/json');
});

function downloadFile(content, fileName, type) {
  const blob = new Blob([content], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = fileName;
  a.click();
}

function saveAndRender() {
  tasks.sort((a, b) => b.score - a.score);
  localStorage.setItem('workflow_tasks', JSON.stringify(tasks));
  updateUI();
}

function updateUI() {
  const taskList = document.getElementById('task-list');
  taskList.innerHTML = '';

  let totalEffort = 0;

  // Apply Filter & Search
  const filteredTasks = tasks.filter(task => {
    const matchesSearch = task.title.toLowerCase().includes(searchQuery);
    let matchesCategory = true;
    if (currentFilter === 'high') matchesCategory = task.score >= 40;
    else if (currentFilter === 'med') matchesCategory = task.score >= 20 && task.score < 40;
    else if (currentFilter === 'low') matchesCategory = task.score < 20;
    return matchesSearch && matchesCategory;
  });

  if (filteredTasks.length === 0) {
    taskList.innerHTML = `<p style="color: var(--text-muted); font-size: 0.9rem; text-align: center; padding: 15px;">No tasks found.</p>`;
  }

  tasks.forEach(task => totalEffort += task.effort);

  filteredTasks.forEach(task => {
    let badgeClass = 'low';
    let badgeText = '💡 Backlog';
    if (task.score >= 40) { badgeClass = 'high'; badgeText = '🔥 Do First'; }
    else if (task.score >= 20) { badgeClass = 'med'; badgeText = '📅 Schedule'; }

    taskList.innerHTML += `
      <div class="task-item">
        <div class="task-header">
          <strong>${task.title}</strong>
          <span class="badge ${badgeClass}">${badgeText} (${task.score})</span>
        </div>
        <div class="task-footer">
          <span class="task-details">Effort: ${task.effort}h | Due: ${task.dueDate}</span>
          <button class="delete-btn" onclick="deleteTask(${task.id})">✓ Done</button>
        </div>
      </div>
    `;
  });

  document.getElementById('capacity-text').innerText = `${totalEffort} / ${MAX_CAPACITY} hrs`;
  const fillPct = Math.min((totalEffort / MAX_CAPACITY) * 100, 100);
  const fillElem = document.getElementById('progress-fill');
  fillElem.style.width = fillPct + '%';
  fillElem.style.background = totalEffort > MAX_CAPACITY ? '#ef4444' : '#10b981';
}

// Confetti Effect Trigger
function triggerConfetti() {
  const canvas = document.getElementById('confetti-canvas');
  const ctx = canvas.getContext('2d');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const particles = Array.from({ length: 40 }, () => ({
    x: canvas.width / 2,
    y: canvas.height / 2,
    vx: (Math.random() - 0.5) * 10,
    vy: (Math.random() - 0.5) * 10 - 3,
    color: ['#10b981', '#38bdf8', '#f59e0b', '#ef4444'][Math.floor(Math.random() * 4)],
    size: Math.random() * 6 + 4
  }));

  let frame = 0;
  function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.2; // gravity
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x, p.y, p.size, p.size);
    });
    if (++frame < 50) requestAnimationFrame(animate);
    else ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
  animate();
}

// Offline PWA Service Worker Registration
function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}
