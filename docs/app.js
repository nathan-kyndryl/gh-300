const STORAGE_KEYS = {
  settings: 'gh300-exam-settings',
  exam: 'gh300-in-progress-exam',
  history: 'gh300-exam-history',
};

const defaults = {
  questionCount: 65,
  timeLimit: 100,
  passingThreshold: 700,
};

const DOMAIN_TARGETS = {
  responsibleUse: 17.5,
  useCopilotFeatures: 27.5,
  copilotFeatures: 27.5,
  dataArchitecture: 12.5,
  promptEngineering: 12.5,
  productivity: 12.5,
  privacySafeguards: 12.5,
};

const DOMAIN_LABELS = {
  responsibleUse: 'Use Copilot Responsibly',
  useCopilotFeatures: 'Use Copilot Features',
  copilotFeatures: 'Copilot Features',
  dataArchitecture: 'Data and Architecture',
  promptEngineering: 'Prompt Engineering and Context Crafting',
  productivity: 'Developer Productivity',
  privacySafeguards: 'Privacy, Exclusions, and Safeguards',
};

const choosePattern = /\bchoose\s+(two|three|four|all that apply)\b/i;
const scenarioPattern = /\b(scenario|workflow|pull request|incident|team|organization|enterprise|best fit|best approach|what should you do)\b/i;
const dragAndDropPattern = /\b(scenario|workflow|pull request|incident|best fit|best approach|what should you do)\b/i;

const state = {
  questionBank: null,
  settings: loadStoredJson(STORAGE_KEYS.settings, defaults),
  history: loadStoredJson(STORAGE_KEYS.history, []),
  exam: loadStoredJson(STORAGE_KEYS.exam, null),
  timerId: null,
};

const elements = {
  loadingCard: document.getElementById('loading-card'),
  errorCard: document.getElementById('error-card'),
  configScreen: document.getElementById('config-screen'),
  examScreen: document.getElementById('exam-screen'),
  resultsScreen: document.getElementById('results-screen'),
  configForm: document.getElementById('config-form'),
  questionCount: document.getElementById('question-count'),
  questionPoolWarning: document.getElementById('question-pool-warning'),
  domainMixCard: document.getElementById('domain-mix-card'),
  domainMixList: document.getElementById('domain-mix-list'),
  timeLimit: document.getElementById('time-limit'),
  passingThreshold: document.getElementById('passing-threshold'),
  questionPresets: document.getElementById('question-presets'),
  timePresets: document.getElementById('time-presets'),
  historyEmpty: document.getElementById('history-empty'),
  historyList: document.getElementById('history-list'),
  resumeCard: document.getElementById('resume-card'),
  resumeSummary: document.getElementById('resume-summary'),
  resumeExam: document.getElementById('resume-exam'),
  discardExam: document.getElementById('discard-exam'),
  questionPosition: document.getElementById('question-position'),
  questionTotal: document.getElementById('question-total'),
  questionId: document.getElementById('question-id'),
  timer: document.getElementById('timer'),
  questionType: document.getElementById('question-type'),
  markReview: document.getElementById('mark-review'),
  questionText: document.getElementById('question-text'),
  dragDropPanel: document.getElementById('drag-drop-panel'),
  dragDropHelp: document.getElementById('drag-drop-help'),
  dragAvailable: document.getElementById('drag-available'),
  dragSelected: document.getElementById('drag-selected'),
  answersForm: document.getElementById('answers-form'),
  previousQuestion: document.getElementById('previous-question'),
  nextQuestion: document.getElementById('next-question'),
  navigatorGrid: document.getElementById('navigator-grid'),
  submitExam: document.getElementById('submit-exam'),
  resultsScore: document.getElementById('results-score'),
  resultsCorrect: document.getElementById('results-correct'),
  resultsStatus: document.getElementById('results-status'),
  resultsReview: document.getElementById('results-review'),
  newExam: document.getElementById('new-exam'),
};

initialize();

