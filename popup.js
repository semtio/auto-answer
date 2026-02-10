// ==========================================
// Configuration
// ==========================================
// URL для скачивания обновления с GitHub
// Формат: https://github.com/OWNER/REPO/archive/refs/heads/main.zip
// или: https://github.com/OWNER/REPO/releases/latest/download/FILENAME.zip
const GITHUB_UPDATE_URL = '';

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
    selectElementBtn: document.getElementById('selectElementBtn'),
    selectorStatus: document.getElementById('selectorStatus'),
    settingsBtn: document.querySelector('.settings-btn'),
    baseFileBtn: document.getElementById('baseFileBtn'),
    baseFile: document.getElementById('baseFile'),
    baseFileName: document.getElementById('baseFileName'),
    baseFileDeleteBtn: document.getElementById('baseFileDeleteBtn'),
    positivePrompt: document.getElementById('positivePrompt'),
    negativePrompt: document.getElementById('negativePrompt'),
    answerLanguage: document.getElementById('answerLanguage'),
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

  // ========== Dropdown Functionality ==========
  const dropdownBtn = document.getElementById('dropdownBtn');
  const dropdownContent = document.getElementById('dropdownContent');
  const dropdownItems = document.querySelectorAll('.dropdown-item');

  if (dropdownBtn && dropdownContent) {
    dropdownBtn.addEventListener('click', () => {
      dropdownContent.classList.toggle('show');
      dropdownBtn.classList.toggle('show');
    });
  }

  if (dropdownItems.length > 0) {
    dropdownItems.forEach((item) => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        const tabId = item.getAttribute('data-tab');

        // Remove active class from all dropdown items
        dropdownItems.forEach((i) => i.classList.remove('active'));
        item.classList.add('active');

        // Remove active class from all tab contents
        document.querySelectorAll('.tab-content').forEach((content) => content.classList.remove('active'));

        // Hide settings button active state
        if (elements.settingsBtn) {
          elements.settingsBtn.classList.remove('active');
        }

        // Show corresponding content
        const targetContent = document.getElementById(`tab-${tabId}`);
        if (targetContent) {
          targetContent.classList.add('active');
        }

        // Close dropdown
        if (dropdownContent && dropdownBtn) {
          dropdownContent.classList.remove('show');
          dropdownBtn.classList.remove('show');
        }
      });
    });
  }

  // ========== Settings Button ==========
  if (elements.settingsBtn) {
    elements.settingsBtn.addEventListener('click', () => {
      // Remove active class from all tab contents
      document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
      dropdownItems.forEach(i => i.classList.remove('active'));

      // Show settings content
      const targetContent = document.getElementById('tab-settings');
      if (targetContent) {
        targetContent.classList.add('active');
      }

      // Toggle active state on settings button
      elements.settingsBtn.classList.add('active');

      // Close dropdown
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

  // Update file button - downloads ZIP from GitHub
  const updateFileBtn = document.getElementById('updateFileBtn');

  if (updateFileBtn) {
    updateFileBtn.addEventListener('click', () => {
      // Create invisible link and trigger download
      const link = document.createElement('a');
      link.href = GITHUB_UPDATE_URL;
      link.download = ''; // Browser will use filename from URL
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Show feedback
      showStatus('success', '✓ Скачивание начато! Проверьте папку "Загрузки".');
      setTimeout(hideStatus, 5000);
    });
  }
});
