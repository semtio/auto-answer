(function () {
  'use strict';

  // Prevent double loading
  if (window.__autoAnswerSelectorLoaded) {
    console.log('[AA] Content script already loaded, skipping');
    return;
  }
  window.__autoAnswerSelectorLoaded = true;

  console.log('[AA] ========== Content Script Initialization Started ==========');
  console.log('[AA] Page URL:', location.href);
  console.log('[AA] Document ready state:', document.readyState);

  let selectorActive = false;
  let overlay = null;
  let currentTarget = null;
  let selectedText = '';
  let floatingButton = null;
  let resultModal = null;

  console.log('[AA] Variables initialized');

  // Check if chrome runtime is available
  if (!chrome || !chrome.runtime) {
    console.error('[AA] Chrome runtime not available!');
  } else {
    console.log('[AA] Chrome runtime available');
  }

  console.log('[AA] Content script loaded at', location.href);

  // Register message listener
  try {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      console.log('[AA] onMessage listener triggered');
      console.log('[AA] Request:', request);
      console.log('[AA] Sender:', sender);

      if (!request || !request.action) {
        console.warn('[AA] Invalid request, no action');
        return false;
      }

      console.log('[AA] Processing action:', request.action);

      if (request.action === 'enableSelector') {
        console.log('[AA] enableSelector handler called');
        enableSelector();
        sendResponse({ success: true, message: 'Selector enabled' });
        return true;
      } else if (request.action === 'disableSelector') {
        console.log('[AA] disableSelector handler called');
        disableSelector();
        sendResponse({ success: true, message: 'Selector disabled' });
        return true;
      } else {
        console.warn('[AA] Unknown action:', request.action);
        return false;
      }
    });

    console.log('[AA] Message listener registered successfully');
  } catch (error) {
    console.error('[AA] Error registering message listener:', error);
  }

  function enableSelector() {
    console.log('[AA] enableSelector() called, selectorActive:', selectorActive);

    if (selectorActive) {
      console.log('[AA] Selector already active, skipping');
      return;
    }

    console.log('[AA] Starting selector activation...');
    selectorActive = true;

    try {
      console.log('[AA] Setting cursor to crosshair');
      document.body.style.cursor = 'crosshair';

      console.log('[AA] Calling ensureOverlay()');
      ensureOverlay();

      console.log('[AA] Adding event listeners');
      document.addEventListener('mousemove', handleMouseMove, true);
      document.addEventListener('click', handleElementClick, true);
      document.addEventListener('keydown', handleKeyDown, true);

      console.log('[AA] ✓ Selector activated successfully');
    } catch (error) {
      console.error('[AA] ✗ Error activating selector:', error);
      selectorActive = false;
      document.body.style.cursor = '';
    }
  }

  function disableSelector() {
    console.log('[AA] disableSelector() called, selectorActive:', selectorActive);

    if (!selectorActive) {
      console.log('[AA] Selector already disabled, skipping');
      return;
    }

    console.log('[AA] Starting selector deactivation...');
    selectorActive = false;
    document.body.style.cursor = '';

    try {
      console.log('[AA] Removing event listeners');
      document.removeEventListener('mousemove', handleMouseMove, true);
      document.removeEventListener('click', handleElementClick, true);
      document.removeEventListener('keydown', handleKeyDown, true);

      console.log('[AA] Removing overlay');
      removeOverlay();
      currentTarget = null;

      console.log('[AA] ✓ Selector deactivated successfully');
    } catch (error) {
      console.error('[AA] ✗ Error deactivating selector:', error);
    }
  }

  function ensureOverlay() {
    if (overlay) return;
    overlay = document.createElement('div');
    overlay.setAttribute('data-aa-overlay', 'true');
    overlay.style.position = 'fixed';
    overlay.style.zIndex = '2147483647';
    overlay.style.pointerEvents = 'none';
    overlay.style.border = '2px solid #667eea';
    overlay.style.background = 'rgba(102, 126, 234, 0.15)';
    overlay.style.boxSizing = 'border-box';
    overlay.style.borderRadius = '4px';
    overlay.style.transition = 'all 0.05s ease';
    overlay.style.display = 'none';
    document.documentElement.appendChild(overlay);
  }

  function removeOverlay() {
    if (!overlay) return;
    overlay.remove();
    overlay = null;
  }

  function handleMouseMove(event) {
    if (!selectorActive) {
      // Только логируем первый раз, чтобы избежать spam'а
      return;
    }

    const target = event.target;

    // Skip if target is invalid
    if (!target || target === document.documentElement || target === document.body) {
      hideOverlay();
      return;
    }

    // Skip if target is our UI element
    if (target.hasAttribute && target.hasAttribute('data-aa-overlay')) {
      hideOverlay();
      return;
    }

    // Update current target
    if (target !== currentTarget) {
      currentTarget = target;
      console.log('[AA] Mouse move: hovering over element:', target.tagName);
    }

    // Get and validate rect
    const rect = target.getBoundingClientRect();
    if (!rect || rect.width === 0 || rect.height === 0) {
      hideOverlay();
      return;
    }

    // Show or update overlay position
    showOverlay(rect);
  }

  function handleElementClick(event) {
    console.log('[AA] Click event detected, selectorActive:', selectorActive);

    if (!selectorActive) {
      console.log('[AA] ⚠️ Selector NOT active, ignoring click');
      return;
    }

    console.log('[AA] ✓ Element click detected during selector mode', event);

    try {
      event.preventDefault();
      event.stopPropagation();
      console.log('[AA] Event prevented and stopped');
    } catch (error) {
      console.error('[AA] Error preventing event:', error);
    }

    const target = event.target;
    console.log('[AA] Click target:', target?.tagName, target?.className);

    if (!target) {
      console.warn('[AA] ⚠️ No target found for click');
      return;
    }

    if (target.hasAttribute && (target.hasAttribute('data-aa-overlay') || target.hasAttribute('data-aa-ui'))) {
      console.log('[AA] Click on Auto Answer UI element, ignoring');
      return;
    }

    const text = extractTextContent(target);
    console.log('[AA] Extracted text length:', text?.length);

    if (!text || text.length === 0) {
      console.warn('[AA] ⚠️ No text extracted from target');
      return;
    }

    selectedText = text;
    console.log('[AA] ✓ Text selected:', text.substring(0, 100));

    // Send message to background for storage
    console.log('[AA] Sending elementSelected message to background...');
    chrome.runtime.sendMessage({
      action: 'elementSelected',
      text
    }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('[AA] ✗ Error sending elementSelected:', chrome.runtime.lastError);
      } else {
        console.log('[AA] ✓ elementSelected sent successfully, response:', response);
      }
    });

    console.log('[AA] Disabling selector after click...');
    disableSelector();

    // Show floating button for generation
    console.log('[AA] Showing floating button at', event.clientX, event.clientY);
    showFloatingButton(event.clientX, event.clientY);
  }

  function handleKeyDown(event) {
    if (!selectorActive) return;
    if (event.key === 'Escape') {
      console.log('[AA] Escape key pressed, disabling selector');
      event.preventDefault();
      event.stopPropagation();
      disableSelector();
    }
  }

  function showOverlay(rect) {
    if (!overlay) {
      console.warn('[AA] Overlay element not found');
      return;
    }
    overlay.style.display = 'block';
    overlay.style.top = `${rect.top}px`;
    overlay.style.left = `${rect.left}px`;
    overlay.style.width = `${rect.width}px`;
    overlay.style.height = `${rect.height}px`;
  }

  function hideOverlay() {
    if (!overlay) return;
    overlay.style.display = 'none';
  }

  function extractTextContent(element) {
    let text = element.innerText || element.textContent || '';
    text = text
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/\n\n+/g, '\n');

    if (text.length > 2000) {
      text = text.substring(0, 2000) + '...';
    }

    return text;
  }

  // ========== FLOATING BUTTON ==========
  function showFloatingButton(x, y) {
    console.log('[AA] Showing floating button at', x, y);

    if (floatingButton) {
      console.log('[AA] Removing existing floating button');
      floatingButton.remove();
    }

    floatingButton = document.createElement('div');
    floatingButton.setAttribute('data-aa-ui', 'true');
    floatingButton.className = 'aa-floating-button';
    floatingButton.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
      </svg>
      <span>Сгенерировать ответ</span>
    `;

    // Position near click
    floatingButton.style.left = `${Math.min(x, window.innerWidth - 250)}px`;
    floatingButton.style.top = `${Math.min(y, window.innerHeight - 60)}px`;

    floatingButton.addEventListener('click', handleGenerateClick);

    document.body.appendChild(floatingButton);
    console.log('[AA] Floating button added to DOM');

    // Animate in
    setTimeout(() => {
      floatingButton?.classList.add('aa-show');
      console.log('[AA] Floating button animated in');
    }, 10);
  }

  function hideFloatingButton() {
    if (!floatingButton) {
      console.log('[AA] No floating button to hide');
      return;
    }

    console.log('[AA] Hiding floating button');
    floatingButton.classList.remove('aa-show');
    setTimeout(() => {
      floatingButton?.remove();
      floatingButton = null;
      console.log('[AA] Floating button removed');
    }, 300);
  }

  async function handleGenerateClick() {
    console.log('[AA] handleGenerateClick triggered');

    if (!selectedText) {
      console.log('[AA] No selected text available');
      return;
    }

    console.log('[AA] Selected text:', selectedText.substring(0, 100) + '...');

    // Show loading state
    floatingButton.classList.add('aa-loading');
    floatingButton.innerHTML = `
      <div class="aa-spinner"></div>
      <span>Генерация...</span>
    `;

    try {
      // Get settings from storage
      console.log('[AA] Fetching settings from chrome.storage.local');
      const settings = await chrome.storage.local.get([
        'apiKey',
        'baseContent',
        'positivePrompt',
        'negativePrompt',
        'gptModel'
      ]);

      if (!settings.apiKey) {
        console.log('[AA] No API key configured');
        showResultModal('❌ Ошибка', 'API ключ не настроен. Откройте расширение и добавьте ключ в настройках.', true);
        hideFloatingButton();
        return;
      }

      console.log('[AA] API key found, building prompt');

      // ОТЛАДКА: Вывести ЧТО прочитали из storage
      console.log('[AA] ===== НАСТРОЙКИ ИЗ STORAGE =====');
      console.log('[AA] gptModel:', settings.gptModel || '(не задано, используем gpt-4o-mini)');
      console.log('[AA] positivePrompt:', settings.positivePrompt || '(пусто)');
      console.log('[AA] negativePrompt:', settings.negativePrompt || '(пусто)');
      console.log('[AA] baseContent:', settings.baseContent ? `${settings.baseContent.length} символов` : '(не загружена)');

      // Build system prompt
      let systemPrompt = 'Ты - AI помощник для генерации ответов.';

      if (settings.baseContent) {
        // Limit base content to prevent token limit errors
        const MAX_BASE_LENGTH = 20000; // ~5000 tokens for Russian text
        let baseContent = settings.baseContent;

        if (baseContent.length > MAX_BASE_LENGTH) {
          baseContent = baseContent.substring(0, MAX_BASE_LENGTH);
          console.warn('[AA] База данных обрезана с', settings.baseContent.length, 'до', MAX_BASE_LENGTH, 'символов');
        }

        systemPrompt += `\n\nБаза знаний:\n${baseContent}`;
      }

      if (settings.positivePrompt) {
        systemPrompt += `\n\nИнструкции:\n${settings.positivePrompt}`;
      }

      if (settings.negativePrompt) {
        systemPrompt += `\n\nОграничения (НЕ делай):\n${settings.negativePrompt}`;
      }

      // Use selected model (default: gpt-4o-mini)
      const model = settings.gptModel || 'gpt-4o-mini';
      console.log('[AA] ===== ИТОГОВЫЙ ПРОМПТ =====');
      console.log('[AA] Модель:', model);
      console.log('[AA] Системный промпт:\n', systemPrompt);
      console.log('[AA] ===== КОНЕЦ ПРОМПТА =====');
      console.log('[AA] Calling OpenAI API');

      // Call OpenAI API
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${settings.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: selectedText }
          ],
          temperature: 0.7,
          max_tokens: 1500  // Увеличено с 500 до 1500 для более полных ответов
        })
      });

      if (!response.ok) {
        console.log('[AA] API response not ok:', response.status, response.statusText);
        const error = await response.json();
        throw new Error(error.error?.message || 'Ошибка API');
      }

      console.log('[AA] API response received, parsing...');
      const data = await response.json();
      const answer = data.choices[0]?.message?.content || 'Нет ответа';

      console.log('[AA] Answer generated:', answer.substring(0, 100) + '...');

      // Save answer to storage for popup
      await chrome.storage.local.set({ lastGeneratedAnswer: answer });
      console.log('[AA] Answer saved to storage');

      // Save to history
      await saveToHistory(selectedText, answer);
      console.log('[AA] Saved to history');

      hideFloatingButton();
      showResultModal('✓ Ответ сгенерирован', answer, false);

    } catch (error) {
      console.error('[AA] Generation error:', error);
      hideFloatingButton();
      showResultModal('❌ Ошибка', error.message || 'Не удалось сгенерировать ответ', true);
    }
  }

  // ========== RESULT MODAL ==========
  function showResultModal(title, content, isError) {
    console.log('[AA] showResultModal called:', title, 'isError=' + isError);

    if (resultModal) {
      console.log('[AA] Removing existing result modal');
      resultModal.remove();
    }

    resultModal = document.createElement('div');
    resultModal.setAttribute('data-aa-ui', 'true');
    resultModal.className = 'aa-modal-overlay';

    resultModal.innerHTML = `
      <div class="aa-modal ${isError ? 'aa-modal-error' : ''}">
        <div class="aa-modal-header">
          <h3>${title}</h3>
          <button class="aa-modal-close" data-action="close">✕</button>
        </div>
        <div class="aa-modal-body">
          <div class="aa-result-text">${content}</div>
          ${!isError ? `
            <div class="aa-refinement-section">
              <label class="aa-refinement-label">✨ Скорректировать ответ:</label>
              <textarea
                class="aa-refinement-input"
                placeholder="Например: сделай текст короче в 2 раза, используй только заглавные буквы..."
                rows="2"
              ></textarea>
            </div>
          ` : ''}
        </div>
        <div class="aa-modal-footer">
          ${!isError ? '<button class="aa-btn aa-btn-secondary" data-action="refine">🔄 Скорректировать</button>' : ''}
          ${!isError ? '<button class="aa-btn aa-btn-primary" data-action="copy">📋 Скопировать</button>' : ''}
          <button class="aa-btn aa-btn-secondary" data-action="close">Закрыть</button>
        </div>
      </div>
    `;

    resultModal.addEventListener('click', async (e) => {
      const action = e.target.dataset.action;
      if (action === 'close' || e.target === resultModal) {
        console.log('[AA] Modal close action triggered');
        hideResultModal();
      } else if (action === 'copy') {
        console.log('[AA] Copy action triggered');
        copyToClipboard(content);
      } else if (action === 'refine') {
        console.log('[AA] Refine action triggered');
        const refinementInput = resultModal.querySelector('.aa-refinement-input');
        const refinementText = refinementInput?.value.trim();

        if (!refinementText) {
          alert('Пожалуйста, введите инструкции для корректировки');
          return;
        }

        await refineAnswer(content, refinementText);
      }
    });

    document.body.appendChild(resultModal);
    console.log('[AA] Modal added to DOM');

    setTimeout(() => {
      resultModal?.classList.add('aa-show');
      console.log('[AA] Modal animated in');
    }, 10);
  }

  async function refineAnswer(currentAnswer, refinementInstructions) {
    console.log('[AA] Refining answer with instructions:', refinementInstructions);

    // Update modal to show loading state
    const resultText = resultModal?.querySelector('.aa-result-text');
    const refinementInput = resultModal?.querySelector('.aa-refinement-input');
    const refineBtn = resultModal?.querySelector('[data-action="refine"]');

    if (refineBtn) {
      refineBtn.disabled = true;
      refineBtn.textContent = '⏳ Обработка...';
    }

    try {
      // Get settings
      const settings = await chrome.storage.local.get([
        'apiKey',
        'gptModel'
      ]);

      if (!settings.apiKey) {
        alert('API ключ не настроен');
        return;
      }

      const systemPrompt = 'Ты - AI помощник для корректировки текстов.\n\nТвоя задача - скорректировать предоставленный текст согласно инструкциям пользователя. Сохрани основной смысл, но примени указанные изменения.';

      const userPrompt = `Текущий текст:\n${currentAnswer}\n\nИнструкции по корректировке:\n${refinementInstructions}\n\nВыполни корректировку и верни только исправленный текст.`;

      const model = settings.gptModel || 'gpt-4o-mini';
      console.log('[AA] Calling OpenAI API for refinement, model:', model);

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${settings.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          temperature: 0.7,
          max_tokens: 800
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'Ошибка API');
      }

      const data = await response.json();
      const refinedAnswer = data.choices[0]?.message?.content || 'Нет ответа';

      console.log('[AA] Refined answer received');

      // Update modal with new answer with animation
      if (resultText) {
        resultText.style.opacity = '0.3';
        setTimeout(() => {
          resultText.textContent = refinedAnswer;
          resultText.style.opacity = '1';
        }, 150);
      }

      // Clear refinement input
      if (refinementInput) {
        refinementInput.value = '';
      }

      // Restore button
      if (refineBtn) {
        refineBtn.disabled = false;
        refineBtn.textContent = '🔄 Скорректировать';
      }

      // Save refined answer to storage
      await chrome.storage.local.set({ lastGeneratedAnswer: refinedAnswer });

    } catch (error) {
      console.error('[AA] Refinement error:', error);
      alert(`Ошибка корректировки: ${error.message}`);

      // Restore button
      if (refineBtn) {
        refineBtn.disabled = false;
        refineBtn.textContent = '🔄 Скорректировать';
      }
    }
  }

  function hideResultModal() {
    if (!resultModal) {
      console.log('[AA] No result modal to hide');
      return;
    }

    console.log('[AA] Hiding result modal');
    resultModal.classList.remove('aa-show');
    setTimeout(() => {
      resultModal?.remove();
      resultModal = null;
      console.log('[AA] Result modal removed');
    }, 300);
  }

  // ========== HISTORY ==========
  async function saveToHistory(question, answer) {
    const now = new Date();
    const dateKey = `history_${formatDateKey(now)}`;
    const time = formatTime(now);

    try {
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
      console.log('[AA] History saved:', dateKey, todayHistory.length, 'entries');
    } catch (error) {
      console.error('[AA] Failed to save history:', error);
    }
  }

  function formatDateKey(date) {
    return date.toISOString().split('T')[0];
  }

  function formatTime(date) {
    return date.toTimeString().substring(0, 5);
  }

  function copyToClipboard(text) {
    console.log('[AA] Copying to clipboard:', text.substring(0, 50) + '...');
    navigator.clipboard.writeText(text).then(() => {
      console.log('[AA] Copy successful');
      const copyBtn = resultModal?.querySelector('[data-action="copy"]');
      if (copyBtn) {
        const originalText = copyBtn.innerHTML;
        copyBtn.innerHTML = '✓ Скопировано!';
        copyBtn.disabled = true;
        setTimeout(() => {
          copyBtn.innerHTML = originalText;
          copyBtn.disabled = false;
        }, 2000);
      }
    }).catch(err => {
      console.error('[AA] Copy failed:', err);
      alert('Не удалось скопировать. Пожалуйста, скопируйте вручную.');
    });
  }

  // ========== INJECT STYLES ==========
  function injectStyles() {
    console.log('[AA] injectStyles: checking if styles already exist');

    if (document.getElementById('aa-styles')) {
      console.log('[AA] Styles already exist, skipping injection');
      return;
    }

    const style = document.createElement('style');
    style.id = 'aa-styles';
    style.textContent = `
      .aa-floating-button {
        position: fixed;
        z-index: 2147483646;
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 12px 20px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        border: none;
        border-radius: 50px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        box-shadow: 0 4px 20px rgba(102, 126, 234, 0.4);
        transition: all 0.3s ease;
        opacity: 0;
        transform: translateY(10px) scale(0.9);
      }

      .aa-floating-button.aa-show {
        opacity: 1;
        transform: translateY(0) scale(1);
      }

      .aa-floating-button:hover {
        transform: translateY(-2px) scale(1.05);
        box-shadow: 0 6px 25px rgba(102, 126, 234, 0.5);
      }

      .aa-floating-button.aa-loading {
        pointer-events: none;
        opacity: 0.8;
      }

      .aa-spinner {
        width: 16px;
        height: 16px;
        border: 2px solid rgba(255, 255, 255, 0.3);
        border-top-color: white;
        border-radius: 50%;
        animation: aa-spin 0.6s linear infinite;
      }

      @keyframes aa-spin {
        to { transform: rotate(360deg); }
      }

      .aa-modal-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.6);
        z-index: 2147483647;
        display: flex;
        align-items: center;
        justify-content: center;
        opacity: 0;
        transition: opacity 0.3s ease;
      }

      .aa-modal-overlay.aa-show {
        opacity: 1;
      }

      .aa-modal {
        background: white;
        border-radius: 16px;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        max-width: 600px;
        width: 90%;
        max-height: 80vh;
        display: flex;
        flex-direction: column;
        transform: scale(0.9);
        transition: transform 0.3s ease;
      }

      .aa-modal-overlay.aa-show .aa-modal {
        transform: scale(1);
      }

      .aa-modal-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 20px 24px;
        border-bottom: 2px solid #e2e8f0;
      }

      .aa-modal-header h3 {
        margin: 0;
        font-size: 18px;
        font-weight: 700;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
      }

      .aa-modal-close {
        background: none;
        border: none;
        font-size: 24px;
        color: #64748b;
        cursor: pointer;
        padding: 0;
        width: 32px;
        height: 32px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 8px;
        transition: all 0.2s ease;
      }

      .aa-modal-close:hover {
        background: #f1f5f9;
        color: #1e293b;
      }

      .aa-modal-body {
        padding: 24px;
        overflow-y: auto;
        flex: 1;
      }

      .aa-result-text {
        font-size: 15px;
        line-height: 1.6;
        color: #1e293b;
        white-space: pre-wrap;
        word-wrap: break-word;
        transition: opacity 0.2s ease;
      }

      .aa-refinement-section {
        margin-top: 20px;
        padding: 16px;
        background: linear-gradient(135deg, rgba(102, 126, 234, 0.05) 0%, rgba(118, 75, 162, 0.05) 100%);
        border-radius: 12px;
        border: 2px solid rgba(102, 126, 234, 0.15);
      }

      .aa-refinement-label {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 14px;
        font-weight: 600;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
        margin-bottom: 10px;
      }

      .aa-refinement-input {
        width: 100%;
        padding: 12px 14px;
        border: 2px solid rgba(102, 126, 234, 0.2);
        border-radius: 10px;
        font-size: 14px;
        line-height: 1.5;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        resize: vertical;
        transition: all 0.3s ease;
        box-sizing: border-box;
        background: white;
      }

      .aa-refinement-input:focus {
        outline: none;
        border-color: #667eea;
        box-shadow: 0 0 0 4px rgba(102, 126, 234, 0.12), 0 4px 12px rgba(102, 126, 234, 0.15);
        transform: translateY(-1px);
      }

      .aa-refinement-input::placeholder {
        color: #94a3b8;
        font-size: 13px;
      }

      .aa-modal-footer {
        display: flex;
        gap: 12px;
        padding: 16px 24px;
        border-top: 2px solid #e2e8f0;
      }

      .aa-btn {
        padding: 10px 20px;
        border: none;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s ease;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      }

      .aa-btn-primary {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        flex: 1;
      }

      .aa-btn-primary:hover:not(:disabled) {
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
      }

      .aa-btn-primary:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }

      .aa-btn-secondary {
        background: #f1f5f9;
        color: #64748b;
      }

      .aa-btn-secondary:hover {
        background: #e2e8f0;
        color: #1e293b;
      }

      .aa-modal-error .aa-modal-header h3 {
        background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
      }

      .aa-modal-error .aa-result-text {
        color: #991b1b;
      }
    `;

    document.head.appendChild(style);
    console.log('[AA] injectStyles: styles successfully injected');
  }

  // Initialize styles
  console.log('[AA] Main module execution: About to inject styles');
  injectStyles();
  console.log('[AA] Main module execution: Complete, waiting for messages');
})();
