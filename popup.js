// ==========================================
// Configuration
// ==========================================
// URL для скачивания обновления с GitHub
// Формат: https://github.com/OWNER/REPO/archive/refs/heads/main.zip
// или: https://github.com/OWNER/REPO/releases/latest/download/FILENAME.zip
const GITHUB_UPDATE_URL = 'https://github.com/semtio/auto-answer/archive/refs/heads/main.zip';

// ==========================================
// Tabs Management
// ==========================================
let tabs = [];
let currentTabId = null;
let isCreatingTab = false; // Флаг для предотвращения двойного создания

async function loadTabs() {
  const data = await chrome.storage.local.get(['tabs', 'currentTabId']);
  tabs = data.tabs || [{ id: 1, name: 'Ответить', created: Date.now() }];
  currentTabId = data.currentTabId || 1;
  return { tabs, currentTabId };
}

async function saveTabs() {
  await chrome.storage.local.set({ tabs, currentTabId });
}

async function createTab() {
  // Предотвращаем двойное создание
  if (isCreatingTab) return;

  isCreatingTab = true;
  try {
    const newId = Math.max(...tabs.map(t => t.id), 0) + 1;
    const newTab = {
      id: newId,
      name: `Вкладка ${tabs.length + 1}`, // Используем количество вкладок, а не ID
      created: Date.now()
    };
    tabs.push(newTab);
    currentTabId = newId;
    await saveTabs();
    await renderTabs();
    await loadTabData(newId);
  } finally {
    isCreatingTab = false;
  }
}

async function deleteTab(tabId) {
  if (tabs.length === 1) {
    alert('Нельзя удалить последнюю вкладку');
    return;
  }

  const tabIndex = tabs.findIndex(t => t.id === tabId);
  if (tabIndex === -1) return;

  tabs.splice(tabIndex, 1);

  // Remove tab data from storage
  await chrome.storage.local.remove([`tab_${tabId}_data`]);

  // Switch to first tab if current was deleted
  if (currentTabId === tabId) {
    currentTabId = tabs[0].id;
    await loadTabData(currentTabId);
  }

  await saveTabs();
  await renderTabs();
}

async function switchTab(tabId) {
  // Save current tab data before switching
  if (currentTabId) {
    await saveTabData(currentTabId);
  }

  currentTabId = tabId;
  await chrome.storage.local.set({ currentTabId });
  await loadTabData(tabId);
  await renderTabs();
}

async function saveTabData(tabId) {
  if (!elements) return;

  // Get base content from storage (not in DOM)
  const storageData = await chrome.storage.local.get(['baseContent', 'baseFileName']);

  const tabData = {
    name: elements.tabName?.value || '',
    inputText: elements.inputText?.value || '',
    answerText: elements.answerText?.value || '',
    positivePrompt: elements.positivePrompt?.value || '',
    negativePrompt: elements.negativePrompt?.value || '',
    gptModel: elements.gptModel?.value || 'gpt-4o-mini',
    baseContent: storageData.baseContent || '',
    baseFileName: storageData.baseFileName || ''
  };

  // Update tab name in tabs array
  const tab = tabs.find(t => t.id === tabId);
  if (tab && tabData.name) {
    tab.name = tabData.name;
    await saveTabs();
  }

  await chrome.storage.local.set({ [`tab_${tabId}_data`]: tabData });
}

