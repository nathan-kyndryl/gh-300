#!/usr/bin/env node

const assert = require('node:assert/strict');

const defaults = {
  repeatAvoidanceWindow: 3,
};

const MAX_REPEAT_AVOIDANCE_WINDOW = 10;

function clampNumber(value, min, max) {
  if (!Number.isFinite(value)) {
    return min;
  }
  return Math.min(max, Math.max(min, Math.round(value)));
}

function getRecentQuestionIds(history, examWindow) {
  const normalizedWindow = clampNumber(
    Number(examWindow ?? defaults.repeatAvoidanceWindow),
    0,
    MAX_REPEAT_AVOIDANCE_WINDOW
  );
  const sourceHistory = Array.isArray(history) ? history : [];
  const recentQuestionIds = new Set();

  sourceHistory.slice(0, normalizedWindow).forEach((entry) => {
    if (!Array.isArray(entry.questionIds)) {
      return;
    }

    entry.questionIds.forEach((questionId) => {
      recentQuestionIds.add(String(questionId));
    });
  });

  return recentQuestionIds;
}

function run() {
  const history = [
    { questionIds: ['A1', 'A2'] },
    { questionIds: ['B1', 'B2'] },
    { questionIds: ['C1', 'C2'] },
    { questionIds: ['D1', 'D2'] },
  ];

  const idsFromDefaultWindow = getRecentQuestionIds(history, undefined);
  assert.equal(idsFromDefaultWindow.size, 6);
  assert.ok(idsFromDefaultWindow.has('A1'));
  assert.ok(idsFromDefaultWindow.has('C2'));
  assert.ok(!idsFromDefaultWindow.has('D1'));

  const idsFromNaNWindow = getRecentQuestionIds(history, Number.NaN);
  assert.equal(idsFromNaNWindow.size, 0);

  const idsFromNegativeWindow = getRecentQuestionIds(history, -5);
  assert.equal(idsFromNegativeWindow.size, 0);

  const idsFromHugeWindow = getRecentQuestionIds(history, 999);
  assert.equal(idsFromHugeWindow.size, 8);

  const idsFromMalformedHistory = getRecentQuestionIds('not-an-array', 3);
  assert.equal(idsFromMalformedHistory.size, 0);

  const idsWithMalformedEntries = getRecentQuestionIds(
    [{ questionIds: ['X1'] }, { foo: 1 }, { questionIds: ['X2'] }],
    3
  );
  assert.equal(idsWithMalformedEntries.size, 2);
  assert.ok(idsWithMalformedEntries.has('X1'));
  assert.ok(idsWithMalformedEntries.has('X2'));

  console.log('PASS: repeat-window self-tests passed');
}

run();
