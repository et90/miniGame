// ======================== мои переменные и константы====================================




//#region мои переменные и константы
import { renderLevel, initCanvas, enableCanvasLineDrawing } from './playLevel.js';
import { cellColor25, cellColors30, getPseudoRandomNumber } from './differentData.js';
import { saveGameProgress, loadGameProgress } from './playSaveLoad.js';
import { confettiSalute } from './confettiSalute.js';

const ua = navigator.userAgent || "";
const isMobile = /Android|iPhone|iPad|iPod|Mobile|Windows Phone|Opera Mini|IEMobile/i.test(ua);


//Объявляем переменные 

/**
 * текущий статус игры
 * 0 - стартовое меню, 1 - игра, 2 - пауза, 3 - конец игры
 */
let gameStatus = 0;


/**
 * общее название всех уровней
 */
let nameGame = '# Test_Game #';

// загружаем файл с уровнями
//const fileNameGameArray = 'levelsFull.json';
const fileNameGameArray = './sherlookWords.json';
/**
 * массив с играми
 */
let levels = [];
fetch(fileNameGameArray)
  .then(response => response.json())
  .then(data => {
    levels = data;
    //redrawGame();
    renderQuestions(levels, 15, openShapes, cellColor25);
    renderLevels(levelsName(levels));
  });

/**
 * текущий уровень на экране
 */
let currentLevelIndex = 0;

/**
 * размер ячейки для отображения внутри нее блока с буквой
 */
let cellSize = calculateCellSize(); // Размер ячейки в пикселях

/**
 * объект для рисования канваса для зачеркивания букв
 */
let drawer = null; // Переменная для хранения объекта drawer

/**
 * масссив с открытыми шеипами - угаданными словами в текущем уровне
 */
let openShapes = [];
//#endregion

//! заменить getElementById('screen-start') на элемент из игрового экрана
function calculateCellSize() {
  //const gameContainer = document.getElementById('gameContainer');
  const gameContainer = document.getElementById('screen-start');
  let width = gameContainer.offsetWidth;
  let newCellSize = Math.floor(width / 9); // 9 - количество ячеек по ширине
  return newCellSize;
}

function redrawGame() {

  if (drawer !== null && drawer !== undefined) { drawer.destroy(); } // Отключаем старый drawer, если он существует

  const level = levels.find(obj => obj["id"] === currentLevelIndex);
  let fieldWidth = level.width;
  let fieldHeight = level.height;

  const fieldGame = document.getElementById('crossword');
  fieldGame.innerHTML = ''; // Очищаем содержимое контейнера перед рендерингом нового уровня
  fieldGame.style.width = `${fieldWidth * cellSize}px`;
  fieldGame.style.height = `${fieldHeight * cellSize}px`;

  renderLevel(levels, currentLevelIndex, cellSize, 'letter-block', fieldGame, openShapes, cellColor25);
  const canvas = initCanvas(fieldGame, cellSize, fieldWidth, fieldHeight);
  drawer = enableCanvasLineDrawing({
    fieldElement: fieldGame,
    canvas,
    cellSize,
    levelWidth: fieldWidth,
    levelHeight: fieldHeight,
    isMobile,
    lineColor: "#000000",
    onCellSelected: (cell) => {
      // здесь можно подсвечивать выбранные клетки
      // cell = { row, col }
    },
    onDrawEnd: (path) => {
      // path — массив выбранных клеток
      console.log('Drawn path:', path);
      checkPath(path, levels, currentLevelIndex);
      drawer.clear();
    }
  });

  //const qwizContent = document.getElementById('qwizContent');
  // showDescriptions(levels, currentLevelIndex, qwizContent, 'scrollItemDescription', openShapes, cellColor25);
  renderQuestions(levels, currentLevelIndex, openShapes, cellColor25)
}