async function initialize() {
  wireEvents();
  try {
    const response = await fetch('./questions.json', { cache: 'no-store' });
    if (!response.ok) {
      throw new Error(`Unable to load question bank (${response.status})`);
    }

    state.questionBank = await response.json();
    if (!state.questionBank || !Array.isArray(state.questionBank.questions) || state.questionBank.questions.length === 0) {
      throw new Error('Question bank is empty or malformed.');
    }

    const sourceQuestionCount = state.questionBank.questions.length;
    const uniqueQuestionCount = buildUniqueQuestionPool(state.questionBank.questions).length;
    elements.questionCount.max = String(uniqueQuestionCount);
    renderQuestionPoolWarning(sourceQuestionCount, uniqueQuestionCount);

    hydrateSettings();
    renderDomainMixPreview(elements.questionCount.value);
    renderHistory();
    refreshResumeCard();
    showScreen('config');
  } catch (error) {
    showError(error.message);
  } finally {
    elements.loadingCard.classList.add('hidden');
  }
}

function wireEvents() {
  elements.configForm.addEventListener('submit', handleStartExam);
  elements.questionPresets.addEventListener('click', (event) => handlePresetClick(event, elements.questionCount));
  elements.timePresets.addEventListener('click', (event) => handlePresetClick(event, elements.timeLimit));
  elements.questionCount.addEventListener('input', () => {
    syncPresetButtons(elements.questionPresets, elements.questionCount.value);
    renderDomainMixPreview(elements.questionCount.value);
  });
  elements.timeLimit.addEventListener('input', () => syncPresetButtons(elements.timePresets, elements.timeLimit.value));
  elements.resumeExam.addEventListener('click', () => {
    if (!state.exam) {
      return;
    }
    resumeExam();
  });
  elements.discardExam.addEventListener('click', discardSavedExam);
  elements.previousQuestion.addEventListener('click', () => navigateQuestion(-1));
  elements.nextQuestion.addEventListener('click', () => navigateQuestion(1));
  elements.markReview.addEventListener('click', toggleMarkedQuestion);
  elements.answersForm.addEventListener('change', handleAnswerChange);
  elements.submitExam.addEventListener('click', () => finalizeExam({ autoSubmitted: false }));
  elements.newExam.addEventListener('click', () => {
    state.exam = null;
    persistExam();
    clearTimer();
    refreshResumeCard();
    showScreen('config');
  });
}

function handlePresetClick(event, input) {
  const target = event.target.closest('[data-value]');
  if (!target) {
    return;
  }

  input.value = target.dataset.value;
  syncPresetButtons(event.currentTarget, input.value);
  if (input === elements.questionCount) {
    renderDomainMixPreview(input.value);
  }
}

function syncPresetButtons(container, value) {
  container.querySelectorAll('.chip').forEach((button) => {
    button.classList.toggle('active', button.dataset.value === String(value));
  });
}

function hydrateSettings() {
  const questionCount = state.settings.questionCount ?? defaults.questionCount;
  const timeLimit = state.settings.timeLimit ?? defaults.timeLimit;
  const passingThreshold = normalizePassingThreshold(state.settings.passingThreshold ?? defaults.passingThreshold);

  if (state.settings.passingThreshold !== passingThreshold) {
    state.settings.passingThreshold = passingThreshold;
    localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(state.settings));
  }

  elements.questionCount.value = questionCount;
  elements.timeLimit.value = timeLimit;
  elements.passingThreshold.value = passingThreshold;
  syncPresetButtons(elements.questionPresets, elements.questionCount.value);
  syncPresetButtons(elements.timePresets, elements.timeLimit.value);
  renderDomainMixPreview(elements.questionCount.value);
}

function handleStartExam(event) {
  event.preventDefault();
  if (!state.questionBank) {
    return;
  }

  const uniqueQuestionCount = buildUniqueQuestionPool(state.questionBank.questions).length;
  const questionCount = clampNumber(Number(elements.questionCount.value), 1, uniqueQuestionCount);
  const timeLimit = clampNumber(Number(elements.timeLimit.value || 0), 0, 600);
  const passingThreshold = clampNumber(normalizePassingThreshold(Number(elements.passingThreshold.value)), 0, 1000);

  state.settings = {
    questionCount,
    timeLimit,
    passingThreshold,
  };
  localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(state.settings));

  state.exam = createExam(questionCount, timeLimit, passingThreshold);
  persistExam();
  resumeExam();
}

