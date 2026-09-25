/**
 * Проверяет, находятся ли две клетки в одной строке или одном столбце.
 * Используется для запрета диагональных переходов.
 */
function isOrthogonal(a, b) {
    return a.row === b.row || a.col === b.col;
}

/**
 * Переводит координаты клетки в координаты ее центра на canvas.
 */
function toCenterPoint(cell, cellSize) {
    return {
        x: cell.col * cellSize + cellSize / 2,
        y: cell.row * cellSize + cellSize / 2
    };
}

/**
 * Очищает canvas и рисует линию по переданному пути клеток.
 */
function drawPath(ctx, path, cellSize, lineColor, lineWidth) {
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    if (path.length < 2) {
        return;
    }

    ctx.strokeStyle = lineColor;
    ctx.lineWidth = lineWidth;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";

    const first = toCenterPoint(path[0], cellSize);
    ctx.beginPath();
    ctx.moveTo(first.x, first.y);

    for (let i = 1; i < path.length; i++) {
        const point = toCenterPoint(path[i], cellSize);
        ctx.lineTo(point.x, point.y);
    }

    ctx.stroke();
}

/**
 * Определяет клетку по координатам указателя относительно canvas.
 * Возвращает null, если указатель вышел за пределы поля.
 */
function getCellFromClientPoint(clientX, clientY, canvas, cellSize, levelWidth, levelHeight) {
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    if (x < 0 || y < 0 || x >= rect.width || y >= rect.height) {
        return null;
    }

    const col = Math.floor(x / cellSize);
    const row = Math.floor(y / cellSize);

    if (col < 0 || row < 0 || col >= levelWidth || row >= levelHeight) {
        return null;
    }

    return { row, col };
}

/**
 * Определяет клетку по touch-событию относительно canvas.
 */
function getCellFromTouchEvent(event, canvas, cellSize, levelWidth, levelHeight) {
    const touch = event.touches[0] || event.changedTouches[0];
    if (!touch) {
        return null;
    }

    return getCellFromClientPoint(touch.clientX, touch.clientY, canvas, cellSize, levelWidth, levelHeight);
}

/**
 * Добавляет в путь все промежуточные клетки между двумя ортогональными точками.
 * Диагональные переходы игнорируются.
 */
function appendIntermediateCells(path, fromCell, toCell) {
    if (!isOrthogonal(fromCell, toCell)) {
        return;
    }

    if (fromCell.row === toCell.row) {
        const step = toCell.col > fromCell.col ? 1 : -1;
        for (let col = fromCell.col + step; col !== toCell.col + step; col += step) {
            path.push({ row: fromCell.row, col });
        }
        return;
    }

    const step = toCell.row > fromCell.row ? 1 : -1;
    for (let row = fromCell.row + step; row !== toCell.row + step; row += step) {
        path.push({ row, col: fromCell.col });
    }
}

/**
 * Создает overlay-canvas поверх поля и возвращает его DOM-элемент.
 */
export function initCanvas(fieldElement, cellSize, levelWidth, levelHeight) {
    if (!(fieldElement instanceof HTMLElement)) {
        throw new Error("fieldElement должен быть DOM-элементом");
    }

    fieldElement.style.position = fieldElement.style.position || "relative";

    const canvas = document.createElement("canvas");
    canvas.width = levelWidth * cellSize;
    canvas.height = levelHeight * cellSize;
    canvas.style.position = "absolute";
    canvas.style.left = "0";
    canvas.style.top = "0";
    canvas.style.pointerEvents = "none";
    canvas.style.width = `${canvas.width}px`;
    canvas.style.height = `${canvas.height}px`;
    //canvas.style.border = "1px solid #000";

    fieldElement.appendChild(canvas);
    return canvas;
}

/**
 * Включает интерактивное рисование линии по клеткам на canvas.
 * Линия строится только по горизонтали и вертикали, а рисование
 * прекращается при отпускании кнопки мыши или выходе курсора за поле.
 */