function checkPath(path, levelsArray, currentLevelIndex) {
  const level = levelsArray.find(obj => obj["id"] === currentLevelIndex);
  const shapesId = level.grid[path[0].row][path[0].col];
  console.log('shapesId:', shapesId);
  const shape = level.shapes.find(s => s.id === shapesId);
  if (!shape) {
    console.log('Shape not found for the selected path.');
    return;
  }
  const shapeLength = shape.length;
  const cells = shape.cells; // массив клеток, которые нужно выделить
  if (path.length === shapeLength) {
    console.log('длина совпадают, перебираем весь путь');
    for (let i = 0; i < shapeLength; i++) {
      if (cells[i].x !== path[i].col || cells[i].y !== path[i].row) {
        console.log('клетки не совпадают, путь неверный');
        return;
      }
    }
    console.log('путь верный');
    if (!openShapes.includes(shapesId)) {
      openShapes.push(shapesId);
      saveGameProgress(nameGame, currentLevelIndex, openShapes);
      if (openShapes.length === shapeLength) {
        // ВСЕ слова отгаданы
        console.log('ВСЕ слова отгаданы');
        const container = document.getElementById('screen-game');
        confettiSalute(container, cellColor25, 3000, 500, () => {
          console.log('Салют завершён');
          openShapes = [];
          saveGameProgress(nameGame, currentLevelIndex, openShapes);
          showScreen('screen-menu')
        });
      }
    }
    //repaintingBlocks(cellColor25, levelsArray, currentLevelIndex, shapesId);
    redrawGame();
  }
}

/**
 * Из какждого игрового уровня берется псевдослучайное слово, и добавляется в
 * список(массив) 
 * @param {Array[Object]} _levels 
 * @returns {Array[String]}
 */
function levelsName(_levels) {
  const list = [];
  _levels.forEach((level, index) => {
    const words = level.words;
    const psNumb = getPseudoRandomNumber(cellColor25, index, words.length);
    const levelName = words[psNumb].word;
    console.log(`уровень: ${index}, слово: ${levelName} (${psNumb}) `)
    list.push(levelName);
  });
  return list;
}



/* ============================================================
   Кроссворды и расследования — логика интерфейса
   ============================================================ */

/* ---------- Данные кроссворда (слова и вопросы) ---------- */
// Каждое слово: направление, координаты первой буквы, слово и подсказка
const SIZE = 7; // размер игрового поля 7x7

const WORDS = [
  { dir: "down", row: 0, col: 3, word: "УЛИКА", clue: "Вещественное доказательство" },
  { dir: "down", row: 0, col: 5, word: "ДОКАЗ", clue: "Факт, подтверждающий вину" },
  { dir: "across", row: 2, col: 0, word: "ЗАГАДКА", clue: "То, что предстоит разгадать" },
  { dir: "down", row: 2, col: 6, word: "АЛИБИ", clue: "Доказательство невиновности" },
  { dir: "across", row: 4, col: 0, word: "СЫЩИК", clue: "Частный детектив" },
];

// Названия уровней для экрана «Меню»
const LEVELS = [
  "Первые улики",
  "Ночное происшествие",
  "Таинственный особняк",
  "Пропавший свидетель",
  "Код старого сейфа",
  "След на снегу",
  "Дело о тихом соседе",
  "Шифр из архива",
  "Исчезнувший поезд",
  "Послание без подписи",
  "Ложное алиби",
  "Тайна заброшенной фабрики",
  "Письмо из прошлого",
  "Финал расследования",
];

const STORAGE_KEY = "crossword-progress"; // ключ сохранения в localStorage

/* ---------- Построение сетки кроссворда ---------- */
// grid[r][c] = буква или "#" (закрытая клетка)
// numbers[r][c] = номер вопроса (если клетка — начало слова)
function buildGrid() {
  const grid = Array.from({ length: SIZE }, () => Array(SIZE).fill("#"));
  const numbers = Array.from({ length: SIZE }, () => Array(SIZE).fill(null));

  // Расставляем буквы слов
  WORDS.forEach((w) => {
    for (let i = 0; i < w.word.length; i++) {
      const r = w.dir === "down" ? w.row + i : w.row;
      const c = w.dir === "down" ? w.col : w.col + i;
      grid[r][c] = w.word[i];
    }
  });

  // Нумеруем начала слов (классический порядок: сверху вниз, слева направо)
  let num = 1;
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (grid[r][c] === "#") continue;
      const isAcross = (c === 0 || grid[r][c - 1] === "#") && c + 1 < SIZE && grid[r][c + 1] !== "#";
      const isDown = (r === 0 || grid[r - 1][c] === "#") && r + 1 < SIZE && grid[r + 1][c] !== "#";
      if (isAcross || isDown) numbers[r][c] = num++;
    }
  }

  return { grid, numbers };
}

