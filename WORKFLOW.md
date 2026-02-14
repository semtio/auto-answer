# Правила работы расширения Auto-Answer

## КРИТИЧЕСКИ ВАЖНЫЕ ПРАВИЛА (ВСЕГДА СОБЛЮДАТЬ!)

### 1. Выбор элемента на странице

**Последовательность действий:**
1. Пользователь открывает popup расширения
2. Пользователь нажимает кнопку **"Выбрать элемент"** (стрелка)
3. Content script активируется на странице
4. Пользователь кликает по элементу на странице
5. Текст выбранного элемента **ОБЯЗАТЕЛЬНО** должен:
   - Появиться в поле `<textarea id="inputText">`
   - **СОХРАНИТЬСЯ** в storage текущей вкладки (`tab_{id}_data.inputText`)
6. При повторном открытии popup текст **ДОЛЖЕН** отображаться в поле

**КОД ДОЛЖЕН:**
- После получения события `elementSelected` записать текст в `elements.inputText.value`
- Вызвать `window.updateCurrentTabField('inputText', text)` для сохранения

### 2. Генерация ответа

**ОБЯЗАТЕЛЬНЫЙ порядок действий:**

1. Пользователь вводит/выбирает текст вопроса
2. Пользователь нажимает **"Сгенерировать ответ"**
3. Система собирает **ВСЕ** параметры:
   - ✅ API ключ (`apiKey`)
   - ✅ Текст вопроса (`inputText`)
   - ✅ **База данных** (`baseContent`) - если загружена
   - ✅ **Положительный промпт** (`positivePrompt`)
   - ✅ **Отрицательный промпт** (`negativePrompt`)
   - ✅ **Язык ответа** (`answerLanguage`: 'ru', 'en', 'uk')
   - ✅ **Модель GPT** (`gptModel`: 'gpt-4o', 'gpt-4o-mini', 'gpt-3.5-turbo')

4. **ФОРМИРОВАНИЕ ЗАПРОСА К OPENAI:**

```javascript
{
  model: gptModel, // НЕ HARDCODE!
  messages: [
    {
      role: 'system',
      content: `СИСТЕМНЫЙ ПРОМПТ:

${baseContent ? `БАЗА ДАННЫХ:\n${baseContent}\n\n` : ''}

ИНСТРУКЦИИ:
${positivePrompt || 'Ты профессиональный помощник службы поддержки.'}

${negativePrompt ? `\nЧТО НЕ ДЕЛАТЬ:\n${negativePrompt}` : ''}

ЯЗЫК ОТВЕТА: ${answerLanguage === 'ru' ? 'Русский' : answerLanguage === 'en' ? 'English' : 'Українська'}`
    },
    {
      role: 'user',
      content: inputText
    }
  ],
  temperature: 0.7,
  max_tokens: 1500
}
```

5. Отправка запроса к OpenAI API
6. Получение ответа
7. Отображение ответа в `<textarea id="answerText">`
8. Сохранение ответа в storage вкладки

### 3. Контекст для AI

**AI ДОЛЖЕН ВИДЕТЬ (в указанном порядке):**

1. **База данных** (если загружена) - первым блоком в system message
2. **Положительный промпт** - основные инструкции
3. **Отрицательный промпт** - ограничения и запреты
4. **Язык ответа** - явное указание языка
5. **Текст вопроса** - в user message

**НИ В КОЕМ СЛУЧАЕ НЕ:**
- ❌ Hardcode модели в коде
- ❌ Hardcode системного промпта
- ❌ Игнорировать базу данных
- ❌ Игнорировать настройки пользователя
- ❌ Использовать старые/кешированные значения

### 4. Система вкладок

**Каждая вкладка хранит ОТДЕЛЬНО:**
- `inputText` - текст вопроса
- `answerText` - сгенерированный ответ
- `positivePrompt` - положительный промпт
- `negativePrompt` - отрицательный промпт
- `answerLanguage` - язык ответа
- `gptModel` - модель GPT

**ОБЩИЕ для всех вкладок:**
- `apiKey` - API ключ OpenAI
- `baseContent` - содержимое базы данных
- `baseFileName` - имя файла базы данных

**КРИТИЧЕСКИ ВАЖНО - ДВОЙНОЕ СОХРАНЕНИЕ:**

Промпты и настройки должны сохраняться В ДВА МЕСТА:
1. В `tab_{id}_data` - для системы вкладок popup
2. В глобальные ключи (`positivePrompt`, `negativePrompt`, `gptModel`, `answerLanguage`) - для content.js

**Почему это важно:**
- Popup работает с системой вкладок (`tab_{id}_data`)
- Content.js (плавающая кнопка на странице) читает глобальные ключи
- Без синхронизации content.js не увидит промпты из popup

**Когда синхронизировать:**
- При изменении промпта/настройки (событие `change`)
- При загрузке вкладки (`loadTabData()`)
- При переключении вкладок (`switchTab()`)

### 5. Сохранение данных

**АВТОМАТИЧЕСКОЕ СОХРАНЕНИЕ должно происходить:**
- При выборе элемента → сохранить `inputText`
- При изменении промптов → сохранить промпты
- При изменении языка → сохранить язык
- При изменении модели → сохранить модель
- После генерации ответа → сохранить `answerText`
- При редактировании названия вкладки → сохранить название

## Файлы и их ответственность