async function loadTabData(tabId) {
  if (!elements) return;

  const data = await chrome.storage.local.get([`tab_${tabId}_data`]);
  const tabData = data[`tab_${tabId}_data`] || {};

  const tab = tabs.find(t => t.id === tabId);

  if (elements.tabName) {
    elements.tabName.value = tabData.name || (tab?.name || '');
  }
  if (elements.inputText) elements.inputText.value = tabData.inputText || '';
  if (elements.answerText) elements.answerText.value = tabData.answerText || '';
  if (elements.positivePrompt) elements.positivePrompt.value = tabData.positivePrompt || '';
  if (elements.negativePrompt) elements.negativePrompt.value = tabData.negativePrompt || '';
  if (elements.gptModel) elements.gptModel.value = tabData.gptModel || 'gpt-4o-mini';

  // Update base file UI
  const fileNameText = document.getElementById('baseFileNameText');
  if (fileNameText) {
    fileNameText.textContent = tabData.baseFileName || '';
  }
  if (elements.baseFileName) {
    if (tabData.baseFileName) {
      elements.baseFileName.classList.add('loaded');
      if (elements.baseFileDeleteBtn) {
        elements.baseFileDeleteBtn.style.display = '';
      }
    } else {
      elements.baseFileName.classList.remove('loaded');
      if (elements.baseFileDeleteBtn) {
        elements.baseFileDeleteBtn.style.display = 'none';
      }
    }
  }

  // КРИТИЧЕСКИ ВАЖНО: Синхронизировать глобальные ключи для content.js
  // content.js (плавающая кнопка) читает из глобальных ключей
  await chrome.storage.local.set({
    positivePrompt: tabData.positivePrompt || '',
    negativePrompt: tabData.negativePrompt || '',
    gptModel: tabData.gptModel || 'gpt-4o-mini',
    baseContent: tabData.baseContent || '',
    baseFileName: tabData.baseFileName || ''
  });
  console.log('[Tabs] Глобальные ключи синхронизированы для content.js');

  // Reload history widget for new tab
  if (window.loadHistoryWidget) {
    await window.loadHistoryWidget();
  }
}

async function renderTabs() {
  const dropdownBtn = document.getElementById('dropdownBtn');
  const dropdownContent = document.getElementById('dropdownContent');

  if (!dropdownBtn || !dropdownContent) return;

  // Update button with current tab
  const currentTab = tabs.find(t => t.id === currentTabId);
  if (currentTab) {
    dropdownBtn.innerHTML = `
      <span class="tab-number">${tabs.indexOf(currentTab) + 1}</span>
      <span class="tab-title">${currentTab.name}</span>
      <i class="fas fa-chevron-down"></i>
    `;
  }

  // Render dropdown items
  const itemsHTML = tabs.map((tab, index) => `
    <a href="#" class="dropdown-item ${tab.id === currentTabId ? 'active' : ''}" data-tab-id="${tab.id}">
      <span class="tab-number">${index + 1}</span>
      <span>${tab.name}</span>
      ${tabs.length > 1 ? `<button class="delete-tab-btn" data-tab-id="${tab.id}" title="Удалить вкладку"><i class="fas fa-times"></i></button>` : ''}
    </a>
  `).join('');

  dropdownContent.innerHTML = itemsHTML + `
    <button class="dropdown-add-btn" id="addTabBtn">
      <i class="fas fa-plus"></i>
      <span>Добавить вкладку</span>
    </button>
  `;

  // Attach event listeners
  attachTabEventListeners();
}

function attachTabEventListeners() {
  const dropdownItems = document.querySelectorAll('.dropdown-item');
  const deleteButtons = document.querySelectorAll('.delete-tab-btn');
  const addTabBtn = document.getElementById('addTabBtn');

  dropdownItems.forEach(item => {
    item.addEventListener('click', async (e) => {
      e.preventDefault();
      const tabId = parseInt(item.dataset.tabId);
      await switchTab(tabId);

      // Close dropdown
      const dropdownContent = document.getElementById('dropdownContent');
      const dropdownBtn = document.getElementById('dropdownBtn');
      if (dropdownContent) dropdownContent.classList.remove('show');
      if (dropdownBtn) dropdownBtn.classList.remove('show');
    });
  });

  deleteButtons.forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      const tabId = parseInt(btn.dataset.tabId);
      if (confirm('Удалить эту вкладку?')) {
        await deleteTab(tabId);
      }
    });
  });

  if (addTabBtn) {
    addTabBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      await createTab();

      // Close dropdown
      const dropdownContent = document.getElementById('dropdownContent');
      const dropdownBtn = document.getElementById('dropdownBtn');
      if (dropdownContent) dropdownContent.classList.remove('show');
      if (dropdownBtn) dropdownBtn.classList.remove('show');
    });
  }
}

// Helper function for modules to save current tab data (make it global)
window.saveCurrentTabData = async function() {
  if (currentTabId !== null) {
    await saveTabData(currentTabId);
  }
};

// Helper function to get current tab data
window.getCurrentTabData = async function() {
  if (currentTabId !== null) {
    const data = await chrome.storage.local.get([`tab_${currentTabId}_data`]);
    return data[`tab_${currentTabId}_data`] || {};
  }
  return {};
};

