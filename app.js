let tasks = JSON.parse(localStorage.getItem('workflow_tasks')) || [];
let stats = JSON.parse(localStorage.getItem('workflow_stats')) || { completed: 0, hoursSaved: 0, focusMinutes: 0 };

const MAX_CAPACITY = 40;
let currentFilter = 'all';
let currentCategory = 'all';
let searchQuery = '';
let activeTimer = null;
let timerSeconds = 25 * 60;

document.addEventListener('DOMContentLoaded', () => {
  const savedTheme = localStorage.getItem('theme') || 'dark';
  setTheme(savedTheme);
  updateUI();
  registerServiceWorker();
});

// Theme Toggle
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

// Form Submit (Add or Edit Task)
document.getElementById('task-form').onsubmit = (e) => {
  e.preventDefault();
  
  const editId = document.getElementById('task-id').value;
  const title = document.getElementById('title').value;
  const category = document.getElementById('category').value;
  const impact = parseFloat(document.getElementById('impact').value);
  const confidence = parseFloat(document.getElementById('confidence').value);
  const effort = parseFloat(document.getElementById('effort').value);
  const dueDateInput = document.getElementById('due-date').value;
  const dueDate = new Date(dueDateInput);

  const hoursToDue = (dueDate - new Date()) / (1000 * 60 * 60);
  const urgencyBonus = hoursToDue <= 48 && hoursToDue > 0 ? 15 : 0;
  const score = Math.round(((impact * 20) * (confidence / 100)) / Math.max(effort, 0.5) + urgencyBonus);

  const rawSubtasks = document.getElementById('subtasks-input').value;
  const subtasks = rawSubtasks ? rawSubtasks.split(',').map(s => ({ title: s.trim(), done: false })) : [];

  if (editId) {
    tasks = tasks.map(t => t.id == editId ? { ...t, title, category, impact, confidence, effort, dueDate: dueDate.toLocaleDateString(), score, subtasks } : t);
  } else {
    tasks.push({ id: Date.now(), title, category, impact, confidence, effort, dueDate: dueDate.toLocaleDateString(), score, subtasks });
  }

  resetForm();
  saveAndRender();
};

// Edit Task Initiation
function editTask(id) {
  const task = tasks.find(t => t.id === id);
  if (!task) return;

  document.getElementById('task-id').value = task.id;
  document.getElementById('title').value = task.title;
  document.getElementById('category').value = task.category || 'Work';
  document.getElementById('impact').value = task.impact || 3;
  document.getElementById('confidence').value = task.confidence || 80;
  document.getElementById('effort').value = task.effort;
  document.getElementById('subtasks-input').value = task.subtasks ? task.subtasks.map(s => s.title).join(', ') : '';
  
  document.getElementById('form-title').innerText = 'Edit Task';
  document.getElementById('submit-btn').innerText = 'Update Task';
  document.getElementById('cancel-edit-btn').classList.remove('hidden');
}

document.getElementById('cancel-edit-btn').addEventListener('click', resetForm);

function resetForm() {
  document.getElementById('task-form').reset();
  document.getElementById('task-id').value = '';
  document.getElementById('form-title').innerText = 'Add New Task';
  document.getElementById('submit-btn').innerText = 'Calculate & Add Task';
  document.getElementById('cancel-edit-btn').classList.add('hidden');
}

// Subtask Toggle
function toggleSubtask(taskId, subtaskIndex) {
  const task = tasks.find(t => t.id === taskId);
  if (task && task.subtasks[subtaskIndex]) {
    task.subtasks[subtaskIndex].done = !task.subtasks[subtaskIndex].done;
    saveAndRender();
  }
}

// Complete Task
function deleteTask(id) {
  triggerConfetti();
  const completedTask = tasks.find(t => t.id === id);
  if (completedTask) {
    stats.completed += 1;
    stats.hoursSaved += completedTask.effort;
    localStorage.setItem('workflow_stats', JSON.stringify(stats));
  }
  tasks = tasks.filter(task => task.id !== id);
  saveAndRender();
}

// Focus Pomodoro Timer Logic
function startTimer(title) {
  clearInterval(activeTimer);
  timerSeconds = 25 * 60;
  
  document.getElementById('timer-task-title').innerText = `Focusing on: ${title}`;
  document.getElementById('timer-bar').classList.remove('hidden');
  
  activeTimer = setInterval(() => {
    timerSeconds--;
    stats.focusMinutes += 1/60;
    localStorage.setItem('workflow_stats', JSON.stringify(stats));
    updateTimerDisplay();

    if (timerSeconds <= 0) {
      clearInterval(activeTimer);
      alert('⏰ Pomodoro session completed! Take a 5-minute break.');
    }
  }, 1000);
}

function updateTimerDisplay() {
  const mins = Math.floor(timerSeconds / 60);
  const secs = timerSeconds % 60;
  document.getElementById('timer-display').innerText = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  document.getElementById('stat-focus').innerText = `${Math.round(stats.focusMinutes)}m`;
}

document.getElementById('stop-timer-btn').addEventListener('click', () => {
  clearInterval(activeTimer);
  document.getElementById('timer-bar').classList.add('hidden');
});

