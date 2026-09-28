#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const sourceFiles = [
  'source/docs/practice/raw/01-practice-test.raw.md',
  'source/docs/practice/raw/02-practice-test.raw.md',
  'source/docs/practice/raw/03-practice-test.raw.md',
];
const outputFile = path.join(repoRoot, 'docs/questions.json');

const choosePattern = /\bchoose\s+(two|three|four|all that apply)\b/i;

function normalizeText(lines) {
  return lines
    .join('\n')
    .replace(/[ \t]+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function finalizeQuestion(question, questions, sourceFile) {
  if (!question) {
    return;
  }

  const text = normalizeText(question.textLines);
  const options = question.options.map((option) => ({
    key: option.key,
    text: normalizeText(option.textLines),
  }));

  if (!text || options.length === 0 || question.correctAnswers.length === 0) {
    throw new Error(`Malformed question ${question.id} in ${sourceFile}`);
  }

  questions.push({
    id: question.id,
    number: question.number,
    text,
    options,
    correctAnswers: question.correctAnswers,
    multiSelect: question.correctAnswers.length > 1 || choosePattern.test(text),
  });
}

function parseFile(relativePath) {
  const absolutePath = path.join(repoRoot, relativePath);
  const content = fs.readFileSync(absolutePath, 'utf8');
  const lines = content.split(/\r?\n/);
  const questions = [];

  let currentQuestion = null;
  let currentOption = null;
  let currentSection = 'preamble';

  for (const rawLine of lines) {
    const line = rawLine.replace(/\r$/, '');
    const questionMatch = line.match(/^(\d{3})\.\s+(.*)$/);
    if (questionMatch) {
      finalizeQuestion(currentQuestion, questions, relativePath);
      currentQuestion = {
        id: questionMatch[1],
        number: Number.parseInt(questionMatch[1], 10),
        textLines: [questionMatch[2]],
        options: [],
        correctAnswers: [],
      };
      currentOption = null;
      currentSection = 'question';
      continue;
    }

    if (!currentQuestion) {
      continue;
    }

    const answerMatch = line.match(/^\*\*Correct Answer\(s\):\*\*\s*(.+?)\s*$/i);
    if (answerMatch) {
      currentQuestion.correctAnswers = answerMatch[1]
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean);
      currentOption = null;
      currentSection = 'answers';
      continue;
    }

    const optionMatch = line.match(/^([A-Z])\.\s+(.*)$/);
    if (optionMatch) {
      currentOption = {
        key: optionMatch[1],
        textLines: [optionMatch[2]],
      };
      currentQuestion.options.push(currentOption);
      currentSection = 'option';
      continue;
    }

    if (line.trim() === '') {
      if (currentSection === 'question' && currentQuestion.textLines.length > 0) {
        currentQuestion.textLines.push('');
      } else if (currentSection === 'option' && currentOption && currentOption.textLines.length > 0) {
        currentOption.textLines.push('');
      }
      continue;
    }

    if (currentSection === 'option' && currentOption) {
      currentOption.textLines.push(line.trim());
      continue;
    }

    currentQuestion.textLines.push(line.trim());
  }

  finalizeQuestion(currentQuestion, questions, relativePath);
  return questions;
}

function validateQuestions(questions) {
  if (questions.length !== 300) {
    throw new Error(`Expected 300 questions, found ${questions.length}`);
  }

  const seen = new Set();
  questions.forEach((question, index) => {
    const expectedNumber = index + 1;
    if (question.number !== expectedNumber) {
      throw new Error(`Expected question ${String(expectedNumber).padStart(3, '0')}, found ${question.id}`);
    }

    if (seen.has(question.id)) {
      throw new Error(`Duplicate question id ${question.id}`);
    }
    seen.add(question.id);

    const optionKeys = new Set(question.options.map((option) => option.key));
    question.correctAnswers.forEach((answer) => {
      if (!optionKeys.has(answer)) {
        throw new Error(`Question ${question.id} references missing answer option ${answer}`);
      }
    });
  });
}

function build() {
  const questions = sourceFiles.flatMap((filePath) => parseFile(filePath));
  validateQuestions(questions);

  const payload = {
    generatedAt: new Date().toISOString(),
    totalQuestions: questions.length,
    sourceFiles,
    questions,
  };

  fs.writeFileSync(outputFile, `${JSON.stringify(payload, null, 2)}\n`);
  console.log(`Generated ${outputFile} with ${questions.length} questions.`);
}

build();
