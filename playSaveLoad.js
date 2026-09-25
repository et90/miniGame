/*
!как сохраняется прогресс игры в localStorage:
    поля:
    nameGame: общее название игры или всех уровней
    curentLevelIndex: текущий уровень
    openShapes: [6,1,3,] map открытые фигуры отгаданные слова в текущем уровне

! сохраняемые переменные:
    gameStatus: текущий статус игры
    nameGame: общее название игры или всех уровней
    cellSize: размер ячейки
    firstStart: первый запуск игры. Нужно для [ ИГРАТЬ ] или [ НАЧАТЬ ЗАНОВО , ПРОДОЛЖИТЬ ]
*/

export function saveGameProgress(nameGame, currentLevelIndex, openShapes) {
    try {
        const save = {
            nameGame: nameGame,
            currentLevelIndex: currentLevelIndex,
            openShapes: openShapes
        };
        let savedGames = JSON.parse(localStorage.getItem('savedGames'));
        if (!savedGames) {
            savedGames = [];
        }

        let saveLevel = savedGames.find(lvl => lvl.nameGame === nameGame);
        if (!saveLevel) {
            savedGames.push(save);
        } else {
            saveLevel.currentLevelIndex = currentLevelIndex;
            saveLevel.openShapes = openShapes;
        }
        localStorage.setItem('savedGames', JSON.stringify(savedGames));
    } catch (error) {
        console.error("Ошибка при сохранении прогресса игры в localStorage:", error);
    }
}

export function loadGameProgress(nameGame) {
    try {
        let savedGames = JSON.parse(localStorage.getItem('savedGames'));
        if (!savedGames) return null;
        let saveLevel = savedGames.find(lvl => lvl.nameGame === nameGame);
        if (!saveLevel) return null;
        return saveLevel;
    }
    catch (error) {
        console.error("Ошибка при чтении прогресса игры из localStorage:", error);
    }
}