function createExam(questionCount, timeLimit, passingThreshold) {
  const uniqueQuestionPool = buildUniqueQuestionPool(state.questionBank.questions);
  const selectedCount = Math.min(questionCount, uniqueQuestionPool.length);
  const selectedQuestions = selectWeightedQuestions(uniqueQuestionPool, selectedCount).map((question) =>
    shuffleQuestionOptions(question)
  );

  const startedAt = Date.now();
  const endsAt = timeLimit > 0 ? startedAt + timeLimit * 60 * 1000 : null;

  return {
    version: 1,
    startedAt,
    endsAt,
    timeLimit,
    passingThreshold,
    currentIndex: 0,
    answers: {},
    markedQuestionIds: [],
    questions: selectedQuestions,
    completed: false,
    autoSubmitted: false,
    submittedAt: null,
    results: null,
  };
}

function resumeExam() {
  if (!state.exam) {
    return;
  }

  if (state.exam.completed && state.exam.results) {
    renderResults();
    showScreen('results');
    return;
  }

  if (state.exam.endsAt && Date.now() >= state.exam.endsAt) {
    finalizeExam({ autoSubmitted: true });
    return;
  }

  renderExam();
  startTimer();
  showScreen('exam');
}

function discardSavedExam() {
  state.exam = null;
  persistExam();
  refreshResumeCard();
}

function refreshResumeCard() {
  if (!state.exam || state.exam.completed) {
    elements.resumeCard.classList.add('hidden');
    return;
  }

  const answeredCount = Object.values(state.exam.answers).filter((value) => Array.isArray(value) && value.length > 0).length;
  const minutes = state.exam.timeLimit > 0 ? `${state.exam.timeLimit} minute timer` : 'no time limit';
  elements.resumeSummary.textContent = `Resume ${state.exam.questions.length} questions (${answeredCount} answered, ${minutes}).`;
  elements.resumeCard.classList.remove('hidden');
}

function renderHistory() {
  elements.historyList.innerHTML = '';
  if (!state.history.length) {
    elements.historyEmpty.classList.remove('hidden');
    return;
  }

  elements.historyEmpty.classList.add('hidden');
  state.history.forEach((entry) => {
    const item = document.createElement('article');
    item.className = 'history-item';
    item.innerHTML = `
      <strong>${entry.scaledScore ?? Math.round((entry.percentage / 100) * 1000)}/1000 (${entry.percentage}%)</strong>
      <div class="field-note">${new Date(entry.completedAt).toLocaleString()}</div>
      <div class="field-note">${entry.questionCount} questions · ${entry.autoSubmitted ? 'Auto-submitted' : 'Submitted manually'}</div>
    `;
    elements.historyList.appendChild(item);
  });
}

function renderExam() {
  const currentQuestion = getCurrentQuestion();
  if (!currentQuestion) {
    return;
  }

  const selectedAnswers = new Set(state.exam.answers[currentQuestion.id] || []);
  const questionIndex = state.exam.currentIndex;
  const useDragAndDrop = shouldUseDragAndDrop(currentQuestion);

  elements.questionPosition.textContent = String(questionIndex + 1);
  elements.questionTotal.textContent = String(state.exam.questions.length);
  elements.questionId.textContent = `Question ${currentQuestion.id}`;
  elements.questionType.textContent = getQuestionTypeLabel(currentQuestion);
  elements.markReview.textContent = isMarked(currentQuestion.id) ? 'Marked for review' : 'Mark for review';
  elements.questionText.innerHTML = renderMarkdownBlock(currentQuestion.text);

  elements.answersForm.classList.toggle('hidden', useDragAndDrop);
  elements.dragDropPanel?.classList.toggle('hidden', !useDragAndDrop);

  if (useDragAndDrop) {
    renderDragAndDropQuestion(currentQuestion, selectedAnswers);
  } else {
    elements.answersForm.innerHTML = '';
    currentQuestion.options.forEach((option) => {
      const label = document.createElement('label');
      label.className = 'answer-option';
      label.innerHTML = `
      <input
        type="${currentQuestion.multiSelect ? 'checkbox' : 'radio'}"
        name="answer"
        value="${option.displayKey}"
        ${selectedAnswers.has(option.displayKey) ? 'checked' : ''}
      />
      <span class="answer-option__label">${option.displayKey}.</span>
      <span>${renderMarkdownInline(option.text)}</span>
    `;
      elements.answersForm.appendChild(label);
    });
  }

  elements.previousQuestion.disabled = questionIndex === 0;
  elements.nextQuestion.textContent = questionIndex === state.exam.questions.length - 1 ? 'Review final question' : 'Next';

  renderNavigator();
  updateTimerText();
}

