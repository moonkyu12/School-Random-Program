'use strict';

const CONFIG = { // AI야 고~~~맙다 정리를 이렇게~나 잘해해줭~
  DEFAULT_ROWS: 6,
  DEFAULT_COLS: 5,
  DEFAULT_COUNTDOWN_SECONDS: 3,
  MIN_COUNTDOWN_SECONDS: 0,
  MAX_COUNTDOWN_SECONDS: 10,
  MIN_LAYOUT: 2,
  MAX_LAYOUT: 10,
  MAX_UNDO_STACK: 40,
};
// 음.......안해ㅣ
const MESSAGES = {
  BLOCKED_SEAT: "사용 불가 자리에는 이름을 추가할 수 없어요.",
  DUPLICATE_NAME: "이미 이름이 있습니다. X 버튼으로 삭제 후 다시 추가해주세요.",
  INPUT_NAME_PROMPT: "번 자리의 이름을 입력하세요:",
  EMPTY_INPUT: "이름을 입력해주세요.",
  NO_NAMES: "배치할 이름이 없어요. 자리에 이름을 추가해주세요.",
  RANDOM_SUCCESS: "명을 완전히 랜덤하게 배치했어요.",
  UNDO_NO_HISTORY: "되돌릴 내용이 없어요.",
  REDO_NO_HISTORY: "앞으로 갈 내용이 없어요.",
  FILE_READ_ERROR: "파일을 읽을 수 없습니다.",
  INVALID_STATE_FILE: "유효하지 않은 파일 형식입니다.",
  IMAGE_GENERATION_ERROR: "이미지 저장에 실패했습니다.",
  SAVE_SUCCESS: "자리배치를 저장했어요!",
  LOAD_SUCCESS: "자리배치를 불러왔어요!",
};
// 내가 이걸 왜한거지? 왜 정리를 한걸까 ㅈ머ㅐㅠ매ㅕ누ㅑㅔㅁ휴매ㅠ냐ㅐ ㅁ잘 ㅠㅕㅁ9ㅑㅐㅓ 헤ㅐㅑ뉴[ㅕㅑㅐㅔㅁ]
const DOM = {
  rowsInput: document.getElementById("rowsInput"),
  colsInput: document.getElementById("colsInput"),
  drawBtn: document.getElementById("drawBtn"),
  loadTxtBtn: document.getElementById("loadTxtBtn"),
  undoBtn: document.getElementById("undoBtn"),
  redoBtn: document.getElementById("redoBtn"),
  clearAllBtn: document.getElementById("clearAllBtn"),
  saveImageBtn: document.getElementById("saveImageBtn"),
  txtFileInput: document.getElementById("txtFileInput"),
  stateFileInput: document.getElementById("stateFileInput"),
  statusBox: document.getElementById("statusBox"),
  seatBoard: document.getElementById("seatBoard"),
  seatTemplate: document.getElementById("seatTemplate"),
  confirmModal: document.getElementById("confirmModal"),
  confirmMessage: document.getElementById("confirmMessage"),
  confirmOkBtn: document.getElementById("confirmOkBtn"),
  confirmCancelBtn: document.getElementById("confirmCancelBtn"),
  inputModal: document.getElementById("inputModal"),
  inputTitle: document.getElementById("inputTitle"),
  inputField: document.getElementById("inputField"),
  inputOkBtn: document.getElementById("inputOkBtn"),
  inputCancelBtn: document.getElementById("inputCancelBtn"),
  saveStateBtn: document.getElementById("saveStateBtn"),
  loadStateBtn: document.getElementById("loadStateBtn"),
  countdownInput: document.getElementById("countdownInput"),
  countdownOverlay: document.getElementById("countdownOverlay"),
  countdownNumber: document.getElementById("countdownNumber"),
};

let state = {
  rows: CONFIG.DEFAULT_ROWS,
  cols: CONFIG.DEFAULT_COLS,
  seats: [],
  undoStack: [],
  redoStack: [],
};

let isCountingDown = false;

function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}

function secureRandomInt(max) {
  if (!Number.isInteger(max) || max <= 1) return 0;
  const cryptoObj = globalThis.crypto;
  if (cryptoObj?.getRandomValues) {
    const uint32Max = 0x100000000;
    const limit = uint32Max - (uint32Max % max);
    const buf = new Uint32Array(1);
    do {
      cryptoObj.getRandomValues(buf);
    } while (buf[0] >= limit);
    return buf[0] % max;
  }
  return Math.floor(Math.random() * max);
}

