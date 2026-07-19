/* ============================================================
   Site Register — MCQ Quiz Book
   Pure vanilla JS, no build step. Data lives in localStorage.
   ============================================================ */

const STORAGE_KEY = "siteRegister.quizzes.v1";

/* ---------- Parser ---------- */
/**
 * Parses the plain-text question bank format into:
 * [{ question, options: [{label, text, correct}], explanation }]
 */
function parseQuizText(raw) {
  const lines = raw.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  const questions = [];
  let current = null;
  let mode = null; // 'question' | 'explanation'

  const pushCurrent = () => {
    if (current && current.options.length >= 2 && current.options.some(o => o.correct)) {
      questions.push(current);
    }
    current = null;
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();

    const qMatch = line.match(/^Q\s*\d+[.):]\s*(.*)$/i);
    const optMatch = line.match(/^([A-Da-d])[.)]\s*(.*)$/);
    const expMatch = line.match(/^Explanation\s*:\s*(.*)$/i);
    const isSeparator = /^-{3,}$/.test(line) || /^=+$/.test(line);

    if (qMatch) {
      pushCurrent();
      current = { question: qMatch[1].trim(), options: [], explanation: "" };
      mode = "question";
      continue;
    }

    if (optMatch && current && mode !== "explanation") {
      const rest = optMatch[2];
      // Strip everything from the checkmark onward so the answer isn't leaked
      const cleanText = rest.split("✅")[0].trim();
      const isCorrect = rest.includes("✅");
      current.options.push({
        label: optMatch[1].toUpperCase(),
        text: cleanText || rest.trim(),
        correct: isCorrect
      });
      mode = "option";
      continue;
    }

    if (expMatch && current) {
      current.explanation = expMatch[1].trim();
      mode = "explanation";
      continue;
    }

    if (isSeparator) {
      mode = null;
      continue;
    }

    if (line === "") continue;

    // Continuation of the previous field
    if (current) {
      if (mode === "question") {
        current.question += "\n" + line;
      } else if (mode === "explanation") {
        current.explanation += "\n" + line;
      } else if (mode === "option" && current.options.length) {
        const last = current.options[current.options.length - 1];
        last.text += " " + line;
      }
    }
  }
  pushCurrent();
  return questions;
}

/* ---------- Storage ---------- */
function loadQuizzes() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error("Failed to read quizzes from storage", e);
    return [];
  }
}

function saveQuizzes(quizzes) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(quizzes));
}

function addQuiz(title, questions) {
  const quizzes = loadQuizzes();
  const quiz = {
    id: (crypto.randomUUID && crypto.randomUUID()) || String(Date.now()) + Math.random(),
    title: title || "Untitled Sheet",
    createdAt: new Date().toISOString(),
    questions
  };
  quizzes.unshift(quiz);
  saveQuizzes(quizzes);
  return quiz;
}

function deleteQuiz(id) {
  const quizzes = loadQuizzes().filter(q => q.id !== id);
  saveQuizzes(quizzes);
}

function renameQuiz(id, newTitle) {
  const quizzes = loadQuizzes();
  const quiz = quizzes.find(q => q.id === id);
  if (quiz) {
    quiz.title = newTitle;
    saveQuizzes(quizzes);
  }
}

function getQuiz(id) {
  return loadQuizzes().find(q => q.id === id);
}

async function seedIfEmpty() {
  const existing = loadQuizzes();
  if (existing.length > 0) return;
  try {
    const res = await fetch("seed-quiz.txt");
    if (!res.ok) return;
    const text = await res.text();
    const questions = parseQuizText(text);
    if (questions.length) {
      addQuiz("Construction Materials & Concrete Technology", questions);
    }
  } catch (e) {
    // Offline on first load with no cache yet — fine, user can add their own.
    console.warn("Could not load seed quiz", e);
  }
}

/* ---------- Router ---------- */
const app = document.getElementById("app");

function router() {
  const hash = location.hash || "#/home";

  if (hash.startsWith("#/quiz/")) return renderQuiz(hash.slice("#/quiz/".length));
  if (hash.startsWith("#/result/")) return renderResult(hash.slice("#/result/".length));
  if (hash === "#/add") return renderAdd();
  return renderHome();
}

window.addEventListener("hashchange", router);

document.getElementById("addQuizBtn").addEventListener("click", () => {
  location.hash = "#/add";
});

