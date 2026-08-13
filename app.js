let tasks = JSON.parse(localStorage.getItem('workflow_tasks')) || [];
const MAX_CAPACITY = 40;

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
  // Restore Theme Choice
  const savedTheme = localStorage.getItem('theme') || 'dark';
  setTheme(savedTheme);

  updateUI();
});

// Theme Switcher Logic
const themeBtn = document.getElementById('theme-toggle');
themeBtn.addEventListener('click', () => {
  const currentTheme = document.body.classList.contains('light-theme') ? 'light' : 'dark';
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
  setTheme(newTheme);
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

// Delete Single Task
function deleteTask(id) {
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

function saveAndRender() {
  tasks.sort((a, b) => b.score - a.score);
  localStorage.setItem('workflow_tasks', JSON.stringify(tasks));
  updateUI();
}

function updateUI() {
  const taskList = document.getElementById('task-list');
  taskList.innerHTML = '';

  let totalEffort = 0;

  if (tasks.length === 0) {
    taskList.innerHTML = `<p style="color: var(--text-muted); font-size: 0.9rem; text-align: center; padding: 10px;">No active tasks. Add one above!</p>`;
  }

  tasks.forEach(task => {
    totalEffort += task.effort;
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
          <button class="delete-btn" onclick="deleteTask(${task.id})">Delete</button>
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
