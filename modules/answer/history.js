// History Page Logic

let allHistory = {};
let filteredHistory = {};
let currentTabId = 1;

// Load current tab ID from storage
async function loadCurrentTabId() {
  const data = await chrome.storage.local.get(['currentTabId']);
  currentTabId = data.currentTabId || 1;
  console.log('[History] Current tab ID:', currentTabId);
}

// Load history from storage (tab-isolated)
async function loadHistory() {
  await loadCurrentTabId();
  const data = await chrome.storage.local.get(null);

  // Filter only history keys for current tab
  const historyPrefix = `tab_${currentTabId}_history_`;
  allHistory = {};
  Object.keys(data).forEach(key => {
    if (key.startsWith(historyPrefix)) {
      allHistory[key] = data[key];
    }
  });

  filteredHistory = { ...allHistory };
  renderHistory();
  updateStats();
}

// Render history timeline
function renderHistory() {
  const timeline = document.getElementById('timeline');

  if (Object.keys(filteredHistory).length === 0) {
    timeline.innerHTML = `
      <div class="timeline-empty">
        <i class="fas fa-history"></i>
        <p>История пуста</p>
      </div>
    `;
    return;
  }

  // Sort dates descending
  const sortedDates = Object.keys(filteredHistory).sort((a, b) => {
    return b.localeCompare(a);
  });

  let html = '';
  sortedDates.forEach(dateKey => {
    // Extract date from key: tab_{id}_history_{date} -> {date}
    const date = dateKey.split('_history_')[1];
    const entries = filteredHistory[dateKey];

    if (!entries || entries.length === 0) return;

    const dateObj = new Date(date);
    const formattedDate = formatDate(dateObj);

    html += `
      <div class="day-group">
        <div class="day-header">
          <i class="fas fa-calendar-day"></i>
          ${formattedDate}
          <span style="color: var(--text-secondary); font-size: 14px; font-weight: 400;">
            (${entries.length} ${plural(entries.length, 'запись', 'записи', 'записей')})
          </span>
        </div>
    `;

    // Reverse entries to show newest first
    const reversedEntries = [...entries].reverse();
    reversedEntries.forEach((entry, reversedIndex) => {
      const originalIndex = entries.length - 1 - reversedIndex;
      html += `
        <div class="entry">
          <div class="entry-header">
            <div class="entry-time">
              <i class="fas fa-clock"></i>
              ${entry.time}
            </div>
            <div class="entry-actions">
              <button class="icon-btn copy-btn" data-index="${originalIndex}" data-date="${dateKey}" title="Копировать ответ">
                <i class="fas fa-copy"></i>
              </button>
              <button class="icon-btn delete-btn" data-index="${originalIndex}" data-date="${dateKey}" title="Удалить">
                <i class="fas fa-trash"></i>
              </button>
            </div>
          </div>
          <div class="entry-question">
            <strong>Вопрос:</strong>
            ${escapeHtml(entry.question)}
          </div>
          <div class="entry-answer">
            <strong>Ответ:</strong>
            ${escapeHtml(entry.answer)}
          </div>
        </div>
      `;
    });

    html += '</div>';
  });

  timeline.innerHTML = html;

  // Attach event listeners to copy/delete buttons
  attachEventListeners();
}

// Update statistics
function updateStats() {
  let total = 0;
  let weekCount = 0;
  let todayCount = 0;

  const today = new Date();
  const todayKey = `tab_${currentTabId}_history_${formatDateKey(today)}`;
  const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

  Object.keys(allHistory).forEach(key => {
    const entries = allHistory[key];
    total += entries.length;

    if (key === todayKey) {
      todayCount += entries.length;
    }

    // Extract date from key: tab_{id}_history_{date} -> {date}
    const dateStr = key.split('_history_')[1];
    const date = new Date(dateStr);
    if (date >= weekAgo) {
      weekCount += entries.length;
    }
  });

  document.getElementById('totalCount').textContent = total;
  document.getElementById('weekCount').textContent = weekCount;
  document.getElementById('todayCount').textContent = todayCount;
}

