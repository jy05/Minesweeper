// Game state
let grid = [];
let rows = 9;
let cols = 9;
let mineCount = 10;
let flagCount = 0;
let revealedCount = 0;
let gameOver = false;
let gameStarted = false;
let timer = 0;
let timerInterval = null;
let hints = 3;
let soundEnabled = true;

// Game mode and settings
let gameMode = 'classic'; // 'classic' or 'timeattack'
let timeAttackLimit = 60; // seconds
let isTimeAttack = false;
let playerName = 'Player';
let playerInitials = 'AAA';

// Difficulty settings with customizable mines
const difficulties = {
    easy: { rows: 9, cols: 9, mines: 10 },
    medium: { rows: 16, cols: 16, mines: 40 },
    hard: { rows: 16, cols: 30, mines: 99 }
};

let currentDifficulty = 'easy';

// DOM elements
let gameBoard, faceButton, mineCounter, timeCounter, timerLabel;
let hintButton, hintCount, soundToggle, particleContainer;
let welcomeScreen, highscoresScreen, gameScreen;
let playerNameInput, playerInitialsInput;
let modeIndicator, currentPlayerNameDisplay;
let backToGamesBtn;

// Sound system using Web Audio API
class SoundSystem {
    constructor() {
        this.audioContext = null;
        this.initialized = false;
    }

    init() {
        if (!this.initialized) {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.initialized = true;
        }
    }

    playTone(frequency, duration, type = 'sine') {
        if (!soundEnabled || !this.initialized) return;
        
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        
        oscillator.frequency.value = frequency;
        oscillator.type = type;
        
        gainNode.gain.setValueAtTime(0.3, this.audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + duration);
        
        oscillator.start(this.audioContext.currentTime);
        oscillator.stop(this.audioContext.currentTime + duration);
    }

    click() { this.playTone(300, 0.05, 'square'); }
    reveal() { this.playTone(400, 0.1, 'sine'); }
    flag() { this.playTone(500, 0.1, 'triangle'); }
    explode() {
        this.playTone(100, 0.5, 'sawtooth');
        setTimeout(() => this.playTone(50, 0.3, 'sawtooth'), 100);
    }
    win() {
        const notes = [523, 587, 659, 784];
        notes.forEach((note, i) => {
            setTimeout(() => this.playTone(note, 0.2, 'sine'), i * 150);
        });
    }
    hint() {
        this.playTone(800, 0.15, 'sine');
        setTimeout(() => this.playTone(1000, 0.15, 'sine'), 150);
    }
    timeWarning() {
        this.playTone(1000, 0.1, 'square');
    }
}

const soundSystem = new SoundSystem();

// High Score System
class HighScoreManager {
    constructor() {
        this.storageKey = 'minesweeper_highscores';
    }

    getScores() {
        const data = localStorage.getItem(this.storageKey);
        return data ? JSON.parse(data) : {
            classic: { easy: [], medium: [], hard: [] },
            timeattack: { easy: [], medium: [], hard: [] }
        };
    }

    saveScores(scores) {
        localStorage.setItem(this.storageKey, JSON.stringify(scores));
        this.logScore(scores);
    }

    addScore(mode, difficulty, playerName, initials, time) {
        const scores = this.getScores();
        
        if (!scores[mode]) scores[mode] = { easy: [], medium: [], hard: [] };
        if (!scores[mode][difficulty]) scores[mode][difficulty] = [];
        
        scores[mode][difficulty].push({
            name: playerName,
            initials: initials,
            time: time,
            date: new Date().toISOString()
        });
        
        // Sort by time (ascending) and keep top 10
        scores[mode][difficulty].sort((a, b) => a.time - b.time);
        scores[mode][difficulty] = scores[mode][difficulty].slice(0, 10);
        
        this.saveScores(scores);
        return scores[mode][difficulty];
    }

    logScore(scores) {
        // Log to console for debugging
        console.log('=== HIGH SCORES UPDATED ===');
        console.log('Timestamp:', new Date().toISOString());
        console.log('Scores:', JSON.stringify(scores, null, 2));
        console.log('===========================');
    }