// Helper function to update a single field in current tab data
window.updateCurrentTabField = async function(fieldName, value) {
  if (currentTabId === null) return;

  const key = `tab_${currentTabId}_data`;
  const data = await chrome.storage.local.get([key]);
  const tabData = data[key] || {};

  tabData[fieldName] = value;
  await chrome.storage.local.set({ [key]: tabData });
};

// Helper function to get current tab ID (for history isolation)
window.getCurrentTabId = function() {
  return currentTabId;
};

// ==========================================
// DOM Elements - Get them lazily to avoid timing issues
// ==========================================
function getElements() {
  return {
    apiKeyInput: document.getElementById('apiKey'),
    toggleKeyBtn: document.getElementById('toggleKey'),
    testConnectionBtn: document.getElementById('testConnection'),
    saveSettingsBtn: document.getElementById('saveSettings'),
    statusMessage: document.getElementById('statusMessage'),
    generateAnswerBtn: document.getElementById('generateAnswer'),
    answerText: document.getElementById('answerText'),
    inputText: document.getElementById('inputText'),
    tabName: document.getElementById('tabName'),
    selectElementBtn: document.getElementById('selectElementBtn'),
    selectorStatus: document.getElementById('selectorStatus'),
    settingsBtn: document.querySelector('.settings-btn'),
    baseFileBtn: document.getElementById('baseFileBtn'),
    baseFile: document.getElementById('baseFile'),
    baseFileName: document.getElementById('baseFileName'),
    baseFileDeleteBtn: document.getElementById('baseFileDeleteBtn'),
    positivePrompt: document.getElementById('positivePrompt'),
    negativePrompt: document.getElementById('negativePrompt'),
    gptModel: document.getElementById('gptModel'),
    modelDescription: document.getElementById('modelDescription'),
    historyContainer: document.getElementById('historyContainer'),
    openFullHistory: document.getElementById('openFullHistory')
  };
}

let elements = null;
let backgroundPort = null;

// ==========================================
// Background Connection
// ==========================================
function connectToBackground() {
  try {
    backgroundPort = chrome.runtime.connect({ name: 'popup' });
    console.log('Popup connected to background');

    backgroundPort.onMessage.addListener((message) => {
      console.log('Popup received message from background:', message.action);
      if (message.action === 'elementSelected' && message.text) {
        // Relay message to module via window event
        window.dispatchEvent(new CustomEvent('elementSelected', { detail: message }));
      }
    });

    backgroundPort.onDisconnect.addListener(() => {
      console.log('Background port disconnected');
      backgroundPort = null;
    });
  } catch (error) {
    console.error('Ошибка подключения к background:', error);
  }
}

// ==========================================
// Module Loader
// ==========================================
async function loadModule(moduleName) {
  try {
    console.log(`[Module] Loading module: ${moduleName}`);

    // Fetch HTML
    const htmlResponse = await fetch(`modules/${moduleName}/${moduleName}.html`);
    if (!htmlResponse.ok) {
      throw new Error(`Failed to fetch HTML: ${htmlResponse.status}`);
    }
    const html = await htmlResponse.text();

    // Insert HTML into container
    const tabContent = document.getElementById(`tab-${moduleName}`);
    if (!tabContent) {
      console.warn(`[Module] Container #tab-${moduleName} not found`);
      return;
    }

    tabContent.innerHTML = html;
    console.log(`[Module] ${moduleName} HTML loaded successfully`);

    // Load module JS via script tag with src (avoids CSP inline script violation)
    try {
      const script = document.createElement('script');
      script.type = 'text/javascript';
      script.src = chrome.runtime.getURL(`modules/${moduleName}/${moduleName}.js`);

      // Wait for script to load
      await new Promise((resolve, reject) => {
        script.onload = () => {
          console.log(`[Module] ${moduleName} JS loaded successfully`);
          resolve();
        };
        script.onerror = (error) => {
          console.error(`[Module] Failed to load ${moduleName} JS:`, error);
          reject(error);
        };
        document.head.appendChild(script);
      });

      // Give script a moment to execute after loading
      await new Promise(resolve => setTimeout(resolve, 50));

      // Call init function if exists
      const initFunctionName = `init${moduleName.charAt(0).toUpperCase() + moduleName.slice(1)}Module`;
      console.log(`[Module] Looking for function: ${initFunctionName}`);

      if (window[initFunctionName] && typeof window[initFunctionName] === 'function') {
        // Re-get elements after HTML is loaded to ensure they exist
        const moduleElements = getElements();
        console.log(`[Module] Found ${initFunctionName}, initializing with elements:`, Object.keys(moduleElements).length);

        window[initFunctionName](
          moduleElements,
          showSelectorStatus,
          hideSelectorStatus,
          showGeneralStatus,
          setButtonLoading
        );
        console.log(`[Module] ${moduleName} initialized successfully`);
      } else {
        console.error(`[Module] Function ${initFunctionName} not found in window`);
        console.warn(`[Module] Available functions:`, Object.keys(window).filter(k => k.includes('init')));
      }
    } catch (error) {
      console.error(`[Module] Error loading module JS ${moduleName}:`, error);
    }
  } catch (error) {
    console.error(`[Module] Error loading module ${moduleName}:`, error);
  }
}

