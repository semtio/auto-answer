// Background service worker for GPT Helper extension

console.log('GPT Helper background service worker loaded');

// Store popup port for relay messages
let popupPort = null;

// Listen for extension installation
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('Extension installed');
  } else if (details.reason === 'update') {
    console.log('Extension updated');
  }
});

// Listen for popup connection
chrome.runtime.onConnect.addListener((port) => {
  if (port.name === 'popup') {
    console.log('Popup connected');
    popupPort = port;

    port.onDisconnect.addListener(() => {
      console.log('Popup disconnected');
      popupPort = null;
    });
  }
});

// Listen for messages from content scripts, popup, or popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Background received message:', request.action, 'from:', sender.url);

  if (request.action === 'testAPI') {
    testAPIConnection(request.apiKey)
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  } else if (request.action === 'generateAnswer') {
    console.log('=== BACKGROUND: ПОЛУЧЕН REQUEST ===');
    console.log('request.text:', request.text);
    console.log('request.model:', request.model);
    console.log('request.positivePrompt:', request.positivePrompt || '(ПУСТО В REQUEST!)');
    console.log('request.negativePrompt:', request.negativePrompt || '(пусто)');
    console.log('request.baseContent:', request.baseContent ? `${request.baseContent.length} символов` : '(ПУСТО В REQUEST!)');
    console.log('request.language:', request.language);

    generateAnswer(
      request.text,
      request.apiKey,
      request.model,
      request.positivePrompt,
      request.negativePrompt,
      request.baseContent,
      request.language
    )
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  } else if (request.action === 'elementSelected') {
    // Save selected text and relay to popup if open
    console.log('Element selected:', request.text?.substring(0, 50));
    chrome.storage.local.set({ lastSelectedText: request.text });

    if (popupPort) {
      popupPort.postMessage({
        action: 'elementSelected',
        text: request.text
      });
    }
    sendResponse({ success: true });
    return true;
  } else if (request.action === 'enableSelector' || request.action === 'disableSelector') {
    handleSelectorCommand(request.action)
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
});

async function handleSelectorCommand(action) {
  console.log(`handleSelectorCommand: ${action}`);

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.id) {
    console.warn('Selector: активная вкладка не найдена');
    return { success: false, error: 'Активная вкладка не найдена' };
  }

  const tabUrl = tab.url || '';
  console.log('Selector: активная вкладка', tab.id, tabUrl.substring(0, 100));

  const isAllowed = tabUrl.startsWith('http://') || tabUrl.startsWith('https://') || tabUrl.startsWith('file://');
  if (!isAllowed) {
    console.warn('Selector: страница не поддерживается', tabUrl);
    return { success: false, error: 'Селектор недоступен на этой странице' };
  }

  // Try to send message to existing content script
  const sendToTab = () => new Promise((resolve, reject) => {
    console.log(`Trying to send ${action} to tab ${tab.id}`);

    chrome.tabs.sendMessage(tab.id, { action }, (response) => {
      if (chrome.runtime.lastError) {
        console.warn(`sendMessage error: ${chrome.runtime.lastError.message}`);
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        console.log(`sendMessage success for ${action}:`, response);
        resolve(response || { success: true });
      }
    });
  });

  // First attempt: send to existing content script
  try {
    const result = await sendToTab();
    console.log(`${action} sent successfully to existing content script`);
    return { success: true };
  } catch (error) {
    console.log(`${action} failed, trying to inject content.js: ${error.message}`);

    // Second attempt: inject content script if not present
    try {
      await new Promise((resolve, reject) => {
        chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content.js']
        }, (results) => {
          if (chrome.runtime.lastError) {
            console.error('Script injection error:', chrome.runtime.lastError);
            reject(chrome.runtime.lastError);
          } else {
            console.log('Content script injected successfully');
            resolve(results);
          }
        });
      });

      // Wait a bit for content script to initialize
      await new Promise(resolve => setTimeout(resolve, 200));

      // Try sending message again
      const result = await sendToTab();
      console.log(`${action} sent successfully after injection`);
      return { success: true };
    } catch (injectError) {
      console.error('Failed to inject content script:', injectError);
      return { success: false, error: `Не удалось инициализировать селектор: ${injectError.message}` };
    }
  }
}

// Test API connection
async function testAPIConnection(apiKey) {
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
      return {
        success: true,
        message: `Connected! Available models: ${data.data.length}`
      };
    } else {
      const error = await response.json();
      return {
        success: false,
        error: error.error?.message || 'Invalid API key'
      };
    }
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

// Generate answer using OpenAI API
async function generateAnswer(text, apiKey, model = 'gpt-4o-mini', positivePrompt = '', negativePrompt = '', baseContent = '') {
  try {
    console.log('=== BACKGROUND: ПОЛУЧЕНЫ ПАРАМЕТРЫ ===');
    console.log('text:', text);
    console.log('model:', model);
    console.log('positivePrompt:', positivePrompt || '(ПУСТО!)');
    console.log('negativePrompt:', negativePrompt || '(пусто)');
    console.log('baseContent:', baseContent ? `${baseContent.length} символов` : '(ПУСТО!)');

    // КРИТИЧЕСКИ ВАЖНО: Формирование системного промпта со ВСЕМИ настройками
    let systemContent = '';

    // 1. База данных (если есть) - идет первым блоком
    if (baseContent && baseContent.trim()) {
      systemContent += `БАЗА ДАННЫХ (обязательно используй эту информацию для ответа):\n\n${baseContent}\n\n`;
      systemContent += '---\n\n';
    }

    // 2. Положительный промпт (основные инструкции)
    if (positivePrompt && positivePrompt.trim()) {
      systemContent += `ИНСТРУКЦИИ:\n${positivePrompt}\n\n`;
    } else {
      systemContent += 'Ты профессиональный помощник службы поддержки. Предоставляй точные, полезные и вежливые ответы.\n\n';
    }

    // 3. Отрицательный промпт (что НЕ делать)
    if (negativePrompt && negativePrompt.trim()) {
      systemContent += `ЧТО НЕ ДЕЛАТЬ (строго соблюдай эти ограничения):\n${negativePrompt}\n\n`;
    }

    console.log('=== ИТОГОВЫЙ СИСТЕМНЫЙ ПРОМПТ ===');
    console.log(systemContent);
    console.log('=== КОНЕЦ СИСТЕМНОГО ПРОМПТА ===');

    // Отправка запроса к OpenAI
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: model, // НЕ HARDCODE! Используем модель из настроек
        messages: [
          {
            role: 'system',
            content: systemContent
          },
          {
            role: 'user',
            content: text
          }
        ],
        temperature: 0.7,
        max_tokens: 1500
      })
    });

    if (response.ok) {
      const data = await response.json();
      const answer = data.choices[0].message.content;
      return {
        success: true,
        answer: answer
      };
    } else {
      const error = await response.json();
      return {
        success: false,
        error: error.error?.message || 'Failed to generate answer'
      };
    }
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