// Attach event listeners to buttons
function attachEventListeners() {
  // Copy buttons
  document.querySelectorAll('.copy-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      const index = btn.dataset.index;
      const dateKey = btn.dataset.date;
      await copyEntry(index, dateKey);
    });
  });

  // Delete buttons
  document.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      const index = btn.dataset.index;
      const dateKey = btn.dataset.date;
      await deleteEntry(index, dateKey);
    });
  });
}

// Search functionality
function searchHistory(query) {
  if (!query.trim()) {
    filteredHistory = { ...allHistory };
  } else {
    const lowerQuery = query.toLowerCase();
    filteredHistory = {};

    Object.keys(allHistory).forEach(dateKey => {
      const filtered = allHistory[dateKey].filter(entry => {
        return entry.question.toLowerCase().includes(lowerQuery) ||
               entry.answer.toLowerCase().includes(lowerQuery);
      });

      if (filtered.length > 0) {
        filteredHistory[dateKey] = filtered;
      }
    });
  }

  renderHistory();
}

// Copy entry answer and question
async function copyEntry(index, dateKey) {
  try {
    if (!allHistory[dateKey] || !allHistory[dateKey][index]) {
      alert('Запись не найдена');
      return;
    }

    const entry = allHistory[dateKey][index];
    const textToCopy = `Вопрос: ${entry.question}\n\nОтвет: ${entry.answer}`;

    await navigator.clipboard.writeText(textToCopy);

    // Visual feedback - find and update the button
    const button = document.querySelector(`.copy-btn[data-index="${index}"][data-date="${dateKey}"]`);
    if (button) {
      const originalHTML = button.innerHTML;
      button.innerHTML = '<i class="fas fa-check"></i>';
      button.style.color = 'var(--success)';

      setTimeout(() => {
        button.innerHTML = originalHTML;
        button.style.color = 'var(--text-secondary)';
      }, 2000);
    }

  } catch (error) {
    console.error('Copy failed:', error);
    alert('Не удалось скопировать в буфер обмена');
  }
}

// Delete entry
async function deleteEntry(index, dateKey) {
  if (!confirm('Удалить эту запись из истории?')) {
    return;
  }

  try {
    if (!allHistory[dateKey] || !allHistory[dateKey][index]) {
      alert('Запись не найдена');
      return;
    }

    allHistory[dateKey].splice(index, 1);

    // If day is empty, remove it
    if (allHistory[dateKey].length === 0) {
      delete allHistory[dateKey];
      await chrome.storage.local.remove(dateKey);
    } else {
      await chrome.storage.local.set({ [dateKey]: allHistory[dateKey] });
    }

    filteredHistory = { ...allHistory };
    renderHistory();
    updateStats();

  } catch (error) {
    console.error('Delete failed:', error);
    alert('Не удалось удалить запись');
  }
}

// Export to JSON
function exportHistory() {
  const dataStr = JSON.stringify(allHistory, null, 2);
  const blob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `auto-answer-history-${formatDateKey(new Date())}.json`;
  a.click();

  URL.revokeObjectURL(url);
}

// Clear all history
async function clearHistory() {
  if (!confirm('Удалить всю историю? Это действие нельзя отменить!')) {
    return;
  }

  const keys = Object.keys(allHistory);
  await chrome.storage.local.remove(keys);

  allHistory = {};
  filteredHistory = {};
  renderHistory();
  updateStats();
}

// Utility functions
function formatDate(date) {
  const today = new Date();
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);

  if (formatDateKey(date) === formatDateKey(today)) {
    return 'Сегодня';
  } else if (formatDateKey(date) === formatDateKey(yesterday)) {
    return 'Вчера';
  } else {
    const months = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
                    'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
    return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
  }
}

function formatDateKey(date) {
  return date.toISOString().split('T')[0];
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function plural(n, one, few, many) {
  if (n % 10 === 1 && n % 100 !== 11) return one;
  if (n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20)) return few;
  return many;
}

// Event listeners
document.getElementById('searchInput').addEventListener('input', (e) => {
  searchHistory(e.target.value);
});

document.getElementById('exportBtn').addEventListener('click', exportHistory);
document.getElementById('clearBtn').addEventListener('click', clearHistory);

// Load on page load
loadHistory();