const { grid, numbers } = buildGrid();

/* ---------- Рендер игрового поля ---------- */
const crosswordEl = document.getElementById("crossword");

function renderCrossword() {
  crosswordEl.innerHTML = "";

  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const cell = document.createElement("div");
      cell.className = "cell";

      if (grid[r][c] === "#") {
        cell.classList.add("cell--block");
      } else {
        // Номер вопроса в углу клетки
        if (numbers[r][c]) {
          const numEl = document.createElement("span");
          numEl.className = "cell__num";
          numEl.textContent = numbers[r][c];
          cell.appendChild(numEl);
        }

        // Поле для ввода буквы
        const input = document.createElement("input");
        input.className = "cell__input";
        input.maxLength = 1;
        input.dataset.row = r;
        input.dataset.col = c;
        input.setAttribute("aria-label", `Клетка ${r + 1}-${c + 1}`);
        input.addEventListener("focus", () => showClue(r, c));
        input.addEventListener("input", () => {
          input.value = input.value.replace(/[^а-яёА-ЯЁ]/g, "").toUpperCase();
          if (input.value) moveNext(input);
          saveProgress();
        });
        cell.appendChild(input);
      }

      crosswordEl.appendChild(cell);
    }
  }
}

/* ---------- Подсказка под полем ---------- */
const clueEl = document.getElementById("clue-text");

// Находит слово, содержащее клетку (приоритет — горизонтальное)
function findWordAt(r, c) {
  return (
    WORDS.find((w) => w.dir === "across" && w.row === r && c >= w.col && c < w.col + w.word.length) ||
    WORDS.find((w) => w.dir === "down" && w.col === c && r >= w.row && r < w.row + w.word.length)
  );
}

function showClue(r, c) {
  const w = findWordAt(r, c);
  if (!w) return;
  const n = numbers[w.row][w.col];
  const dir = w.dir === "across" ? "горизонтали" : "вертикали";
  clueEl.textContent = `${n}. По ${dir}: ${w.clue}`;
}

/* ---------- Переход к следующей клетке слова ---------- */
function moveNext(input) {
  const r = +input.dataset.row;
  const c = +input.dataset.col;
  const w = findWordAt(r, c);
  if (!w) return;

  const next = { row: r, col: c };
  if (w.dir === "across") next.col += 1;
  else next.row += 1;

  const nextInput = crosswordEl.querySelector(
    `.cell__input[data-row="${next.row}"][data-col="${next.col}"]`
  );
  if (nextInput) nextInput.focus();
}

/* ---------- Сохранение / загрузка прогресса ---------- */
function saveProgress() {
  const letters = {};
  crosswordEl.querySelectorAll(".cell__input").forEach((inp) => {
    if (inp.value) letters[`${inp.dataset.row},${inp.dataset.col}`] = inp.value;
  });
  localStorage.setItem(STORAGE_KEY, JSON.stringify(letters));
}

function loadProgress() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return;
  try {
    const letters = JSON.parse(saved);
    crosswordEl.querySelectorAll(".cell__input").forEach((inp) => {
      const key = `${inp.dataset.row},${inp.dataset.col}`;
      if (letters[key]) inp.value = letters[key];
    });
  } catch (e) {
    // Повреждённые данные игнорируем
  }
}

function clearProgress() {
  localStorage.removeItem(STORAGE_KEY);
  crosswordEl.querySelectorAll(".cell__input").forEach((inp) => (inp.value = ""));
}