export function enableCanvasLineDrawing(options) {
    const {
        isMobile = false,
        fieldElement,
        canvas,
        cellSize,
        levelWidth,
        levelHeight,
        lineColor = "#ff3b30",
        lineWidth = Math.max(2, Math.floor(cellSize * 0.24)),
        onCellSelected = null,
        onDrawEnd = null
    } = options;

    /**
     * Завершает текущее рисование и вызывает callback с готовым путем.
     */
    if (!(fieldElement instanceof HTMLElement)) {
        throw new Error("fieldElement должен быть DOM-элементом");
    }

    if (!(canvas instanceof HTMLCanvasElement)) {
        throw new Error("canvas должен быть HTMLCanvasElement");
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) {
        throw new Error("Не удалось получить 2D-контекст canvas");
    }

    let isDrawing = false;
    let path = [];

    /**
     * Останавливает режим рисования.
     */
    function finishDrawing() {
        if (!isDrawing) {
            return;
        }

        isDrawing = false;
        if (onDrawEnd) {
            onDrawEnd(path.slice());
        }
    }

    /**
     * Начинает новую линию с первой выбранной клетки.
     */
    function beginDrawing(cell) {
        isDrawing = true;
        path = [cell];

        if (onCellSelected) {
            onCellSelected(cell, path.slice());
        }

        drawPath(ctx, path, cellSize, lineColor, lineWidth);
    }

    /**
     * Продолжает линию, если курсор перешел в следующую ортогональную клетку.
     */
    function continueDrawing(cell) {
        if (!isDrawing || !cell) {
            return;
        }

        const last = path[path.length - 1];
        if (last.row === cell.row && last.col === cell.col) {
            return;
        }

        if (!isOrthogonal(last, cell)) {
            return;
        }

        const oldLength = path.length;
        appendIntermediateCells(path, last, cell);

        if (path.length === oldLength) {
            return;
        }

        if (onCellSelected) {
            for (let i = oldLength; i < path.length; i++) {
                onCellSelected(path[i], path.slice());
            }
        }

        drawPath(ctx, path, cellSize, lineColor, lineWidth);
    }

    /**
     * Обрабатывает нажатие левой кнопки мыши и старт рисования.
     */
    function onMouseDown(event) {
        if (event.button !== 0) {
            return;
        }

        const cell = getCellFromClientPoint(event.clientX, event.clientY, canvas, cellSize, levelWidth, levelHeight);
        if (!cell) {
            return;
        }

        beginDrawing(cell);
    }

    /**
     * Отслеживает движение мыши и добавляет новые клетки в путь.
     */
    function onMouseMove(event) {
        if (!isDrawing) {
            return;
        }

        const cell = getCellFromClientPoint(event.clientX, event.clientY, canvas, cellSize, levelWidth, levelHeight);
        if (!cell) {
            finishDrawing();
            return;
        }

        continueDrawing(cell);
    }

    function onTouchStart(event) {
        event.preventDefault();

        const cell = getCellFromTouchEvent(event, canvas, cellSize, levelWidth, levelHeight);
        if (!cell) {
            return;
        }

        beginDrawing(cell);
    }

    function onTouchMove(event) {
        if (!isDrawing) {
            return;
        }

        event.preventDefault();

        const cell = getCellFromTouchEvent(event, canvas, cellSize, levelWidth, levelHeight);
        if (!cell) {
            finishDrawing();
            return;
        }

        continueDrawing(cell);
    }

    /**
     * Очищает canvas и сбрасывает накопленный путь.
     */
    function clear() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        path = [];
    }

    if (isMobile) {
        fieldElement.addEventListener("touchstart", onTouchStart, { passive: false });
        fieldElement.addEventListener("touchmove", onTouchMove, { passive: false });
        fieldElement.addEventListener("touchend", finishDrawing);
        fieldElement.addEventListener("touchcancel", finishDrawing);
    } else {
        fieldElement.addEventListener("mousedown", onMouseDown);
        fieldElement.addEventListener("mousemove", onMouseMove);
        fieldElement.addEventListener("mouseleave", finishDrawing);
        window.addEventListener("mouseup", finishDrawing);
    }

    return {
        clear,
        /**
         * Снимает все подписки на события и освобождает обработчики.
         */
        destroy() {
            if (isMobile) {
                fieldElement.removeEventListener("touchstart", onTouchStart);
                fieldElement.removeEventListener("touchmove", onTouchMove);
                fieldElement.removeEventListener("touchend", finishDrawing);
                fieldElement.removeEventListener("touchcancel", finishDrawing);
            } else {
                fieldElement.removeEventListener("mousedown", onMouseDown);
                fieldElement.removeEventListener("mousemove", onMouseMove);
                fieldElement.removeEventListener("mouseleave", finishDrawing);
                window.removeEventListener("mouseup", finishDrawing);
            }
            canvas.remove();            
        }
    };
}