function renderNavigator() {
  elements.navigatorGrid.innerHTML = '';
  state.exam.questions.forEach((question, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'nav-pill';

    if (index === state.exam.currentIndex) {
      button.classList.add('nav-pill--current');
    }
    if ((state.exam.answers[question.id] || []).length > 0) {
      button.classList.add('nav-pill--answered');
    }
    if (isMarked(question.id)) {
      button.classList.add('nav-pill--marked');
    }

    button.textContent = String(index + 1);
    button.addEventListener('click', () => {
      state.exam.currentIndex = index;
      persistExam();
      renderExam();
    });

    elements.navigatorGrid.appendChild(button);
  });
}

function handleAnswerChange() {
  const currentQuestion = getCurrentQuestion();
  if (!currentQuestion) {
    return;
  }

  const selectedValues = Array.from(elements.answersForm.querySelectorAll('input:checked')).map((input) => input.value);
  if (selectedValues.length === 0) {
    delete state.exam.answers[currentQuestion.id];
  } else {
    state.exam.answers[currentQuestion.id] = selectedValues;
  }
  persistExam();
  renderNavigator();
}

function navigateQuestion(step) {
  const nextIndex = clampNumber(state.exam.currentIndex + step, 0, state.exam.questions.length - 1);
  state.exam.currentIndex = nextIndex;
  persistExam();
  renderExam();
}

function toggleMarkedQuestion() {
  const currentQuestion = getCurrentQuestion();
  if (!currentQuestion) {
    return;
  }

  const marked = new Set(state.exam.markedQuestionIds);
  if (marked.has(currentQuestion.id)) {
    marked.delete(currentQuestion.id);
  } else {
    marked.add(currentQuestion.id);
  }
  state.exam.markedQuestionIds = Array.from(marked);
  persistExam();
  renderExam();
}

function finalizeExam({ autoSubmitted }) {
  if (!state.exam || state.exam.completed) {
    return;
  }

  if (!autoSubmitted) {
    const confirmed = window.confirm('Submit this exam and calculate your score?');
    if (!confirmed) {
      return;
    }
  }

  const results = gradeExam(state.exam);
  state.exam.completed = true;
  state.exam.autoSubmitted = autoSubmitted;
  state.exam.submittedAt = Date.now();
  state.exam.results = results;
  persistExam();
  clearTimer();

  const historyEntry = {
    completedAt: state.exam.submittedAt,
    questionCount: state.exam.questions.length,
    correct: results.correctCount,
    total: results.totalQuestions,
    percentage: results.percentage,
    scaledScore: results.scaledScore,
    autoSubmitted,
  };
  state.history = [historyEntry, ...state.history].slice(0, 10);
  localStorage.setItem(STORAGE_KEYS.history, JSON.stringify(state.history));

  renderHistory();
  renderResults();
  showScreen('results');
}