    isHighScore(mode, difficulty, time) {
        const scores = this.getScores();
        const list = scores[mode]?.[difficulty] || [];
        return list.length < 10 || time < list[list.length - 1].time;
    }
}

const highScoreManager = new HighScoreManager();

// Screen Management
function showScreen(screen) {
    welcomeScreen.classList.add('hidden');
    highscoresScreen.classList.add('hidden');
    gameScreen.classList.add('hidden');
    
    if (screen === 'welcome') welcomeScreen.classList.remove('hidden');
    else if (screen === 'highscores') highscoresScreen.classList.remove('hidden');
    else if (screen === 'game') gameScreen.classList.remove('hidden');
}

function startGame(mode, difficulty) {
    gameMode = mode;
    currentDifficulty = difficulty;
    isTimeAttack = (mode === 'timeattack');
    
    playerName = playerNameInput.value.trim() || 'Player';
    playerInitials = (playerInitialsInput.value.trim() || 'AAA').toUpperCase().slice(0, 3).padEnd(3, 'A');
    
    currentPlayerNameDisplay.textContent = `Player: ${playerName} (${playerInitials})`;
    
    if (isTimeAttack) {
        modeIndicator.textContent = `⚡ Time Attack Mode - Complete in ${timeAttackLimit}s!`;
        timerLabel.textContent = '⏱️';
    } else {
        modeIndicator.textContent = '🎮 Classic Mode';
        timerLabel.textContent = '⏱️';
    }
    
    showScreen('game');
    initGame(difficulty);
}

// Initialize game
function initGame(difficulty = 'easy') {
    const settings = difficulties[difficulty];
    rows = settings.rows;
    cols = settings.cols;
    mineCount = settings.mines;
    
    grid = [];
    flagCount = 0;
    revealedCount = 0;
    gameOver = false;
    gameStarted = false;
    timer = isTimeAttack ? timeAttackLimit : 0;
    hints = 3;
    
    clearInterval(timerInterval);
    
    updateCounters();
    hintButton.disabled = false;
    
    createGrid();
    renderGrid();
    updateFace('new');
}

// Grid functions
function createGrid() {
    grid = [];
    for (let r = 0; r < rows; r++) {
        grid[r] = [];
        for (let c = 0; c < cols; c++) {
            grid[r][c] = {
                isMine: false,
                isRevealed: false,
                isFlagged: false,
                neighborMines: 0
            };
        }
    }
}

function placeMines(firstRow, firstCol) {
    let minesPlaced = 0;
    while (minesPlaced < mineCount) {
        const r = Math.floor(Math.random() * rows);
        const c = Math.floor(Math.random() * cols);
        
        const isFirstClick = Math.abs(r - firstRow) <= 1 && Math.abs(c - firstCol) <= 1;
        
        if (!grid[r][c].isMine && !isFirstClick) {
            grid[r][c].isMine = true;
            minesPlaced++;
        }
    }
    
    calculateNumbers();
}

function calculateNumbers() {
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            if (!grid[r][c].isMine) {
                grid[r][c].neighborMines = countAdjacentMines(r, c);
            }
        }
    }
}

function countAdjacentMines(row, col) {
    let count = 0;
    for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
            if (dr === 0 && dc === 0) continue;
            const nr = row + dr;
            const nc = col + dc;
            if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && grid[nr][nc].isMine) {
                count++;
            }
        }
    }
    return count;
}

function renderGrid() {
    gameBoard.innerHTML = '';
    gameBoard.style.gridTemplateColumns = `repeat(${cols}, 30px)`;
    gameBoard.style.gridTemplateRows = `repeat(${rows}, 30px)`;
    
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const cell = document.createElement('div');
            cell.className = 'cell';
            cell.dataset.row = r;
            cell.dataset.col = c;
            
            cell.addEventListener('mousedown', handleMouseDown);
            cell.addEventListener('mouseup', handleMouseUp);
            cell.addEventListener('contextmenu', handleRightClick);
            cell.addEventListener('auxclick', handleAuxClick);
            cell.addEventListener('touchstart', handleTouchStart);
            cell.addEventListener('touchend', handleTouchEnd);
            
            gameBoard.appendChild(cell);
        }
    }
}