/* ---------- Home view ---------- */
function renderHome() {
  const tpl = document.getElementById("tpl-home");
  app.innerHTML = "";
  app.appendChild(tpl.content.cloneNode(true));

  const quizzes = loadQuizzes();
  document.getElementById("quizCount").textContent = String(quizzes.length).padStart(2, "0");

  const list = document.getElementById("quizList");
  const empty = document.getElementById("emptyState");

  if (quizzes.length === 0) {
    empty.hidden = false;
    empty.querySelector("[data-action='add']").addEventListener("click", () => location.hash = "#/add");
    return;
  }

  quizzes.forEach((quiz, i) => {
    const card = document.createElement("article");
    card.className = "quiz-card";
    const date = new Date(quiz.createdAt);
    const dateStr = isNaN(date) ? "" : date.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });

    card.innerHTML = `
      <div class="quiz-card-top">
        <div>
          <div class="quiz-card-title" data-title-for="${quiz.id}">${escapeHtml(quiz.title)}</div>
          <div class="quiz-card-meta">
            <span>Sheet ${String(i + 1).padStart(2, "0")}</span>
            <span>${quiz.questions.length} questions</span>
            ${dateStr ? `<span>Logged ${dateStr}</span>` : ""}
          </div>
        </div>
      </div>
      <div class="quiz-card-actions">
        <button class="btn btn-stamp" data-start="${quiz.id}">Start Inspection</button>
        <button class="btn-delete" data-rename="${quiz.id}">Rename</button>
        <button class="btn-delete" data-delete="${quiz.id}">Remove</button>
      </div>
    `;
    list.appendChild(card);
  });

  list.querySelectorAll("[data-start]").forEach(btn => {
    btn.addEventListener("click", () => {
      location.hash = `#/quiz/${btn.dataset.start}`;
    });
  });
  list.querySelectorAll("[data-rename]").forEach(btn => {
    btn.addEventListener("click", () => startRename(btn.dataset.rename));
  });
  list.querySelectorAll("[data-delete]").forEach(btn => {
    btn.addEventListener("click", () => {
      const quiz = getQuiz(btn.dataset.delete);
      if (quiz && confirm(`Remove "${quiz.title}" from the register? This can't be undone.`)) {
        deleteQuiz(btn.dataset.delete);
        renderHome();
      }
    });
  });
}

function startRename(id) {
  const titleEl = document.querySelector(`[data-title-for="${id}"]`);
  if (!titleEl) return;
  const quiz = getQuiz(id);
  if (!quiz) return;

  const input = document.createElement("input");
  input.type = "text";
  input.value = quiz.title;
  input.className = "rename-input";
  titleEl.replaceWith(input);
  input.focus();
  input.select();

  let committed = false;
  const commit = () => {
    if (committed) return;
    committed = true;
    const newTitle = input.value.trim() || quiz.title;
    renameQuiz(id, newTitle);
    renderHome();
  };
  const cancel = () => {
    if (committed) return;
    committed = true;
    renderHome();
  };

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") commit();
    if (e.key === "Escape") cancel();
  });
  input.addEventListener("blur", commit);
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

/* ---------- Add view ---------- */
function renderAdd() {
  const tpl = document.getElementById("tpl-add");
  app.innerHTML = "";
  app.appendChild(tpl.content.cloneNode(true));

  const titleInput = document.getElementById("titleInput");
  const fileInput = document.getElementById("fileInput");
  const fileDrop = document.getElementById("fileDrop");
  const fileHint = document.getElementById("fileHint");
  const preview = document.getElementById("parsePreview");
  const errorBox = document.getElementById("parseError");
  const saveBtn = document.getElementById("saveBtn");
  const form = document.getElementById("addForm");

  let parsedQuestions = null;
  let fileName = "";

  function handleFile(file) {
    if (!file) return;
    fileName = file.name;
    fileHint.textContent = `Selected: ${file.name}`;
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || "");
      const questions = parseQuizText(text);
      preview.hidden = true;
      errorBox.hidden = true;
      if (questions.length === 0) {
        parsedQuestions = null;
        errorBox.hidden = false;
        errorBox.textContent = "Couldn't find any questions in that file. Check it matches the format below (Q1., A)-D), a ✅ on the correct option, and an Explanation: line).";
        saveBtn.disabled = true;
        return;
      }
      parsedQuestions = questions;
      preview.hidden = false;
      preview.textContent = `Parsed ${questions.length} question${questions.length === 1 ? "" : "s"} successfully.`;
      if (!titleInput.value.trim()) {
        titleInput.value = fileName.replace(/\.txt$/i, "").replace(/[_-]+/g, " ").trim();
      }
      saveBtn.disabled = false;
    };
    reader.onerror = () => {
      errorBox.hidden = false;
      errorBox.textContent = "Couldn't read that file. Please try again.";
    };
    reader.readAsText(file);
  }

  fileInput.addEventListener("change", () => handleFile(fileInput.files[0]));

  ["dragover", "dragenter"].forEach(evt =>
    fileDrop.addEventListener(evt, e => { e.preventDefault(); fileDrop.classList.add("dragover"); })
  );
  ["dragleave", "drop"].forEach(evt =>
    fileDrop.addEventListener(evt, e => { e.preventDefault(); fileDrop.classList.remove("dragover"); })
  );
  fileDrop.addEventListener("drop", e => {
    const file = e.dataTransfer.files && e.dataTransfer.files[0];
    if (file) handleFile(file);
  });

  form.addEventListener("submit", e => {
    e.preventDefault();
    if (!parsedQuestions) return;
    const title = titleInput.value.trim() || fileName.replace(/\.txt$/i, "") || "Untitled Sheet";
    const quiz = addQuiz(title, parsedQuestions);
    location.hash = `#/quiz/${quiz.id}`;
  });
}