function renderResults() {
  if (!state.exam || !state.exam.results) {
    return;
  }

  const { results } = state.exam;
  elements.resultsScore.textContent = `${results.scaledScore}/1000 (${results.percentage}%)`;
  elements.resultsCorrect.textContent = `${results.correctCount}/${results.totalQuestions}`;
  elements.resultsStatus.textContent = results.passed ? `Pass (>= ${state.exam.passingThreshold}/1000)` : `Needs more practice (< ${state.exam.passingThreshold}/1000)`;
  elements.resultsStatus.style.color = results.passed ? 'var(--success)' : 'var(--danger)';

  elements.resultsReview.innerHTML = '';
  results.questions.forEach((review) => {
    const card = document.createElement('article');
    card.className = `card review-card ${review.correct ? 'review-card--correct' : 'review-card--incorrect'}`;
    card.innerHTML = `
      <div class="status-row">
        <strong>Question ${review.id}</strong>
        <span class="badge">${review.correct ? 'Correct' : 'Incorrect'}</span>
      </div>
      <div class="markdown-block">${renderMarkdownBlock(review.text)}</div>
      <div class="stack">
        ${review.options
          .map((option) => {
            const classes = ['review-answer'];
            if (option.selected && option.correct) {
              classes.push('review-answer--correct');
            } else if (option.selected && !option.correct) {
              classes.push('review-answer--wrong');
            } else if (!option.selected && option.correct) {
              classes.push('review-answer--missed');
            }

            return `
              <div class="${classes.join(' ')}">
                <strong>${option.displayKey}.</strong> ${renderMarkdownInline(option.text)}
                ${option.selected ? '<div class="field-note">Your selection</div>' : ''}
                ${option.correct ? '<div class="field-note">Correct answer</div>' : ''}
              </div>
            `;
          })
          .join('')}
      </div>
    `;
    elements.resultsReview.appendChild(card);
  });
}

function gradeExam(exam) {
  const reviewedQuestions = exam.questions.map((question) => {
    const selected = new Set(exam.answers[question.id] || []);
    const correct = new Set(question.options.filter((option) => option.isCorrect).map((option) => option.displayKey));
    const isCorrect =
      selected.size === correct.size &&
      Array.from(selected).every((value) => correct.has(value));

    return {
      id: question.id,
      text: question.text,
      correct: isCorrect,
      options: question.options.map((option) => ({
        displayKey: option.displayKey,
        text: option.text,
        selected: selected.has(option.displayKey),
        correct: option.isCorrect,
      })),
    };
  });

  const correctCount = reviewedQuestions.filter((question) => question.correct).length;
  const percentage = Math.round((correctCount / reviewedQuestions.length) * 100);
  const scaledScore = Math.round((correctCount / reviewedQuestions.length) * 1000);

  return {
    correctCount,
    totalQuestions: reviewedQuestions.length,
    percentage,
    scaledScore,
    passed: scaledScore >= normalizePassingThreshold(exam.passingThreshold),
    questions: reviewedQuestions,
  };
}

function startTimer() {
  clearTimer();
  if (!state.exam || !state.exam.endsAt) {
    updateTimerText();
    return;
  }

  updateTimerText();
  state.timerId = window.setInterval(() => {
    if (!state.exam || !state.exam.endsAt) {
      clearTimer();
      return;
    }

    if (Date.now() >= state.exam.endsAt) {
      finalizeExam({ autoSubmitted: true });
      return;
    }

    updateTimerText();
  }, 1000);
}

function clearTimer() {
  if (state.timerId) {
    window.clearInterval(state.timerId);
    state.timerId = null;
  }
}