function updateCell(row, col) {
    const cell = document.querySelector(`[data-row="${row}"][data-col="${col}"]`);
    const cellData = grid[row][col];
    
    if (cellData.isFlagged) {
        cell.classList.add('flagged');
        cell.classList.remove('revealed');
        cell.textContent = '';
    } else if (cellData.isRevealed) {
        cell.classList.add('revealed');
        cell.classList.remove('flagged');
        
        if (cellData.isMine) {
            cell.classList.add('mine');
            cell.textContent = '';
        } else if (cellData.neighborMines > 0) {
            cell.textContent = cellData.neighborMines;
            cell.dataset.count = cellData.neighborMines;
        } else {
            cell.textContent = '';
        }
    } else {
        cell.classList.remove('revealed', 'flagged');
        cell.textContent = '';
    }
}

// Event handlers
let touchTimer = null;
let touchStart = null;
let mouseDownButtons = 0;
let chordingActive = false;

function handleTouchStart(e) {
    e.preventDefault();
    soundSystem.init();
    
    const touch = e.touches[0];
    touchStart = { x: touch.clientX, y: touch.clientY };
    
    touchTimer = setTimeout(() => {
        const cell = e.target;
        const row = parseInt(cell.dataset.row);
        const col = parseInt(cell.dataset.col);
        handleFlag(row, col);
        touchTimer = null;
    }, 500);
}

function handleTouchEnd(e) {
    e.preventDefault();
    
    if (touchTimer) {
        clearTimeout(touchTimer);
        touchTimer = null;
        
        const cell = e.target;
        const row = parseInt(cell.dataset.row);
        const col = parseInt(cell.dataset.col);
        handleReveal(row, col);
    }
}

function handleMouseDown(e) {
    soundSystem.init();
    
    if (gameOver) return;
    
    mouseDownButtons = e.buttons;
    chordingActive = false;
    
    const row = parseInt(e.target.dataset.row);
    const col = parseInt(e.target.dataset.col);
    
    if (e.buttons === 3) {
        e.preventDefault();
        chordingActive = true;
        handleChord(row, col);
        return;
    }
}

function handleAuxClick(e) {
    e.preventDefault();
    
    if (gameOver) return;
    
    const row = parseInt(e.target.dataset.row);
    const col = parseInt(e.target.dataset.col);
    
    if (e.button === 1) {
        handleChord(row, col);
    }
}

function handleMouseUp(e) {
    if (gameOver) return;
    
    if (chordingActive) {
        chordingActive = false;
        return;
    }
    
    if (e.button !== 0) return;
    
    const row = parseInt(e.target.dataset.row);
    const col = parseInt(e.target.dataset.col);
    
    handleReveal(row, col);
}

function handleRightClick(e) {
    e.preventDefault();
    
    if (gameOver || chordingActive) return;
    
    const row = parseInt(e.target.dataset.row);
    const col = parseInt(e.target.dataset.col);
    
    handleFlag(row, col);
}

// Game actions
function handleReveal(row, col) {
    if (gameOver || grid[row][col].isFlagged || grid[row][col].isRevealed) return;
    
    if (!gameStarted) {
        placeMines(row, col);
        startTimer();
        gameStarted = true;
    }
    
    if (grid[row][col].isMine) {
        revealMine(row, col);
        endGame(false);
    } else {
        revealCell(row, col);
        soundSystem.reveal();
        createParticles(row, col);
        
        if (checkWin()) {
            endGame(true);
        }
    }
}

function handleFlag(row, col) {
    if (gameOver || grid[row][col].isRevealed) return;
    
    grid[row][col].isFlagged = !grid[row][col].isFlagged;
    
    if (grid[row][col].isFlagged) {
        flagCount++;
        soundSystem.flag();
    } else {
        flagCount--;
    }
    
    updateCell(row, col);
    updateCounters();
}