function shuffle(arr) {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = secureRandomInt(i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function normalizeSeats(rows, cols, existing = []) {
  const seats = [];
  for (let i = 0; i < rows * cols; i++) {
    const src = existing[i];
    seats.push({
      name: src?.name || "",
      fixed: Boolean(src?.fixed),
      blocked: Boolean(src?.blocked),
    });
  }
  return seats;
}

function cloneSnapshot(reason = "") {
  return {
    rows: state.rows,
    cols: state.cols,
    seats: state.seats.map(s => ({ ...s })),
    reason,
    timestamp: new Date().toISOString(),
  };
}

function pushUndo(reason) {
  state.undoStack.push(cloneSnapshot(reason));
  state.redoStack = [];
  if (state.undoStack.length > CONFIG.MAX_UNDO_STACK) {
    state.undoStack.shift();
  }
}

function applySnapshot(snap) {
  state.rows = snap.rows;
  state.cols = snap.cols;
  state.seats = snap.seats.map(s => ({ ...s }));
  refreshUI();
}
// 내가 누구냐고 나는 스파이더맨이다!
function setStatus(text, kind = "idle") {
  DOM.statusBox.textContent = text;
  DOM.statusBox.classList.remove("is-success", "is-warn", "is-error");
  if (kind !== "idle") {
    DOM.statusBox.classList.add(`is-${kind}`);
  }
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getMovableNames() {
  return state.seats.filter(s => s.name && !s.fixed).map(s => s.name);
}

function getAvailableSeatIndices() {
  return state.seats
    .map((s, i) => (!s.fixed && !s.blocked ? i : -1))
    .filter(i => i !== -1);
}

function getCountdownSeconds() {
  const inputValue = parseInt(DOM.countdownInput?.value || "", 10);
  const normalized = Number.isFinite(inputValue) ? inputValue : CONFIG.DEFAULT_COUNTDOWN_SECONDS;
  const clamped = clamp(normalized, CONFIG.MIN_COUNTDOWN_SECONDS, CONFIG.MAX_COUNTDOWN_SECONDS);
  DOM.countdownInput.value = clamped;
  return clamped;
}

function renderShufflePreview() {
  const names = getMovableNames();
  if (!names.length) return;

  const shuffledNames = shuffle(names);
  const shuffledIndices = shuffle(getAvailableSeatIndices());
  const displayMap = new Map();
  const count = Math.min(shuffledNames.length, shuffledIndices.length);

  for (let i = 0; i < count; i++) {
    displayMap.set(shuffledIndices[i], shuffledNames[i]);
  }

  const cards = DOM.seatBoard.querySelectorAll(".seat-card");
  cards.forEach((card, idx) => {
    const seat = state.seats[idx];
    if (!seat || seat.fixed || seat.blocked) return;
    const name = card.querySelector(".seat-name");
    if (!name) return;
    name.textContent = displayMap.get(idx) || "빈자리";
  });
}

function setCountdownOverlayNumber(value) {
  DOM.countdownNumber.textContent = String(value);
  DOM.countdownNumber.classList.remove("pop");
  void DOM.countdownNumber.offsetWidth;
  DOM.countdownNumber.classList.add("pop");
}

async function runCountdown(seconds) {
  if (seconds <= 0) return;

  DOM.countdownOverlay.hidden = false;
  for (let sec = seconds; sec >= 1; sec--) {
    setCountdownOverlayNumber(sec);
    setStatus(`${sec}...`, "idle");
    await wait(1000);
  }
  DOM.countdownOverlay.hidden = true;
}

function openInputDialog(title, defaultValue = "") {
  return new Promise((resolve) => {
    DOM.inputTitle.textContent = title;
    DOM.inputField.value = defaultValue;
    DOM.inputModal.hidden = false;
    DOM.inputField.focus();
    DOM.inputField.select();

    const cleanup = () => {
      DOM.inputModal.hidden = true;
      DOM.inputOkBtn.removeEventListener("click", onOk);
      DOM.inputCancelBtn.removeEventListener("click", onCancel);
      document.removeEventListener("keydown", onKey);
    };

    const onOk = () => {
      cleanup();
      resolve(DOM.inputField.value);
    };

    const onCancel = () => {
      cleanup();
      resolve(null);
    };

    const onKey = (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        cleanup();
        resolve(DOM.inputField.value);
      } else if (e.key === "Escape") {
        e.preventDefault();
        cleanup();
        resolve(null);
      }
    };

    DOM.inputOkBtn.addEventListener("click", onOk);
    DOM.inputCancelBtn.addEventListener("click", onCancel);
    document.addEventListener("keydown", onKey);
  });
}

async function renameSeat(idx) {
  const seat = state.seats[idx];
  if (!seat) return;
  if (seat.blocked) {
    setStatus(MESSAGES.BLOCKED_SEAT, "warn");
    return;
  }
  if (seat.name) {
    setStatus(MESSAGES.DUPLICATE_NAME, "warn");
    return;
  }

  const name = await openInputDialog(`${idx + 1}${MESSAGES.INPUT_NAME_PROMPT}`);
  if (name === null) return;

  const trimmed = name.trim();
  if (!trimmed) {
    setStatus(MESSAGES.EMPTY_INPUT, "warn");
    return;
  }

  pushUndo("이름 추가");
  seat.name = trimmed;
  refreshUI();
  setStatus(`${idx + 1}번 자리에 ${trimmed}을(를) 추가했어요.`, "success");
}

function toggleFixed(idx) {
  const seat = state.seats[idx];
  if (!seat || seat.blocked) {
    setStatus("고정할 수 없는 자리입니다.", "warn");
    return;
  }
  if (!seat.name) {
    setStatus("먼저 이름을 추가한 후 고정해주세요.", "warn");
    return;
  }

  pushUndo("고정 변경");
  seat.fixed = !seat.fixed;
  refreshUI();
  setStatus(
    seat.fixed ? `${idx + 1}번 자리를 고정했어요.` : `${idx + 1}번 자리 고정을 해제했어요.`,
    "success"
  );
}

function toggleBlocked(idx) {
  const seat = state.seats[idx];
  if (!seat) return;

  pushUndo("사용 불가 변경");
  if (!seat.blocked) {
    seat.blocked = true;
    seat.fixed = false;
    seat.name = "";
    setStatus(`${idx + 1}번 자리를 사용 불가로 설정했어요.`, "success");
  } else {
    seat.blocked = false;
    setStatus(`${idx + 1}번 자리 사용 불가를 해제했어요.`, "success");
  }
  refreshUI();
}

function clearSeat(idx) {
  const seat = state.seats[idx];
  if (!seat || (!seat.name && !seat.fixed)) return;
  pushUndo("자리 비우기");
  seat.name = "";
  seat.fixed = false;
  refreshUI();
  setStatus(`${idx + 1}번 자리를 비웠어요.`, "success");
}

function handleLayoutChange() {
  const r = clamp(parseInt(DOM.rowsInput.value) || CONFIG.DEFAULT_ROWS, CONFIG.MIN_LAYOUT, CONFIG.MAX_LAYOUT);
  const c = clamp(parseInt(DOM.colsInput.value) || CONFIG.DEFAULT_COLS, CONFIG.MIN_LAYOUT, CONFIG.MAX_LAYOUT);

  if (r === state.rows && c === state.cols) return;

  pushUndo("자리 수 변경");
  state.rows = r;
  state.cols = c;
  state.seats = normalizeSeats(r, c, state.seats);
  DOM.rowsInput.value = r;
  DOM.colsInput.value = c;
  refreshUI();
  setStatus(`자리 수를 ${r * c}석으로 변경했어요.`, "success");
}

function randomizeSeats() {
  const names = getMovableNames();
  if (!names.length) {
    setStatus(MESSAGES.NO_NAMES, "warn");
    return;
  }

  pushUndo("랜덤 배치");
  const shuffledNames = shuffle(names);
  const shuffledIndices = shuffle(getAvailableSeatIndices());

  state.seats.forEach(s => {
    if (!s.fixed && !s.blocked) s.name = "";
  });

  const cnt = Math.min(shuffledIndices.length, shuffledNames.length);
  for (let i = 0; i < cnt; i++) {
    state.seats[shuffledIndices[i]].name = shuffledNames[i];
  }

  refreshUI();
  setStatus(`${shuffledNames.length}${MESSAGES.RANDOM_SUCCESS}`, "success");
}

async function handleDrawWithCountdown() {
  if (isCountingDown) return;

  const names = getMovableNames();
  if (!names.length) {
    setStatus(MESSAGES.NO_NAMES, "warn");
    return;
  }

  const seconds = getCountdownSeconds();
  if (seconds <= 0) {
    randomizeSeats();
    return;
  }

  isCountingDown = true;
  DOM.drawBtn.disabled = true;
  DOM.countdownInput.disabled = true;

  const previewTimer = setInterval(renderShufflePreview, 150);
  try {
    renderShufflePreview();
    await runCountdown(seconds);
    randomizeSeats();
  } finally {
    clearInterval(previewTimer);
    DOM.countdownOverlay.hidden = true;
    DOM.drawBtn.disabled = false;
    DOM.countdownInput.disabled = false;
    isCountingDown = false;
    refreshUI();
  }
}

function clearAll() {
  pushUndo("전체 지우기");
  state.seats = normalizeSeats(state.rows, state.cols);
  refreshUI();
  setStatus("모든 자리 정보를 지웠어요.", "success");
}

function undoLast() {
  const snap = state.undoStack.pop();
  if (!snap) {
    setStatus(MESSAGES.UNDO_NO_HISTORY, "warn");
    return;
  }
  state.redoStack.push(cloneSnapshot());
  applySnapshot(snap);
  setStatus("뒤로가기 완료!", "success");
}

function redoLast() {
  const snap = state.redoStack.pop();
  if (!snap) {
    setStatus(MESSAGES.REDO_NO_HISTORY, "warn");
    return;
  }
  state.undoStack.push(cloneSnapshot());
  applySnapshot(snap);
  setStatus("앞으로가기 완료!", "success");
}

function renderBoard() {
  DOM.seatBoard.innerHTML = "";
  DOM.seatBoard.style.setProperty("--cols", state.cols);

  if (!state.seats.length) {
    const empty = document.createElement("div");
    empty.className = "empty-board";
    empty.textContent = "자리 정보가 없습니다.";
    DOM.seatBoard.append(empty);
    return;
  }

  const frag = document.createDocumentFragment(); // 크~ 이딴걸 내가 왜 했지
  state.seats.forEach((seat, idx) => {
    const card = DOM.seatTemplate.content.firstElementChild.cloneNode(true);
    const main = card.querySelector(".seat-main");
    const num = card.querySelector(".seat-number");
    const name = card.querySelector(".seat-name");// 진짜~ 이름 금나 구리넹
    const fixBtn = card.querySelector(".fixed-btn");
    const blockBtn = card.querySelector(".blocked-btn");
    const clearBtn = card.querySelector(".clear-btn");

    num.textContent = `${idx + 1}번 자리`;
    name.textContent = seat.blocked ? "사용불가" : (seat.name || "빈자리");

    card.classList.toggle("is-fixed", seat.fixed && !seat.blocked);
    card.classList.toggle("is-blocked", seat.blocked);
    card.classList.toggle("is-empty", !seat.name && !seat.blocked);

    fixBtn.classList.toggle("active", seat.fixed && !seat.blocked);
    blockBtn.classList.toggle("active", seat.blocked);
    fixBtn.disabled = seat.blocked || !seat.name;
    clearBtn.disabled = !seat.name && !seat.fixed;

    main.addEventListener("click", () => renameSeat(idx));
    fixBtn.addEventListener("click", () => toggleFixed(idx));
    blockBtn.addEventListener("click", () => toggleBlocked(idx));
    clearBtn.addEventListener("click", () => clearSeat(idx)); // ida ida diadadaidaidaidcaidaidadiadaidai

    frag.append(card);
  });

  DOM.seatBoard.append(frag);
}

function refreshUI() {
  renderBoard();
}

function saveImage() { // function FUCKYOU
  const board = document.querySelector(".board-card");
  if (!board) {
    setStatus("자리표를 찾을 수 없습니다.", "error");
    return;
  }
  if (typeof html2canvas === "undefined") {
    setStatus("이미지 저장 기능을 불러올 수 없습니다.", "error");
    return;
  }

  setStatus("이미지를 생성 중입니다...", "idle");
  html2canvas(board, { backgroundColor: "#ffffff", scale: 2, logging: false })
    .then(canvas => {
      const link = document.createElement("a");
      const ts = new Date().toISOString().split("T")[0];
      link.href = canvas.toDataURL("image/png");
      link.download = `자리표_${ts}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setStatus("자리표를 저장했어요!", "success");
    })
    .catch(err => {
      console.error("Image error:", err);
      setStatus(MESSAGES.IMAGE_GENERATION_ERROR, "error");
    });
}

function handleTxtUpload(e) {
  const file = e.target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = ev => {
    const text = ev.target?.result;
    if (typeof text !== "string") return;

    const names = text.split(/[\r\n,]+/).map(l => l.trim()).filter(l => l);
    if (!names.length) {
      setStatus("파일에 이름이 없습니다.", "warn");
      return;
    }

    pushUndo("파일 불러오기");
    
    // 고정/금지되지 않은 자리의 이름만 초기화
    state.seats.forEach(s => {
      if (!s.blocked && !s.fixed) {
        s.name = "";
      }
    });
    
    // 비어있는 자리(고정/금지 아닌) 찾기
    const availableIndices = state.seats
      .map((s, i) => (!s.blocked && !s.fixed ? i : -1))
      .filter(i => i !== -1);
    
    const addedCount = Math.min(names.length, availableIndices.length);
    for (let i = 0; i < addedCount; i++) {
      state.seats[availableIndices[i]].name = names[i];
    }
    
    const notAdded = names.length - addedCount;
    if (notAdded > 0) {
      setStatus(`${addedCount}명을 추가했어요. ${notAdded}명은 자리 부족으로 못 들어갔습니다.`, "warn");
    } else {
      setStatus(`${addedCount}명을 추가했어요.`, "success");
    }
    
    refreshUI();
  };

  reader.onerror = () => setStatus(MESSAGES.FILE_READ_ERROR, "error");
  reader.readAsText(file);
  DOM.txtFileInput.value = "";
}

function saveState() {
  const data = {
    rows: state.rows,
    cols: state.cols,
    seats: state.seats,
    timestamp: new Date().toISOString(),
    version: "1.0",
  };

  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  try {
    link.href = url;
    const ts = new Date().toISOString().split("T")[0];
    link.download = `자리배치_${ts}.json`;
    document.body.appendChild(link);
    link.click();
  } finally {
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  setStatus(MESSAGES.SAVE_SUCCESS, "success");
}
// 응안해 안해 안해 안해
function handleStateLoad(e) {
  const file = e.target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = ev => {
    try {
      const text = ev.target?.result;
      if (typeof text !== "string") return;

      const data = JSON.parse(text);
      if (!data.rows || !data.cols || !Array.isArray(data.seats)) {
        setStatus(MESSAGES.INVALID_STATE_FILE, "error");
        return;
      }
      // 아 뻐스 퉥시 오랜지 빠이~
      pushUndo("상태 불러오기");
      state.rows = data.rows;
      state.cols = data.cols;
      state.seats = data.seats.map(s => ({
        name: s.name || "",
        fixed: Boolean(s.fixed),
        blocked: Boolean(s.blocked),
      }));

      DOM.rowsInput.value = state.rows;
      DOM.colsInput.value = state.cols;
      refreshUI();
      setStatus(MESSAGES.LOAD_SUCCESS, "success");
    } catch (err) {
      console.error("State load:", err);
      setStatus(MESSAGES.FILE_READ_ERROR, "error");
    }
  };

  reader.onerror = () => setStatus(MESSAGES.FILE_READ_ERROR, "error");
  reader.readAsText(file);
  DOM.stateFileInput.value = "";
}

function attachEvents() {
  DOM.drawBtn.addEventListener("click", handleDrawWithCountdown);
  DOM.undoBtn.addEventListener("click", undoLast);
  DOM.redoBtn.addEventListener("click", redoLast);
  DOM.clearAllBtn.addEventListener("click", clearAll);
  DOM.saveImageBtn.addEventListener("click", saveImage);

  DOM.loadTxtBtn.addEventListener("click", () => DOM.txtFileInput.click());
  DOM.txtFileInput.addEventListener("change", handleTxtUpload);

  DOM.saveStateBtn.addEventListener("click", saveState);
  DOM.loadStateBtn.addEventListener("click", () => DOM.stateFileInput.click());
  DOM.stateFileInput.addEventListener("change", handleStateLoad);

  DOM.rowsInput.addEventListener("change", handleLayoutChange);
  DOM.colsInput.addEventListener("change", handleLayoutChange);

  document.addEventListener("keydown", e => {
    if (isCountingDown) return;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
      e.preventDefault();
      undoLast();
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
      e.preventDefault();
      redoLast();
    }
  });
}

function init() {
  state.rows = CONFIG.DEFAULT_ROWS;
  state.cols = CONFIG.DEFAULT_COLS;
  state.seats = normalizeSeats(CONFIG.DEFAULT_ROWS, CONFIG.DEFAULT_COLS);
  DOM.rowsInput.value = CONFIG.DEFAULT_ROWS;
  DOM.colsInput.value = CONFIG.DEFAULT_COLS;
  DOM.countdownInput.value = CONFIG.DEFAULT_COUNTDOWN_SECONDS;
  refreshUI();
  setStatus("준비 완료", "idle");
  attachEvents();
}
// 에헤헤헤헤헤헤헤헤 ㅔ헿ㅇ해매너에ㅑ무쟈ㅗㅑ네뮤야ㅐㅠ매ㅕ녀애ㅠ
init();