// ==========================================
// Helper Functions (used by modules and settings)
// ==========================================
function showStatus(type, message) {
  if (!elements) return;
  elements.statusMessage.className = `status-message ${type}`;
  const statusText = elements.statusMessage.querySelector('.status-text');
  if (statusText) {
    statusText.textContent = message;
  }
  elements.statusMessage.style.display = 'block';
}

function hideStatus() {
  if (!elements) return;
  elements.statusMessage.className = 'status-message hidden';
  elements.statusMessage.style.display = 'none';
}

function showSelectorStatus(message, type = 'info') {
  if (!elements) return;
  elements.selectorStatus.textContent = message;
  elements.selectorStatus.style.display = 'block';
  elements.selectorStatus.className = `hint ${type}`;
}

function hideSelectorStatus() {
  if (!elements) return;
  elements.selectorStatus.textContent = '';
  elements.selectorStatus.style.display = 'none';
}

function showGeneralStatus(type, message) {
  if (!elements) return;
  elements.statusMessage.className = `status-message ${type}`;
  const statusText = elements.statusMessage.querySelector('.status-text');
  if (statusText) {
    statusText.textContent = message;
  }
  elements.statusMessage.style.display = 'block';

  if (type === 'success') {
    setTimeout(hideStatus, 5000);
  }
}

function setButtonLoading(button, isLoading) {
  if (isLoading) {
    button.classList.add('loading');
    button.disabled = true;
  } else {
    button.classList.remove('loading');
    button.disabled = false;
  }
}