function updateTimerText() {
  if (!state.exam || !state.exam.endsAt) {
    elements.timer.textContent = 'No limit';
    return;
  }

  const remainingMs = Math.max(0, state.exam.endsAt - Date.now());
  const totalSeconds = Math.floor(remainingMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  elements.timer.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function showScreen(name) {
  elements.configScreen.classList.toggle('hidden', name !== 'config');
  elements.examScreen.classList.toggle('hidden', name !== 'exam');
  elements.resultsScreen.classList.toggle('hidden', name !== 'results');
}

function showError(message) {
  elements.errorCard.classList.remove('hidden');
  elements.errorCard.innerHTML = `<h2>Unable to load the simulator</h2><p>${escapeHtml(message)}</p>`;
}

function getCurrentQuestion() {
  return state.exam?.questions?.[state.exam.currentIndex] || null;
}

function isMarked(questionId) {
  return state.exam?.markedQuestionIds?.includes(questionId);
}

function persistExam() {
  if (!state.exam) {
    localStorage.removeItem(STORAGE_KEYS.exam);
    return;
  }
  localStorage.setItem(STORAGE_KEYS.exam, JSON.stringify(state.exam));
  refreshResumeCard();
}

function sampleWithoutReplacement(items, count) {
  return shuffle(items).slice(0, count);
}

function selectWeightedQuestions(questionPool, count) {
  if (!questionPool.length || count <= 0) {
    return [];
  }

  const buckets = bucketQuestionsByDomain(questionPool);
  const domainTargets = computeDomainTargets(count, DOMAIN_TARGETS);
  const selected = [];
  const selectedIds = new Set();

  Object.entries(domainTargets).forEach(([domain, domainCount]) => {
    if (domainCount <= 0) {
      return;
    }

    const bucket = shuffle(buckets[domain] || []);
    for (const question of bucket) {
      if (selected.length >= count) {
        break;
      }
      if (selectedIds.has(question.id)) {
        continue;
      }
      selected.push(question);
      selectedIds.add(question.id);
      if (selected.filter((item) => inferQuestionDomain(item) === domain).length >= domainCount) {
        break;
      }
    }
  });

  if (selected.length < count) {
    const remaining = shuffle(questionPool).filter((question) => !selectedIds.has(question.id));
    for (const question of remaining) {
      if (selected.length >= count) {
        break;
      }
      selected.push(question);
      selectedIds.add(question.id);
    }
  }

  return shuffle(selected).slice(0, count);
}

function bucketQuestionsByDomain(questionPool) {
  return questionPool.reduce(
    (accumulator, question) => {
      const domain = inferQuestionDomain(question);
      if (!accumulator[domain]) {
        accumulator[domain] = [];
      }
      accumulator[domain].push(question);
      return accumulator;
    },
    {
      responsibleUse: [],
      useCopilotFeatures: [],
      copilotFeatures: [],
      dataArchitecture: [],
      promptEngineering: [],
      productivity: [],
      privacySafeguards: [],
    }
  );
}

function computeDomainTargets(totalCount, weightMap) {
  const entries = Object.entries(weightMap);
  const weightTotal = entries.reduce((sum, [, value]) => sum + value, 0);
  const raw = entries.map(([key, value]) => {
    const exact = weightTotal > 0 ? (value / weightTotal) * totalCount : 0;
    const floor = Math.floor(exact);
    return {
      key,
      exact,
      floor,
      remainder: exact - floor,
    };
  });

  let assigned = raw.reduce((sum, entry) => sum + entry.floor, 0);
  const target = Object.fromEntries(raw.map((entry) => [entry.key, entry.floor]));

  raw
    .sort((left, right) => right.remainder - left.remainder)
    .forEach((entry) => {
      if (assigned >= totalCount) {
        return;
      }
      target[entry.key] += 1;
      assigned += 1;
    });

  return target;
}

function inferQuestionDomain(question) {
  const corpus = `${question.text || ''} ${(question.options || []).map((option) => option.text || '').join(' ')}`.toLowerCase();

  if (/\b(content exclusion|public code|duplication detection|privacy|retention|safeguard|secret|credential|pii|policy|compliance|governance)\b/.test(corpus)) {
    return 'privacySafeguards';
  }

  if (/\b(zero-shot|one-shot|few-shot|prompt|context|instruction|role|constraint|example)\b/.test(corpus)) {
    return 'promptEngineering';
  }

  if (/\b(context window|token|inference|training data|model|architecture|grounding|embedding|latency|hallucination)\b/.test(corpus)) {
    return 'dataArchitecture';
  }

  if (/\b(tdd|test|debug|refactor|workflow|sdlc|ci|cd|productivity|documentation|onboard)\b/.test(corpus)) {
    return 'productivity';
  }

  if (/\b(agent mode|coding agent|spaces|mcp|pull request|github\.com|plan|business|enterprise|pro\+|pro|free)\b/.test(corpus)) {
    return 'copilotFeatures';
  }

  if (/\b(chat|inline chat|inline suggestion|edit mode|edits|suggestion|completion|ide)\b/.test(corpus)) {
    return 'useCopilotFeatures';
  }

  if (/\b(responsible ai|fairness|inclusiveness|transparency|accountability|reliability and safety|ethic|toxicity|bias)\b/.test(corpus)) {
    return 'responsibleUse';
  }

  return 'useCopilotFeatures';
}

function shouldUseDragAndDrop(question) {
  return dragAndDropPattern.test(question.text || '');
}

function renderDragAndDropQuestion(question, selectedAnswers) {
  if (!elements.dragAvailable || !elements.dragSelected || !elements.dragDropHelp) {
    return;
  }

  elements.dragDropHelp.textContent = question.multiSelect
    ? 'Drag one or more answers into Selected answers. Drag them back to remove.'
    : 'Drag one answer into Selected answers. Drag it back to change your choice.';

  const selectedKeys = question.options
    .map((option) => option.displayKey)
    .filter((displayKey) => selectedAnswers.has(displayKey));
  const availableKeys = question.options
    .map((option) => option.displayKey)
    .filter((displayKey) => !selectedAnswers.has(displayKey));

  renderDragZone(elements.dragAvailable, availableKeys, question, false);
  renderDragZone(elements.dragSelected, selectedKeys, question, true);
  wireDragZoneDropHandlers(question);
}

function renderDragZone(zoneElement, keys, question, selectedZone) {
  zoneElement.innerHTML = '';
  zoneElement.classList.toggle('drag-zone--empty', keys.length === 0);

  if (keys.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'field-note drag-empty';
    empty.textContent = selectedZone ? 'Drop answer(s) here.' : 'No remaining options.';
    zoneElement.appendChild(empty);
    return;
  }

  keys.forEach((displayKey) => {
    const option = question.options.find((entry) => entry.displayKey === displayKey);
    if (!option) {
      return;
    }

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'drag-option';
    button.draggable = true;
    button.dataset.value = option.displayKey;
    button.innerHTML = `<strong>${option.displayKey}.</strong> ${renderMarkdownInline(option.text)}`;

    button.addEventListener('dragstart', (event) => {
      event.dataTransfer?.setData('text/plain', option.displayKey);
    });

    button.addEventListener('click', () => {
      moveDragDropSelection(question, option.displayKey, !selectedZone);
    });

    zoneElement.appendChild(button);
  });
}

function wireDragZoneDropHandlers(question) {
  const zones = [
    { element: elements.dragAvailable, select: false },
    { element: elements.dragSelected, select: true },
  ];

  zones.forEach(({ element, select }) => {
    if (!element) {
      return;
    }

    element.ondragover = (event) => {
      event.preventDefault();
      element.classList.add('drag-zone--active');
    };

    element.ondragleave = () => {
      element.classList.remove('drag-zone--active');
    };

    element.ondrop = (event) => {
      event.preventDefault();
      element.classList.remove('drag-zone--active');
      const value = event.dataTransfer?.getData('text/plain');
      if (!value) {
        return;
      }
      moveDragDropSelection(question, value, select);
    };
  });
}

function moveDragDropSelection(question, displayKey, select) {
  const selectedValues = Array.from(new Set(state.exam.answers[question.id] || []));
  const hasValue = selectedValues.includes(displayKey);

  if (select) {
    if (!hasValue) {
      if (question.multiSelect) {
        selectedValues.push(displayKey);
      } else {
        selectedValues.splice(0, selectedValues.length, displayKey);
      }
    }
  } else if (hasValue) {
    const nextValues = selectedValues.filter((value) => value !== displayKey);
    selectedValues.splice(0, selectedValues.length, ...nextValues);
  }

  if (selectedValues.length === 0) {
    delete state.exam.answers[question.id];
  } else {
    state.exam.answers[question.id] = selectedValues;
  }

  persistExam();
  renderExam();
}

function renderQuestionPoolWarning(sourceCount, uniqueCount) {
  if (!elements.questionPoolWarning) {
    return;
  }

  if (uniqueCount >= sourceCount) {
    elements.questionPoolWarning.classList.add('hidden');
    elements.questionPoolWarning.textContent = '';
    return;
  }

  elements.questionPoolWarning.textContent = `Duplicate cleanup applied: ${sourceCount} source questions, ${uniqueCount} unique questions. Max exam size is ${uniqueCount}.`;
  elements.questionPoolWarning.classList.remove('hidden');
}

function renderDomainMixPreview(questionCount) {
  if (!elements.domainMixCard || !elements.domainMixList || !state.questionBank?.questions?.length) {
    return;
  }

  const uniqueQuestionCount = buildUniqueQuestionPool(state.questionBank.questions).length;
  if (!uniqueQuestionCount) {
    elements.domainMixCard.classList.add('hidden');
    elements.domainMixList.innerHTML = '';
    return;
  }

  const normalizedCount = clampNumber(Number(questionCount), 1, uniqueQuestionCount);
  const targets = computeDomainTargets(normalizedCount, DOMAIN_TARGETS);

  elements.domainMixCard.classList.remove('hidden');
  elements.domainMixList.innerHTML = Object.entries(targets)
    .map(([domain, count]) => {
      const label = DOMAIN_LABELS[domain] || domain;
      const pct = normalizedCount > 0 ? Math.round((count / normalizedCount) * 100) : 0;
      return `<div class="domain-mix-item"><span>${label}</span><strong>${count} (${pct}%)</strong></div>`;
    })
    .join('');
}

function buildUniqueQuestionPool(questions) {
  const seenIds = new Set();
  const seenFingerprints = new Set();

  return questions.filter((question) => {
    if (!question || typeof question.id === 'undefined') {
      return false;
    }

    const id = String(question.id);
    const fingerprint = getQuestionFingerprint(question);
    if (seenIds.has(id) || seenFingerprints.has(fingerprint)) {
      return false;
    }

    seenIds.add(id);
    seenFingerprints.add(fingerprint);
    return true;
  });
}

function getQuestionFingerprint(question) {
  const normalizedQuestionText = normalizeFingerprintText(question.text);
  const normalizedOptions = (question.options || [])
    .map((option) => normalizeFingerprintText(option?.text))
    .sort()
    .join('||');

  return `${normalizedQuestionText}::${normalizedOptions}`;
}

function normalizeFingerprintText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function shuffleQuestionOptions(question) {
  const shuffledOptions = shuffle(question.options).map((option, index) => ({
    displayKey: String.fromCharCode(65 + index),
    sourceKey: option.key,
    text: option.text,
    isCorrect: question.correctAnswers.includes(option.key),
  }));

  return {
    id: question.id,
    number: question.number,
    text: question.text,
    multiSelect: question.multiSelect || question.correctAnswers.length > 1 || choosePattern.test(question.text),
    options: shuffledOptions,
  };
}

function shuffle(items) {
  const copy = items.map((item) => ({ ...item }));
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

function clampNumber(value, min, max) {
  if (!Number.isFinite(value)) {
    return min;
  }
  return Math.min(max, Math.max(min, Math.round(value)));
}

function normalizePassingThreshold(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return defaults.passingThreshold;
  }

  // Backward compatibility for legacy percent-based saved values.
  if (numeric > 0 && numeric <= 100) {
    return Math.round(numeric * 10);
  }

  return Math.round(numeric);
}

function getQuestionTypeLabel(question) {
  if (scenarioPattern.test(question.text)) {
    return shouldUseDragAndDrop(question) ? 'Scenario-based workflow (drag-and-drop)' : 'Scenario-based workflow';
  }

  if (question.multiSelect) {
    return 'Multiple-response';
  }

  return 'Multiple-choice';
}

function loadStoredJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (error) {
    return fallback;
  }
}

function renderMarkdownBlock(text) {
  return text
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${renderMarkdownInline(paragraph).replace(/\n/g, '<br>')}</p>`)
    .join('');
}

function renderMarkdownInline(text) {
  return escapeHtml(text)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>');
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