/* ---------- Quiz view ---------- */
let quizState = null; // { quiz, index, answers: [{selectedLabel, correct}|null, ...] }

function renderQuiz(id) {
  const quiz = getQuiz(id);
  if (!quiz) { location.hash = "#/home"; return; }

  if (!quizState || quizState.quiz.id !== id) {
    quizState = { quiz, index: 0, answers: new Array(quiz.questions.length).fill(null) };
  }

  const tpl = document.getElementById("tpl-quiz");
  app.innerHTML = "";
  app.appendChild(tpl.content.cloneNode(true));

  document.querySelector("[data-confirm-exit]").addEventListener("click", e => {
    const hasUnfinishedProgress = quizState.answers.some(a => a) && quizState.answers.some(a => !a);
    if (hasUnfinishedProgress) {
      if (!confirm("Exit this inspection? Your progress on this attempt won't be saved.")) {
        e.preventDefault();
      }
    }
  });

  renderQuestion();
}

function renderQuestion() {
  const { quiz, index, answers } = quizState;
  const q = quiz.questions[index];
  const existingAnswer = answers[index];

  document.getElementById("qIndex").textContent = "Q " + String(index + 1).padStart(2, "0");
  document.getElementById("qTotal").textContent = String(quiz.questions.length).padStart(2, "0");
  document.getElementById("progressFill").style.width = `${(index / quiz.questions.length) * 100}%`;
  document.getElementById("questionText").textContent = q.question;

  const optionsList = document.getElementById("optionsList");
  optionsList.innerHTML = "";
  const explainNote = document.getElementById("explainNote");
  explainNote.hidden = true;

  q.options.forEach(opt => {
    const btn = document.createElement("button");
    btn.className = "option";
    btn.type = "button";
    btn.innerHTML = `<span class="option-letter">${opt.label}</span><span class="option-text">${escapeHtml(opt.text)}</span>`;
    if (!existingAnswer) {
      btn.addEventListener("click", () => selectOption(opt, q));
    }
    optionsList.appendChild(btn);
  });

  const prevBtn = document.getElementById("prevBtn");
  prevBtn.hidden = index === 0;
  prevBtn.onclick = () => {
    quizState.index -= 1;
    renderQuestion();
  };

  const nextBtn = document.getElementById("nextBtn");
  if (existingAnswer) {
    showAnswerState(q, existingAnswer.selectedLabel);
  } else {
    nextBtn.hidden = true;
  }
}

function selectOption(selected, q) {
  if (quizState.answers[quizState.index]) return;
  quizState.answers[quizState.index] = { selectedLabel: selected.label, correct: !!selected.correct };
  showAnswerState(q, selected.label);
}

function showAnswerState(q, selectedLabel) {
  const buttons = document.querySelectorAll(".option");
  q.options.forEach((opt, i) => {
    const btn = buttons[i];
    btn.disabled = true;
    if (opt.correct) {
      btn.classList.add("correct");
    } else if (opt.label === selectedLabel) {
      btn.classList.add("incorrect");
    } else {
      btn.classList.add("faded");
    }
  });

  const explainNote = document.getElementById("explainNote");
  const explainText = document.getElementById("explainText");
  if (q.explanation) {
    explainText.textContent = q.explanation;
    explainNote.hidden = false;
  }

  const nextBtn = document.getElementById("nextBtn");
  nextBtn.hidden = false;
  nextBtn.textContent = quizState.index + 1 >= quizState.quiz.questions.length
    ? "See Results \u2192"
    : "Next Question \u2192";
  nextBtn.onclick = () => {
    if (quizState.index + 1 >= quizState.quiz.questions.length) {
      location.hash = `#/result/${quizState.quiz.id}`;
    } else {
      quizState.index += 1;
      renderQuestion();
    }
  };
}

/* ---------- Result view ---------- */
function renderResult(id) {
  const quiz = getQuiz(id);
  if (!quiz || !quizState || quizState.quiz.id !== id) { location.hash = "#/home"; return; }

  const tpl = document.getElementById("tpl-result");
  app.innerHTML = "";
  app.appendChild(tpl.content.cloneNode(true));

  const total = quiz.questions.length;
  const score = quizState.answers.filter(a => a && a.correct).length;
  const pct = total ? Math.round((score / total) * 100) : 0;
  const pass = pct >= 60;

  document.getElementById("resultStamp").textContent = pass ? "PASS" : "REVIEW";
  document.getElementById("resultStamp").className = "result-stamp " + (pass ? "pass" : "fail");
  document.getElementById("resultTitle").textContent = pass ? "Inspection Complete" : "Re-inspection Recommended";
  document.getElementById("resultScore").textContent = `${score}/${total}`;
  document.getElementById("resultPct").textContent = `${pct}% correct`;

  document.getElementById("retakeBtn").addEventListener("click", () => {
    quizState = { quiz, index: 0, answers: new Array(quiz.questions.length).fill(null) };
    location.hash = `#/quiz/${quiz.id}`;
  });
}

/* ---------- Boot ---------- */
(async function init() {
  await seedIfEmpty();
  router();
})();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}