function handleChord(row, col) {
    const cell = grid[row][col];
    
    if (!cell.isRevealed || cell.neighborMines === 0) return;
    
    let adjacentFlags = 0;
    const neighbors = getNeighbors(row, col);
    
    for (const [nr, nc] of neighbors) {
        if (grid[nr][nc].isFlagged) {
            adjacentFlags++;
        }
    }
    
    if (adjacentFlags === cell.neighborMines) {
        soundSystem.click();
        for (const [nr, nc] of neighbors) {
            if (!grid[nr][nc].isFlagged && !grid[nr][nc].isRevealed) {
                handleReveal(nr, nc);
            }
        }
    }
}

function getNeighbors(row, col) {
    const neighbors = [];
    for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
            if (dr === 0 && dc === 0) continue;
            const nr = row + dr;
            const nc = col + dc;
            if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
                neighbors.push([nr, nc]);
            }
        }
    }
    return neighbors;
}

function revealCell(row, col) {
    if (row < 0 || row >= rows || col < 0 || col >= cols) return;
    if (grid[row][col].isRevealed || grid[row][col].isFlagged) return;
    
    grid[row][col].isRevealed = true;
    revealedCount++;
    updateCell(row, col);
    
    if (grid[row][col].neighborMines === 0) {
        for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
                if (dr === 0 && dc === 0) continue;
                revealCell(row + dr, col + dc);
            }
        }
    }
}

function revealMine(row, col) {
    grid[row][col].isRevealed = true;
    updateCell(row, col);
    soundSystem.explode();
}

function revealAllMines() {
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            if (grid[r][c].isMine) {
                grid[r][c].isRevealed = true;
                updateCell(r, c);
            }
        }
    }
}

// Hint system
function useHint() {
    if (hints <= 0 || gameOver || !gameStarted) return;
    
    let safeCells = [];
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            if (!grid[r][c].isMine && !grid[r][c].isRevealed && !grid[r][c].isFlagged) {
                safeCells.push([r, c]);
            }
        }
    }
    
    if (safeCells.length > 0) {
        const [safeRow, safeCol] = safeCells[Math.floor(Math.random() * safeCells.length)];
        
        hints--;
        hintCount.textContent = hints;
        
        if (hints === 0) {
            hintButton.disabled = true;
        }
        
        const cell = document.querySelector(`[data-row="${safeRow}"][data-col="${safeCol}"]`);
        cell.classList.add('hint-glow');
        setTimeout(() => {
            cell.classList.remove('hint-glow');
            handleReveal(safeRow, safeCol);
        }, 500);
        
        soundSystem.hint();
        createParticles(safeRow, safeCol, '✨');
    }
}

// Particle effects
function createParticles(row, col, emoji = '💥') {
    const cell = document.querySelector(`[data-row="${row}"][data-col="${col}"]`);
    if (!cell) return;
    
    const rect = cell.getBoundingClientRect();
    
    for (let i = 0; i < 5; i++) {
        const particle = document.createElement('div');
        particle.className = 'particle';
        particle.textContent = emoji;
        particle.style.left = rect.left + rect.width / 2 + 'px';
        particle.style.top = rect.top + rect.height / 2 + 'px';
        particle.style.fontSize = '20px';
        
        const angle = (Math.PI * 2 * i) / 5;
        const distance = 50;
        particle.style.setProperty('--tx', Math.cos(angle) * distance + 'px');
        particle.style.setProperty('--ty', Math.sin(angle) * distance + 'px');
        
        particleContainer.appendChild(particle);
        
        setTimeout(() => particle.remove(), 1000);
    }
}

// Timer
function startTimer() {
    timerInterval = setInterval(() => {
        if (isTimeAttack) {
            timer--;
            if (timer <= 10 && timer > 0) {
                soundSystem.timeWarning();
            }
            if (timer <= 0) {
                endGame(false);
            }
        } else {
            timer++;
        }
        updateCounters();
    }, 1000);
}

function stopTimer() {
    clearInterval(timerInterval);
}

// Win/Lose
function checkWin() {
    const totalCells = rows * cols;
    const safeCells = totalCells - mineCount;
    return revealedCount === safeCells;
}