export function renderLevel(levelsArray, levelId, cellSize, classNameLetterBlock, container, openShapesArray, colorArray) {
  container.innerHTML = ""; // Очистка контейнера перед рендерингом
  if (!(container instanceof HTMLElement)) {
    throw new Error("container должен быть DOM-элементом");
  }
  const level = levelsArray.find(obj => obj["id"] === levelId);
  let fieldWidth = level.width;
  let fieldHeight = level.height;
  let gridData = level.grid;
  let shapes = level.shapes;
  let words = level.words; // массив слов для текущего уровня

  const table = document.createElement("table");
  table.id = "gameTable";
  table.style.borderCollapse = "collapse";
  table.style.borderSpacing = "0";
  //table.style.border = "1px solid #ff0f0f";
  table.style.width = `${fieldWidth * cellSize}px`;

  for (let row = 0; row < fieldHeight; row++) {
    const tr = document.createElement("tr");

    for (let col = 0; col < fieldWidth; col++) {
      const td = document.createElement("td");
      td.style.padding = "0";
      td.style.margin = "0";

      const cell = document.createElement("div");
      cell.style.width = `${cellSize}px`;
      cell.style.height = `${cellSize}px`;

      const shapeNumber = gridData[row][col];
      const shape = shapes.find(s => s.id === shapeNumber);
      const word = words[shapeNumber - 1]; // предполагаем, что id слова соответствует id фигуры - 1
      //console.log('word:', word);
      if (shape) {
        let block = null;
        const letterIndex = shape.cells.findIndex(c => c.x === col && c.y === row);
        if (letterIndex !== -1) {
            if (openShapesArray.includes(shapeNumber)) {
                 block = createLetterBlock(word.word[letterIndex].toUpperCase(), "#ffffff", colorArray[shapeNumber % colorArray.length], "#BEC3C5", cellSize * 0.9);

            }else{

                 block = createLetterBlock(word.word[letterIndex].toUpperCase(), "#000", "#f5f5f5", "#BEC3C5", cellSize * 0.9);
            }
          cell.appendChild(block);
        }
      }
      cell.xposition = col;
      cell.yposition = row;
      td.appendChild(cell);
      tr.appendChild(td);
    }
    table.appendChild(tr);
  }

  container.appendChild(table);
}


/**
* Создаёт div-блок с буквой, похожий на плитку из игры.
*
* @param {string} letter           Буква внутри блока
* @param {string} letterColor      Цвет буквы
* @param {string} backgroundColor  Цвет фона блока
* @param {string} shadowColor      Цвет тени
* @returns {HTMLDivElement}        Готовый div-элемент
*/
export function createLetterBlock(letter, letterColor, backgroundColor, shadowColor, size = 48) {
  // Создаём div
  const block = document.createElement("div");
  block.classList.add("game-letter-block");

  // Добавляем букву внутрь блока
  block.textContent = letter;

  // Размер блока
  block.style.width = `${size}px`;
  block.style.height = `${size}px`;

  // Цвета
  block.style.color = letterColor;
  block.style.backgroundColor = backgroundColor;

  // Скругление углов
  block.style.borderRadius = "8px";

  // Центрируем букву
  block.style.display = "flex";
  block.style.alignItems = "center";
  block.style.justifyContent = "center";

  // Стиль текста
  block.style.fontSize = `${size * 0.66}px`;
  block.style.fontWeight = "900";
  block.style.lineHeight = "1";

  // Тень, похожая на объёмную плитку
  block.style.boxShadow = `
    0 4px 0 ${shadowColor},
    0 4px 8px rgba(0, 0, 0, 0.25)
  `;

  // Небольшая внутренняя подсветка сверху
  block.style.backgroundImage = `
    linear-gradient(
      to bottom,
      rgba(255, 255, 255, 0.25),
      rgba(255, 255, 255, 0) 45%
    )
  `;

  // Чтобы блок выглядел как игровая кнопка
  block.style.userSelect = "none";
  block.style.boxSizing = "border-box";

  return block;
}