// ==========================================
// Main Initialization
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
  console.log('Popup loaded');

  elements = getElements();

  // ========== Load Modules ==========
  await loadModule('answer');

  // Re-get elements after modules are loaded
  elements = getElements();

  // ========== Initialize Tab System ==========
  await loadTabs();
  await renderTabs();
  await loadTabData(currentTabId);

  // ========== Dropdown Functionality ==========
  const dropdownBtn = document.getElementById('dropdownBtn');
  const dropdownContent = document.getElementById('dropdownContent');

  if (dropdownBtn && dropdownContent) {
    dropdownBtn.addEventListener('click', () => {
      dropdownContent.classList.toggle('show');
      dropdownBtn.classList.toggle('show');
    });
  }

  // Attach tab event listeners after rendering
  attachTabEventListeners();

  // ========== Tab Name Input Handler ==========
  if (elements.tabName) {
    elements.tabName.addEventListener('blur', async () => {
      const newName = elements.tabName.value.trim();
      if (newName && currentTabId !== null) {
        const tabIndex = tabs.findIndex(t => t.id === currentTabId);
        if (tabIndex !== -1) {
          tabs[tabIndex].name = newName;
          await saveTabs();
          await renderTabs();
          attachTabEventListeners(); // Re-attach after re-render
        }
      }
    });

    elements.tabName.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        e.target.blur(); // Trigger blur event to save
      }
    });
  }

  // ========== Settings Button ==========
  if (elements.settingsBtn) {
    elements.settingsBtn.addEventListener('click', () => {
      // Remove active class from all tab contents
      document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));

      // Remove active class from dropdown items
      document.querySelectorAll('.dropdown-item').forEach(i => i.classList.remove('active'));

      // Show settings content
      const targetContent = document.getElementById('tab-settings');
      if (targetContent) {
        targetContent.classList.add('active');
      }

      // Toggle active state on settings button
      elements.settingsBtn.classList.add('active');

      // Close dropdown
      const dropdownContent = document.getElementById('dropdownContent');
      const dropdownBtn = document.getElementById('dropdownBtn');
      if (dropdownContent && dropdownBtn) {
        dropdownContent.classList.remove('show');
        dropdownBtn.classList.remove('show');
      }
    });
  }

  // ========== Close dropdown when clicking outside ==========
  document.addEventListener('click', (e) => {
    if (dropdownBtn && dropdownContent && !e.target.closest('.dropdown')) {
      dropdownContent.classList.remove('show');
      dropdownBtn.classList.remove('show');
    }
  });

  // ========== Load saved settings and connect to background ==========
  try {
    const settings = await chrome.storage.local.get(['apiKey']);
    if (settings.apiKey && elements.apiKeyInput) {
      elements.apiKeyInput.value = settings.apiKey;
    }
    connectToBackground();
  } catch (error) {
    console.error('Error loading settings:', error);
  }

  // ========== Settings Tab Event Listeners ==========

  // Toggle password visibility
  if (elements.toggleKeyBtn) {
    elements.toggleKeyBtn.addEventListener('click', () => {
      const isPassword = elements.apiKeyInput.type === 'password';
      elements.apiKeyInput.type = isPassword ? 'text' : 'password';
      const icon = elements.toggleKeyBtn.querySelector('i');
      if (icon) {
        icon.className = isPassword ? 'fas fa-eye-slash' : 'fas fa-eye';
      }
    });
  }

  // Test API connection
  if (elements.testConnectionBtn) {
    elements.testConnectionBtn.addEventListener('click', async () => {
      const apiKey = elements.apiKeyInput.value.trim();
      if (!apiKey) {
        showStatus('error', 'Пожалуйста, введите API ключ');
        return;
      }
      if (!apiKey.startsWith('sk-')) {
        showStatus('error', 'API ключ должен начинаться с "sk-"');
        return;
      }

      setButtonLoading(elements.testConnectionBtn, true);
      hideStatus();

      try {
        const response = await fetch('https://api.openai.com/v1/models', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          }
        });

        if (response.ok) {
          const data = await response.json();
          showStatus('success', `✓ Подключение успешно! Доступно моделей: ${data.data.length}`);
        } else {
          const error = await response.json();
          showStatus('error', `Ошибка: ${error.error?.message || 'Неверный API ключ'}`);
        }
      } catch (error) {
        showStatus('error', `Ошибка подключения: ${error.message}`);
      } finally {
        setButtonLoading(elements.testConnectionBtn, false);
      }
    });
  }

  // Save settings
  if (elements.saveSettingsBtn) {
    elements.saveSettingsBtn.addEventListener('click', async () => {
      const apiKey = elements.apiKeyInput.value.trim();
      if (!apiKey) {
        showStatus('error', 'Пожалуйста, введите API ключ');
        return;
      }
      if (!apiKey.startsWith('sk-')) {
        showStatus('error', 'API ключ должен начинаться с "sk-"');
        return;
      }

      setButtonLoading(elements.saveSettingsBtn, true);
      try {
        await chrome.storage.local.set({ apiKey });
        showStatus('success', '✓ Настройки сохранены успешно!');
        setTimeout(() => window.close(), 1500);
      } catch (error) {
        showStatus('error', `Ошибка сохранения: ${error.message}`);
      } finally {
        setButtonLoading(elements.saveSettingsBtn, false);
      }
    });
  }

  // Button 1: Download update from GitHub
  const downloadUpdateBtn = document.getElementById('downloadUpdateBtn');
  if (downloadUpdateBtn) {
    downloadUpdateBtn.addEventListener('click', () => {
      // Simple download via link
      const link = document.createElement('a');
      link.href = GITHUB_UPDATE_URL;
      link.download = '';
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      showStatus('success', '✓ Скачивание начато! Проверьте папку "Загрузки".');
      setTimeout(hideStatus, 5000);
    });
  }

  // Button 2: Open chrome://extensions/ page
  const openExtensionsBtn = document.getElementById('openExtensionsBtn');
  if (openExtensionsBtn) {
    openExtensionsBtn.addEventListener('click', () => {
      chrome.tabs.create({ url: 'chrome://extensions/' });
    });
  }
});