function endGame(won) {
    gameOver = true;
    stopTimer();
    
    if (won) {
        updateFace('win');
        soundSystem.win();
        gameBoard.classList.add('win');
        setTimeout(() => gameBoard.classList.remove('win'), 1500);
        
        // Check and save high score
        const finalTime = isTimeAttack ? (timeAttackLimit - timer) : timer;
        if (highScoreManager.isHighScore(gameMode, currentDifficulty, finalTime)) {
            setTimeout(() => {
                alert(`🎉 New High Score! Time: ${finalTime}s`);
                highScoreManager.addScore(gameMode, currentDifficulty, playerName, playerInitials, finalTime);
            }, 1000);
        }
        
        // Celebration particles
        for (let i = 0; i < 20; i++) {
            setTimeout(() => {
                const x = Math.random() * window.innerWidth;
                const y = Math.random() * window.innerHeight;
                const particle = document.createElement('div');
                particle.className = 'particle';
                particle.textContent = ['🎉', '🎊', '⭐', '✨'][Math.floor(Math.random() * 4)];
                particle.style.left = x + 'px';
                particle.style.top = y + 'px';
                particle.style.fontSize = '30px';
                particleContainer.appendChild(particle);
                setTimeout(() => particle.remove(), 1000);
            }, i * 100);
        }
    } else {
        updateFace('lose');
        revealAllMines();
    }
}

// UI Updates
function updateCounters() {
    const remaining = mineCount - flagCount;
    mineCounter.textContent = String(remaining).padStart(3, '0');
    timeCounter.textContent = String(Math.min(Math.abs(timer), 999)).padStart(3, '0');
    hintCount.textContent = hints;
}

function updateFace(state) {
    if (state === '😎' || state === 'win') {
        faceButton.textContent = 'You Won! 🎉';
        faceButton.style.background = 'linear-gradient(145deg, #4CAF50, #45a049)';
    } else if (state === '😵' || state === 'lose') {
        faceButton.textContent = 'Game Over 💣';
        faceButton.style.background = 'linear-gradient(145deg, #f44336, #da190b)';
    } else {
        faceButton.textContent = 'New Game';
        faceButton.style.background = 'linear-gradient(145deg, #667eea, #764ba2)';
    }
}

// High Score Display
function displayHighScores(mode, difficulty) {
    const scores = highScoreManager.getScores();
    const scoresList = document.getElementById('scoresList');
    const list = scores[mode]?.[difficulty] || [];
    
    if (list.length === 0) {
        scoresList.innerHTML = '<div class="no-scores">No high scores yet. Be the first!</div>';
        return;
    }
    
    scoresList.innerHTML = list.map((score, index) => `
        <div class="score-entry">
            <div class="score-rank">#${index + 1}</div>
            <div class="score-player">
                <div>${score.name}</div>
                <div style="color: #999; font-size: 0.9em;">${score.initials}</div>
            </div>
            <div class="score-time">${score.time}s</div>
        </div>
    `).join('');
}