### background.js
- **generateAnswer()** - НЕ ДОЛЖЕН иметь hardcoded значений
- Должен принимать ВСЕ параметры: text, apiKey, model, prompts, base, language
- Должен формировать правильный system message со всем контекстом

### modules/answer/answer.js
- Обработчик выбора элемента → сохранить inputText в storage
- Обработчик генерации → собрать ВСЕ настройки и отправить в background
- Автосохранение всех полей при изменении

### popup.js
- Управление вкладками
- Сохранение/загрузка данных вкладок
- НЕ должен вмешиваться в логику генерации

## Диагностика проблем

### Если промпт игнорируется:

**ОБЯЗАТЕЛЬНАЯ ПРОЦЕДУРА ОТЛАДКИ:**

1. **Откройте консоль разработчика:**
   - Для popup: Правый клик на иконку расширения → "Проверить элемент"
   - Для background: chrome://extensions/ → "Service worker" → "Проверить"

2. **Нажмите "Сгенерировать ответ" и проверьте логи:**

   В консоли popup должно быть:
   ```
   === ОТПРАВКА ЗАПРОСА НА ГЕНЕРАЦИЮ ===
   Текст вопроса: ...
   Модель: gpt-4o-mini
   Положительный промпт: Какой бы элемент я тебе не показал...
   Отрицательный промпт: (пусто)
   База данных: (не загружена)
   Язык: ru
   ```

   В консоли background script должно быть:
   ```
   === BACKGROUND: ПОЛУЧЕН REQUEST ===
   request.positivePrompt: Какой бы элемент я тебе не показал...

   === BACKGROUND: ПОЛУЧЕНЫ ПАРАМЕТРЫ ===
   positivePrompt: Какой бы элемент я тебе не показал...

   === ИТОГОВЫЙ СИСТЕМНЫЙ ПРОМПТ ===
   ИНСТРУКЦИИ:
   Какой бы элемент я тебе не показал, на все вопросы отвечай "Так точно!"
   ```

3. **Проверьте:**
   - ❌ Если в логах видно `(ПУСТО!)` - значение не читается из поля
   - ❌ Если промпт есть в request, но нет в итоговом системном промпте - ошибка в generateAnswer
   - ✅ Если промпт есть везде - проблема в API или кэше

### Типичные ошибки:

Если что-то не работает, проверить:
1. ✅ Читаются ли значения из DOM (`elements.positivePrompt?.value`)
2. ✅ Передаются ли они в chrome.runtime.sendMessage
3. ✅ Получает ли их background.js в request
4. ✅ Попадают ли они в функцию generateAnswer
5. ✅ Формируется ли правильный systemContent
6. ✅ Отправляется ли правильный JSON в OpenAI API

## Пример корректного запроса

```javascript
// В answer.js при клике на "Сгенерировать ответ"

// 1. Получить глобальные настройки
const settings = await chrome.storage.local.get(['apiKey', 'baseContent']);

// 2. Прочитать значения НАПРЯМУЮ из DOM элементов (КРИТИЧЕСКИ ВАЖНО!)
const positivePrompt = elements.positivePrompt?.value?.trim() || '';
const negativePrompt = elements.negativePrompt?.value?.trim() || '';
const answerLanguage = elements.answerLanguage?.value || 'ru';
const gptModel = elements.gptModel?.value || 'gpt-4o-mini';
const userText = elements.inputText.value.trim();

// 3. Вывести в консоль для отладки
console.log('Положительный промпт:', positivePrompt || '(пусто)');

// 4. Отправить ВСЕ параметры
const response = await chrome.runtime.sendMessage({
  action: 'generateAnswer',
  apiKey: settings.apiKey,
  text: userText,
  model: gptModel,
  positivePrompt: positivePrompt,  // Напрямую из DOM!
  negativePrompt: negativePrompt,  // Напрямую из DOM!
  baseContent: settings.baseContent || '',
  language: answerLanguage  // Напрямую из DOM!
});
```

```javascript
// В background.js

async function generateAnswer(text, apiKey, model, positivePrompt, negativePrompt, baseContent, language) {
  // 1. Вывести что получили
  console.log('positivePrompt:', positivePrompt || '(ПУСТО!)');

  // 2. Сформировать системный промпт
  let systemContent = '';

  if (baseContent && baseContent.trim()) {
    systemContent += `БАЗА ДАННЫХ:\n\n${baseContent}\n\n---\n\n`;
  }

  if (positivePrompt && positivePrompt.trim()) {
    systemContent += `ИНСТРУКЦИИ:\n${positivePrompt}\n\n`;
  } else {
    systemContent += 'Ты профессиональный помощник...\n\n';
  }

  if (negativePrompt && negativePrompt.trim()) {
    systemContent += `ЧТО НЕ ДЕЛАТЬ:\n${negativePrompt}\n\n`;
  }

  systemContent += `ВАЖНО: Отвечай ТОЛЬКО на языке: ${languageName}`;

  // 3. Вывести итоговый промпт
  console.log('=== ИТОГОВЫЙ СИСТЕМНЫЙ ПРОМПТ ===');
  console.log(systemContent);

  // 4. Отправить в OpenAI
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: model,  // НЕ HARDCODE!!!
      messages: [
        { role: 'system', content: systemContent },  // Весь контекст!
        { role: 'user', content: text }
      ]
    })
  });
}
```

**ЭТИ ПРАВИЛА НЕЛЬЗЯ НАРУШАТЬ НИ ПРИ КАКИХ ОБСТОЯТЕЛЬСТВАХ!**