/* ---------- Навигация между экранами ---------- */
function showScreen(id) {
  document.querySelectorAll(".screen").forEach((s) => s.classList.remove("active"));
  document.getElementById(id).classList.add("active");
}

// Обрабатываем все кнопки с data-nav
document.querySelectorAll("[data-nav]").forEach((btn) => {
  btn.addEventListener("click", () => showScreen(btn.dataset.nav));
});

/* ---------- Экраны 3 и 4: генерация контента ---------- */
const questionsList = document.getElementById("questions-list");
const levelsList = document.getElementById("levels-list");

// Список вопросов, сгруппированный по направлению
function renderQuestions(levels, levelsId, openShapesArray, colorArray) {
  questionsList.innerHTML = "";

  const level = levels.find(lvl => lvl.id === levelsId);
  if (!level) {
    console.warn(`Уровень с id ${levelsId} не найден.`);
    return;
  }

  level.words.forEach((word, index) => {
    const item = document.createElement("div");
    item.className = "question-item";

    const text = document.createElement("span");
    text.className = "question-item__text";
    text.textContent = `${word.description || 'Описание отсутствует'}`;
    item.appendChild(text);

    if (openShapesArray.includes(index + 1)) { // Проверяем, есть ли индекс слова в массиве openShapes
      const borderColor = colorArray[(index + 1) % colorArray.length];
      item.style.borderLeft = `4px solid ${borderColor}`; // Используем index+1, так как индексация в openShapes начинается с 1
      item.style.borderRight = `4px solid ${borderColor}`; // Используем index+1, так как индексация в openShapes начинается с 1
    }


    questionsList.appendChild(item);
  });
}

// Список уровней с выбором (галочка)
let selectedLevel = 0;

function renderLevels(levelList) {
  levelsList.innerHTML = "";

  const title = document.createElement("h2");
  title.textContent = "Уровни";
  levelsList.appendChild(title);

  levelList.forEach((name, i) => {
    const item = document.createElement("div");
    item.className = "level-item";
    if (i === selectedLevel) item.classList.add("active");

    const label = document.createElement("span");
    label.className = "level-item__name";
    label.textContent = `${i + 1}. ${name}`;

    const check = document.createElement("span");
    check.className = "level-item__check";
    check.textContent = "✓"; // галочка

    item.appendChild(label);
    item.appendChild(check);

    item.addEventListener("click", () => selectLevel(i));
    levelsList.appendChild(item);
  });
}

function selectLevel(i) {
  selectedLevel = i;
  // Обновляем подсветку и галочку
  levelsList.querySelectorAll(".level-item").forEach((el, idx) => {
    el.classList.toggle("active", idx === selectedLevel);
  });
}

/* ---------- Кнопки специальных действий ---------- */
const gameLevelEl = document.getElementById("game-level");

// «Перейти на уровень» — переносит выбранный уровень в игру
document.getElementById("btn-go-level").addEventListener("click", () => {
  gameLevelEl.textContent = `Уровень ${selectedLevel + 1} — ${levelsName(levels)[selectedLevel]}`;
  showScreen("screen-game");
  currentLevelIndex = selectedLevel;
  console.log('selectedLevel:', selectedLevel);
  redrawGame();

});

// «Начать заново» — очищает поле и сохранение
document.getElementById("btn-restart").addEventListener("click", () => {
  clearProgress();
  showScreen("screen-game");
});

// «Продолжить» — загружает сохранённый прогресс
document.getElementById("btn-continue").addEventListener("click", () => {
  loadProgress();
  showScreen("screen-game");
});

// вешаем салют на пробе
document.addEventListener('keydown', (event) => {
  if (event.code === 'Space' || event.code === 'Backspace') {
    const container = document.getElementById('screen-start');
    confettiSalute(container, cellColor25, 3000, 500, () => {
      console.log('Салют завершён');
    });
  }
});


/* ---------- Инициализация ---------- */
renderCrossword();
//renderQuestions/renderLevels теперь вызываются из .then()
//  после реальной загрузки levels