// Initialize DOM and setup
function initializeGame() {
    gameBoard = document.getElementById('gameBoard');
    faceButton = document.getElementById('faceButton');
    mineCounter = document.getElementById('mineCounter');
    timeCounter = document.getElementById('timeCounter');
    timerLabel = document.getElementById('timerLabel');
    hintButton = document.getElementById('hintButton');
    hintCount = document.getElementById('hintCount');
    soundToggle = document.getElementById('soundToggle');
    particleContainer = document.getElementById('particleContainer');
    welcomeScreen = document.getElementById('welcomeScreen');
    highscoresScreen = document.getElementById('highscoresScreen');
    gameScreen = document.getElementById('gameScreen');
    playerNameInput = document.getElementById('playerName');
    playerInitialsInput = document.getElementById('playerInitials');
    modeIndicator = document.getElementById('modeIndicator');
    currentPlayerNameDisplay = document.getElementById('currentPlayerName');
    
    // Welcome screen sliders
    const timeAttackSlider = document.getElementById('timeAttackSlider');
    const timeAttackDisplay = document.getElementById('timeAttackDisplay');
    timeAttackSlider.addEventListener('input', (e) => {
        timeAttackLimit = parseInt(e.target.value);
        timeAttackDisplay.textContent = timeAttackLimit;
    });
    
    const mineSliders = {
        easy: { slider: document.getElementById('easyMinesSlider'), display: document.getElementById('easyMinesDisplay') },
        medium: { slider: document.getElementById('mediumMinesSlider'), display: document.getElementById('mediumMinesDisplay') },
        hard: { slider: document.getElementById('hardMinesSlider'), display: document.getElementById('hardMinesDisplay') }
    };
    
    Object.keys(mineSliders).forEach(diff => {
        const { slider, display } = mineSliders[diff];
        slider.addEventListener('input', (e) => {
            difficulties[diff].mines = parseInt(e.target.value);
            display.textContent = e.target.value;
        });
    });
    
    // Mode selection buttons
    document.querySelectorAll('.mode-card .mode-btn').forEach((btn) => {
        btn.addEventListener('click', (e) => {
            const modeCard = e.target.closest('.mode-card');
            const mode = modeCard.dataset.mode;
            const difficulty = document.querySelector('input[name="difficulty"]:checked').value;
            startGame(mode, difficulty);
        });
    });
    
    // High scores navigation
    document.getElementById('viewScoresBtn').addEventListener('click', () => {
        showScreen('highscores');
        displayHighScores('classic', 'easy');
    });
    
    document.getElementById('backToMenuBtn').addEventListener('click', () => {
        showScreen('welcome');
    });
    
    document.getElementById('backToMenuGameBtn').addEventListener('click', () => {
        stopTimer();
        showScreen('welcome');
    });
    
    document.getElementById('backToGamesBtn').addEventListener('click', () => {
        window.location.href = '../games.html';
    });
    
    // High scores tabs
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            const mode = e.target.dataset.mode;
            const difficulty = document.querySelector('.diff-tab-btn.active').dataset.difficulty;
            displayHighScores(mode, difficulty);
        });
    });
    
    document.querySelectorAll('.diff-tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.diff-tab-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            const mode = document.querySelector('.tab-btn.active').dataset.mode;
            const difficulty = e.target.dataset.difficulty;
            displayHighScores(mode, difficulty);
        });
    });
    
    // Game screen buttons
    faceButton.addEventListener('click', () => {
        initGame(currentDifficulty);
    });
    
    hintButton.addEventListener('click', () => {
        if (hints > 0 && !gameOver && gameStarted) {
            useHint();
        }
    });
    
    soundToggle.addEventListener('change', (e) => {
        soundEnabled = e.target.checked;
    });
    
    gameBoard.addEventListener('contextmenu', (e) => e.preventDefault());
    
    // Background Music Controls
    const gameBgMusic = document.getElementById('gameBgMusic');
    const volumeSlider = document.getElementById('volumeSlider');
    const volumeIcon = document.getElementById('volumeIcon');
    const volumePercent = document.getElementById('volumePercent');
    const muteToggle = document.getElementById('muteToggle');
    
    gameBgMusic.volume = 0.15;
    let isMusicMuted = false;
    
    // Try to start music on page load
    gameBgMusic.play().catch(() => {
        // If autoplay is blocked, start on first interaction
        const startMusic = () => {
            gameBgMusic.play().catch(e => console.log('Music play failed:', e));
        };
        document.addEventListener('click', startMusic, { once: true });
    });
    
    volumeSlider.addEventListener('input', (e) => {
        const volume = e.target.value / 100;
        gameBgMusic.volume = volume;
        volumePercent.textContent = e.target.value + '%';
        
        if (volume === 0) {
            volumeIcon.textContent = '🔇';
        } else if (volume < 0.5) {
            volumeIcon.textContent = '🔉';
        } else {
            volumeIcon.textContent = '🔊';
        }
    });
    
    muteToggle.addEventListener('click', () => {
        if (isMusicMuted) {
            gameBgMusic.play();
            muteToggle.textContent = '🔇 Mute';
            isMusicMuted = false;
        } else {
            gameBgMusic.pause();
            muteToggle.textContent = '🔊 Unmute';
            isMusicMuted = true;
        }
    });
    
    // Start on welcome screen
    showScreen('welcome');
}

// Wait for DOM
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeGame);
} else {
    initializeGame();
}