// Search & Filtering
document.getElementById('search-input').addEventListener('input', (e) => { searchQuery = e.target.value.toLowerCase(); updateUI(); });
document.querySelectorAll('.filter-btn').forEach(btn => btn.addEventListener('click', (e) => {
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  e.target.classList.add('active');
  currentFilter = e.target.dataset.filter;
  updateUI();
}));
document.querySelectorAll('.cat-filter-btn').forEach(btn => btn.addEventListener('click', (e) => {
  document.querySelectorAll('.cat-filter-btn').forEach(b => b.classList.remove('active'));
  e.target.classList.add('active');
  currentCategory = e.target.dataset.cat;
  updateUI();
}));

// Export & Storage
document.getElementById('export-csv-btn').addEventListener('click', () => {
  let csv = 'Title,Category,Score,Effort,DueDate\n';
  tasks.forEach(t => csv += `"${t.title}","${t.category}",${t.score},${t.effort},"${t.dueDate}"\n`);
  downloadFile(csv, 'priomatrix_tasks.csv', 'text/csv');
});
document.getElementById('export-json-btn').addEventListener('click', () => downloadFile(JSON.stringify(tasks, null, 2), 'priomatrix_backup.json', 'application/json'));

function downloadFile(content, fileName, type) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([content], { type }));
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

  // Stats Display
  document.getElementById('stat-completed').innerText = stats.completed;
  document.getElementById('stat-hours').innerText = `${stats.hoursSaved}h`;
  document.getElementById('stat-focus').innerText = `${Math.round(stats.focusMinutes)}m`;

  const filtered = tasks.filter(t => {
    const mSearch = t.title.toLowerCase().includes(searchQuery);
    let mCat = currentCategory === 'all' || t.category === currentCategory;
    let mPriority = true;
    if (currentFilter === 'high') mPriority = t.score >= 40;
    else if (currentFilter === 'med') mPriority = t.score >= 20 && t.score < 40;
    else if (currentFilter === 'low') mPriority = t.score < 20;
    return mSearch && mCat && mPriority;
  });

  tasks.forEach(t => totalEffort += t.effort);

  if (filtered.length === 0) taskList.innerHTML = `<p style="color: var(--text-muted); font-size: 0.9rem; text-align: center; padding: 15px;">No active tasks found.</p>`;

  filtered.forEach(task => {
    let badgeClass = task.score >= 40 ? 'high' : task.score >= 20 ? 'med' : 'low';
    let badgeText = task.score >= 40 ? '🔥 Do First' : task.score >= 20 ? '📅 Schedule' : '💡 Backlog';

    let subtasksHtml = '';
    if (task.subtasks && task.subtasks.length > 0) {
      subtasksHtml = `<ul class="subtask-list">` + task.subtasks.map((s, idx) => `
        <li class="subtask-item ${s.done ? 'completed' : ''}">
          <input type="checkbox" ${s.done ? 'checked' : ''} onchange="toggleSubtask(${task.id}, ${idx})">
          <span>${s.title}</span>
        </li>
      `).join('') + `</ul>`;
    }

    taskList.innerHTML += `
      <div class="task-item">
        <div class="task-header">
          <div>
            <strong>${task.title}</strong>
            <span class="tag">${task.category || 'Work'}</span>
          </div>
          <span class="badge ${badgeClass}">${badgeText} (${task.score})</span>
        </div>
        ${subtasksHtml}
        <div class="task-footer">
          <span class="task-details">Effort: ${task.effort}h | Due: ${task.dueDate}</span>
          <div class="task-actions">
            <button class="timer-btn" onclick="startTimer('${task.title}')">⏱️ Focus</button>
            <button class="edit-btn" onclick="editTask(${task.id})">✏️</button>
            <button class="delete-btn" onclick="deleteTask(${task.id})">✓ Done</button>
          </div>
        </div>
      </div>
    `;
  });

  document.getElementById('capacity-text').innerText = `${totalEffort} / ${MAX_CAPACITY} hrs`;
  const fillElem = document.getElementById('progress-fill');
  fillElem.style.width = Math.min((totalEffort / MAX_CAPACITY) * 100, 100) + '%';
  fillElem.style.background = totalEffort > MAX_CAPACITY ? '#ef4444' : '#10b981';
}

function triggerConfetti() {
  const canvas = document.getElementById('confetti-canvas');
  const ctx = canvas.getContext('2d');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  const particles = Array.from({ length: 40 }, () => ({
    x: canvas.width / 2, y: canvas.height / 2,
    vx: (Math.random() - 0.5) * 10, vy: (Math.random() - 0.5) * 10 - 3,
    color: ['#10b981', '#38bdf8', '#f59e0b', '#ef4444'][Math.floor(Math.random() * 4)],
    size: Math.random() * 6 + 4
  }));
  let frame = 0;
  function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach(p => { p.x += p.vx; p.y += p.vy; p.vy += 0.2; ctx.fillStyle = p.color; ctx.fillRect(p.x, p.y, p.size, p.size); });
    if (++frame < 50) requestAnimationFrame(animate); else ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
  animate();
}

function registerServiceWorker() {
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
}
