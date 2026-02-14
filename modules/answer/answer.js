// Answer module logic
// This module handles the "Answer" tab functionality
// Called as: initAnswerModule(elements, showSelectorStatus, hideSelectorStatus, showGeneralStatus, setButtonLoading)

function initAnswerModule(elements, showSelectorStatus, hideSelectorStatus, showGeneralStatus, setButtonLoading) {
  let isSelectingElement = false;

  // Listen for element selected event from background
  window.addEventListener('elementSelected', (event) => {
    const message = event.detail;
    if (message.text) {
      elements.inputText.value = message.text;
      // КРИТИЧЕСКИ ВАЖНО: Сохранить выбранный текст в storage текущей вкладки
      if (window.updateCurrentTabField) {
        window.updateCurrentTabField('inputText', message.text);
      }
      isSelectingElement = false;
      elements.selectElementBtn.classList.remove('active');
      hideSelectorStatus();
      showSelectorStatus('✓ Элемент выбран!', 'success');
    }
  });

  // File upload handling
  if (elements.baseFileBtn) {
    elements.baseFileBtn.addEventListener('click', () => {
      if (elements.baseFile) {
        elements.baseFile.click();
      }
    });
  }

  if (elements.baseFile) {
    elements.baseFile.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (file) {
        const fileNameText = document.getElementById('baseFileNameText');
        if (fileNameText) {
          fileNameText.textContent = file.name;
        }
        elements.baseFileName.classList.add('loaded');

        // Show delete button
        if (elements.baseFileDeleteBtn) {
          elements.baseFileDeleteBtn.style.display = '';
        }

        // Save filename to storage (DUAL SAVE: tab_data + global for content.js)
        if (window.updateCurrentTabField) {
          await window.updateCurrentTabField('baseFileName', file.name);
        }
        await chrome.storage.local.set({ baseFileName: file.name });

        // Read file content and save it
        const reader = new FileReader();
        reader.onload = async (event) => {
          const fileContent = event.target.result;
          const MAX_SAFE_LENGTH = 20000; // Maximum safe length before truncation

          // DUAL SAVE: tab_data + global for content.js
          if (window.updateCurrentTabField) {
            await window.updateCurrentTabField('baseContent', fileContent);
          }
          await chrome.storage.local.set({ baseContent: fileContent });
          console.log('[AA] Base file loaded and saved:', file.name, `(${fileContent.length} символов)`);

          // Warn if file is too large
          if (fileContent.length > MAX_SAFE_LENGTH) {
            const warningMsg = `⚠️ Файл слишком большой (${fileContent.length.toLocaleString()} символов).\n\n` +
              `Для избежания ошибок API будут использованы только первые ${MAX_SAFE_LENGTH.toLocaleString()} символов.\n\n` +
              `Рекомендация: используйте более компактную базу или разбейте на несколько файлов.`;
            alert(warningMsg);
          }
        };
        reader.readAsText(file);
      }
    });
  }

  // File delete handling
  if (elements.baseFileDeleteBtn) {
    elements.baseFileDeleteBtn.addEventListener('click', async () => {
      if (confirm('Вы уверены, что хотите удалить файл базы данных?')) {
        // Clear storage (DUAL DELETE: tab_data + global)
        if (window.updateCurrentTabField) {
          await window.updateCurrentTabField('baseFileName', '');
          await window.updateCurrentTabField('baseContent', '');
        }
        await chrome.storage.local.remove(['baseFileName', 'baseContent']);

        // Update UI
        const fileNameText = document.getElementById('baseFileNameText');
        if (fileNameText) {
          fileNameText.textContent = '';
        }
        elements.baseFileName.classList.remove('loaded');
        elements.baseFileDeleteBtn.style.display = 'none';

        // Clear file input
        if (elements.baseFile) {
          elements.baseFile.value = '';
        }

        console.log('[AA] Base file deleted');
      }
    });
  }

  // Auto-save prompts
  if (elements.positivePrompt) {
    elements.positivePrompt.addEventListener('change', async () => {
      const prompt = elements.positivePrompt.value;
      // КРИТИЧЕСКИ ВАЖНО: Сохранить И в tab_data И в глобальный ключ
      // Глобальный ключ нужен для content.js (плавающая кнопка на странице)
      if (window.updateCurrentTabField) {
        await window.updateCurrentTabField('positivePrompt', prompt);
      }
      await chrome.storage.local.set({ positivePrompt: prompt });
      console.log('Positive prompt saved (tab + global)');
    });
  }

  if (elements.negativePrompt) {
    elements.negativePrompt.addEventListener('change', async () => {
      const prompt = elements.negativePrompt.value;
      // КРИТИЧЕСКИ ВАЖНО: Сохранить И в tab_data И в глобальный ключ
      if (window.updateCurrentTabField) {
        await window.updateCurrentTabField('negativePrompt', prompt);
      }
      await chrome.storage.local.set({ negativePrompt: prompt });
      console.log('Negative prompt saved (tab + global)');
    });
  }

  // Model descriptions
  const modelDescriptions = {
    'gpt-3.5-turbo': '⚡ Быстрая и экономичная модель для простых задач и тестирования. Подходит для базовых вопросов и ответов.',
    'gpt-4o-mini': '⚖️ Оптимальный баланс цены и качества. Хорошо справляется с большинством повседневных задач.',
    'gpt-4o': '🚀 Мощная универсальная модель. Отлично подходит для сложных вопросов, анализа и креативных задач.',
    'gpt-4-turbo': '💎 Самая продвинутая модель с максимальной точностью. Для критически важных и сложных задач.'
  };

  // Update model description
  function updateModelDescription() {
    if (elements.gptModel && elements.modelDescription) {
      const selectedModel = elements.gptModel.value;
      elements.modelDescription.textContent = modelDescriptions[selectedModel] || '';
    }
  }

  // Auto-save GPT model and update description
  if (elements.gptModel) {
    elements.gptModel.addEventListener('change', async () => {
      const model = elements.gptModel.value;
      // КРИТИЧЕСКИ ВАЖНО: Сохранить И в tab_data И в глобальный ключ
      if (window.updateCurrentTabField) {
        await window.updateCurrentTabField('gptModel', model);
      }
      await chrome.storage.local.set({ gptModel: model });
      console.log('GPT model saved (tab + global):', model);
      updateModelDescription();
    });
  }

  // Auto-save input and answer text
  if (elements.inputText) {
    elements.inputText.addEventListener('blur', async () => {
      const text = elements.inputText.value;
      if (window.updateCurrentTabField) {
        await window.updateCurrentTabField('inputText', text);
      }
    });
  }

  if (elements.answerText) {
    elements.answerText.addEventListener('blur', async () => {
      const text = elements.answerText.value;
      if (window.updateCurrentTabField) {
        await window.updateCurrentTabField('answerText', text);
      }
    });
  }

  // Element Selector
  if (elements.selectElementBtn) {
    elements.selectElementBtn.addEventListener('click', async () => {
      isSelectingElement = !isSelectingElement;

      if (isSelectingElement) {
        elements.selectElementBtn.classList.add('active');
        showSelectorStatus('Включение селектора...');

        try {
          // Use Promise wrapper for better control
          const response = await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
              reject(new Error('Селектор не ответил'));
            }, 5000);

            chrome.runtime.sendMessage({ action: 'enableSelector' }, (resp) => {
              clearTimeout(timeout);
              if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
              } else {
                resolve(resp);
              }
            });
          });

          if (response && response.success === true) {
            showSelectorStatus('✓ Селектор активен. Кликните на элемент на странице.', 'success');

            // Close popup after a delay to let selector initialize
            setTimeout(() => {
              console.log('Closing popup for element selection');
              window.close();
            }, 1000);
          } else {
            const errorMessage = response?.error || 'Не удалось включить селектор';
            showSelectorStatus(`⚠️ ${errorMessage}`, 'error');
            console.warn('enableSelector error:', response);
            isSelectingElement = false;
            elements.selectElementBtn.classList.remove('active');
          }
        } catch (error) {
          console.warn('enableSelector error:', error);
          showSelectorStatus(`⚠️ Селектор недоступен: ${error.message}`, 'error');
          isSelectingElement = false;
          elements.selectElementBtn.classList.remove('active');
        }
      } else {
        elements.selectElementBtn.classList.remove('active');
        hideSelectorStatus();

        chrome.runtime.sendMessage({ action: 'disableSelector' }, () => {
          if (chrome.runtime.lastError) {
            console.warn('Ошибка при отключении селектора:', chrome.runtime.lastError);
          }
        });
      }
    });
  }

  // Generate Answer button
  if (elements.generateAnswerBtn) {
    elements.generateAnswerBtn.addEventListener('click', async () => {
      if (!elements.inputText.value.trim()) {
        showGeneralStatus('error', 'Пожалуйста, выберите элемент или введите текст');
        return;
      }

      setButtonLoading(elements.generateAnswerBtn, true);
      elements.answerText.value = 'Генерирую ответ...';

      try {
        // КРИТИЧЕСКИ ВАЖНО: Получить ВСЕ настройки перед генерацией
        const settings = await chrome.storage.local.get(['apiKey', 'baseContent']);
        if (!settings.apiKey) {
          elements.answerText.value = 'Ошибка: API ключ не настроен. Перейдите в настройки.';
          return;
        }

        const userText = elements.inputText.value.trim();

        // КРИТИЧЕСКИ ВАЖНО: Читать значения НАПРЯМУЮ из полей формы (DOM элементов)
        // Это гарантирует, что мы получим актуальные значения, которые пользователь ввел
        const positivePrompt = elements.positivePrompt?.value?.trim() || '';
        const negativePrompt = elements.negativePrompt?.value?.trim() || '';
        const gptModel = elements.gptModel?.value || 'gpt-4o-mini';
        const baseContent = settings.baseContent || '';

        // ОТЛАДКА: Вывести в консоль ЧТО ИМЕННО отправляем
        console.log('=== ОТПРАВКА ЗАПРОСА НА ГЕНЕРАЦИЮ ===');
        console.log('Текст вопроса:', userText);
        console.log('Модель:', gptModel);
        console.log('Положительный промпт:', positivePrompt || '(пусто)');
        console.log('Отрицательный промпт:', negativePrompt || '(пусто)');
        console.log('База данных:', baseContent ? `${baseContent.length} символов` : '(не загружена)');

        // Отправить ВСЕ параметры в background для формирования правильного запроса
        const response = await chrome.runtime.sendMessage({
          action: 'generateAnswer',
          apiKey: settings.apiKey,
          text: userText,
          model: gptModel,
          positivePrompt: positivePrompt,
          negativePrompt: negativePrompt,
          baseContent: baseContent
        });

        if (response.success) {
          elements.answerText.value = response.answer;
          // Save answer to current tab data
          if (window.updateCurrentTabField) {
            await window.updateCurrentTabField('answerText', response.answer);
          } else {
            await chrome.storage.local.set({ lastGeneratedAnswer: response.answer });
          }

          // Save to history
          await saveToHistory(userText, response.answer);

          // Reload history widget
          loadHistoryWidget();
        } else {
          elements.answerText.value = `Ошибка: ${response.error}`;
        }
      } catch (error) {
        elements.answerText.value = `Ошибка: ${error.message}`;
      } finally {
        setButtonLoading(elements.generateAnswerBtn, false);
      }
    });
  }

  // Load saved data after all event listeners are set
  loadSavedData();

  // Load saved data on init
  async function loadSavedData() {
    const settings = await chrome.storage.local.get([
      'lastSelectedText',
      'lastGeneratedAnswer',
      'positivePrompt',
      'negativePrompt',
      'baseFileName',
      'gptModel'
    ]);

    if (settings.lastSelectedText && elements.inputText) {
      elements.inputText.value = settings.lastSelectedText;
    }

    if (settings.lastGeneratedAnswer && elements.answerText) {
      elements.answerText.value = settings.lastGeneratedAnswer;
    }

    if (settings.positivePrompt && elements.positivePrompt) {
      elements.positivePrompt.value = settings.positivePrompt;
    }

    if (settings.negativePrompt && elements.negativePrompt) {
      elements.negativePrompt.value = settings.negativePrompt;
    }

    if (settings.baseFileName && elements.baseFileName) {
      const fileNameText = document.getElementById('baseFileNameText');
      if (fileNameText) {
        fileNameText.textContent = settings.baseFileName;
      }
      elements.baseFileName.classList.add('loaded');

      // Show delete button
      if (elements.baseFileDeleteBtn) {
        elements.baseFileDeleteBtn.style.display = '';
      }
    }

    // Load GPT model (default: gpt-4o-mini)
    if (elements.gptModel) {
      elements.gptModel.value = settings.gptModel || 'gpt-4o-mini';
      updateModelDescription();
    }
  }

  // ========== HISTORY FUNCTIONS ==========

  // Save to history (tab-isolated)
  async function saveToHistory(question, answer) {
    const now = new Date();
    const currentTabId = window.getCurrentTabId?.() || 1;
    const dateKey = `tab_${currentTabId}_history_${formatDateKey(now)}`;
    const time = formatTime(now);

    // Get existing history for today
    const data = await chrome.storage.local.get(dateKey);
    const todayHistory = data[dateKey] || [];

    // Add new entry
    todayHistory.push({
      time: time,
      question: question,
      answer: answer,
      timestamp: now.toISOString()
    });

    // Save back
    await chrome.storage.local.set({ [dateKey]: todayHistory });
    console.log('[History] Saved to tab history:', dateKey, todayHistory.length, 'entries');
  }

  // Load and display history widget (last 5 days, tab-isolated)
  async function loadHistoryWidget() {
    if (!elements.historyContainer) return;

    const currentTabId = window.getCurrentTabId?.() || 1;
    const data = await chrome.storage.local.get(null);

    // Filter history keys for current tab only
    const historyPrefix = `tab_${currentTabId}_history_`;
    const historyKeys = Object.keys(data)
      .filter(key => key.startsWith(historyPrefix))
      .sort((a, b) => b.localeCompare(a)); // Descending

    // Take only last 5 days
    const recentKeys = historyKeys.slice(0, 5);

    if (recentKeys.length === 0) {
      elements.historyContainer.innerHTML = `
        <div class="history-empty">
          <i class="fas fa-history"></i>
          <span>История пуста</span>
        </div>
      `;
      return;
    }

    let html = '';
    recentKeys.forEach((dateKey, index) => {
      const entries = data[dateKey];
      if (!entries || entries.length === 0) return;

      // Extract date from key: tab_{id}_history_{date} -> {date}
      const date = dateKey.split('_history_')[1];
      const dateObj = new Date(date);
      const formattedDate = formatDateLabel(dateObj);
      const isExpanded = index === 0; // Only today expanded by default

      html += `
        <div class="history-day ${isExpanded ? 'expanded' : ''}" data-date="${dateKey}">
          <div class="history-day-header">
            <div class="history-day-title">
              <i class="fas fa-chevron-right history-day-chevron"></i>
              ${formattedDate}
            </div>
            <span style="font-size: 12px; color: var(--text-secondary);">
              ${entries.length}
            </span>
          </div>
          <div class="history-day-items">
      `;

      entries.slice().reverse().forEach((entry, entryIndex) => {
        const preview = entry.question.substring(0, 50) + (entry.question.length > 50 ? '...' : '');
        html += `
          <div class="history-item" data-date="${dateKey}" data-index="${entries.length - 1 - entryIndex}">
            <div class="history-item-time">${entry.time}</div>
            <div class="history-item-question">${escapeHtml(preview)}</div>
          </div>
        `;
      });

      html += `
          </div>
        </div>
      `;
    });

    elements.historyContainer.innerHTML = html;

    // Add event listeners for accordion
    elements.historyContainer.querySelectorAll('.history-day-header').forEach(header => {
      header.addEventListener('click', () => {
        const day = header.closest('.history-day');
        day.classList.toggle('expanded');
      });
    });

    // Add event listeners for history items
    elements.historyContainer.querySelectorAll('.history-item').forEach(item => {
      item.addEventListener('click', async () => {
        const dateKey = item.dataset.date;
        const index = parseInt(item.dataset.index);
        const data = await chrome.storage.local.get(dateKey);
        const entry = data[dateKey][index];

        if (entry) {
          showHistoryModal(entry);
        }
      });
    });
  }

  // Show history entry in modal
  function showHistoryModal(entry) {
    // Create modal
    const modal = document.createElement('div');
    modal.className = 'history-modal-overlay';
    modal.innerHTML = `
      <div class="history-modal">
        <div class="history-modal-header">
          <h3>Запись из истории</h3>
          <button class="history-modal-close">✕</button>
        </div>
        <div class="history-modal-body">
          <div class="history-modal-section">
            <strong>Время:</strong>
            <p>${entry.time}</p>
          </div>
          <div class="history-modal-section">
            <strong>Вопрос:</strong>
            <p>${escapeHtml(entry.question)}</p>
          </div>
          <div class="history-modal-section">
            <strong>Ответ:</strong>
            <p style="white-space: pre-wrap;">${escapeHtml(entry.answer)}</p>
          </div>
        </div>
        <div class="history-modal-footer">
          <button class="btn btn-primary history-modal-copy">
            <i class="fas fa-copy"></i>
            Копировать ответ
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // Event listeners
    modal.querySelectorAll('.history-modal-close').forEach(btn => {
      btn.addEventListener('click', () => modal.remove());
    });

    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.remove();
    });

    modal.querySelector('.history-modal-copy').addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(entry.answer);
        alert('✓ Ответ скопирован');
      } catch (error) {
        alert('Не удалось скопировать');
      }
    });
  }

  // Open full history page
  if (elements.openFullHistory) {
    elements.openFullHistory.addEventListener('click', () => {
      chrome.tabs.create({ url: chrome.runtime.getURL('modules/answer/history.html') });
    });
  }

  // Utility functions
  function formatDateKey(date) {
    return date.toISOString().split('T')[0];
  }

  function formatTime(date) {
    return date.toTimeString().substring(0, 5);
  }

  function formatDateLabel(date) {
    const today = new Date();
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);

    if (formatDateKey(date) === formatDateKey(today)) {
      return 'Сегодня';
    } else if (formatDateKey(date) === formatDateKey(yesterday)) {
      return 'Вчера';
    } else {
      const day = date.getDate();
      const months = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
      return `${day} ${months[date.getMonth()]}`;
    }
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Load history widget on init
  loadHistoryWidget();

  // Make loadHistoryWidget global for tab switching
  window.loadHistoryWidget = loadHistoryWidget;
}
