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

// Difficulty settings
const difficulties = {
    easy: { rows: 9, cols: 9, mines: 10 },
    medium: { rows: 16, cols: 16, mines: 40 },
    hard: { rows: 16, cols: 30, mines: 99 }
};

// DOM elements - will be initialized when DOM is ready
let gameBoard;
let faceButton;
let mineCounter;
let timeCounter;
let hintButton;
let hintCount;
let soundToggle;
let difficultyButtons;
let particleContainer;

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

    click() {
        this.playTone(300, 0.05, 'square');
    }

    reveal() {
        this.playTone(400, 0.1, 'sine');
    }

    flag() {
        this.playTone(500, 0.1, 'triangle');
    }

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
}

const soundSystem = new SoundSystem();

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
    timer = 0;
    hints = 3;
    
    clearInterval(timerInterval);
    
    updateCounters();
    hintButton.disabled = false;
    
    createGrid();
    renderGrid();
    updateFace('😊');
}

// Create grid structure
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

// Place mines (after first click)
function placeMines(firstRow, firstCol) {
    let minesPlaced = 0;
    while (minesPlaced < mineCount) {
        const r = Math.floor(Math.random() * rows);
        const c = Math.floor(Math.random() * cols);
        
        // Don't place mine on first click or adjacent cells
        const isFirstClick = Math.abs(r - firstRow) <= 1 && Math.abs(c - firstCol) <= 1;
        
        if (!grid[r][c].isMine && !isFirstClick) {
            grid[r][c].isMine = true;
            minesPlaced++;
        }
    }
    
    calculateNumbers();
}

// Calculate neighbor mine counts
function calculateNumbers() {
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            if (!grid[r][c].isMine) {
                grid[r][c].neighborMines = countAdjacentMines(r, c);
            }
        }
    }
}

// Count adjacent mines
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

// Render grid
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
            
            // Mouse events
            cell.addEventListener('mousedown', handleMouseDown);
            cell.addEventListener('mouseup', handleMouseUp);
            cell.addEventListener('contextmenu', handleRightClick);
            cell.addEventListener('auxclick', handleAuxClick);
            
            // Touch events for mobile
            cell.addEventListener('touchstart', handleTouchStart);
            cell.addEventListener('touchend', handleTouchEnd);
            
            gameBoard.appendChild(cell);
        }
    }
}

// Update cell display
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

// Mouse/Touch event handlers
let touchTimer = null;
let touchStart = null;
let mouseDownButtons = 0;
let chordingActive = false;

function handleTouchStart(e) {
    e.preventDefault();
    soundSystem.init();
    
    const touch = e.touches[0];
    touchStart = { x: touch.clientX, y: touch.clientY };
    
    // Long press for flag
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
        
        // Short tap for reveal
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
    
    // Both mouse buttons pressed (left + right)
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
    
    // Middle click (button 1) for chording
    if (e.button === 1) {
        handleChord(row, col);
    }
}

function handleMouseUp(e) {
    if (gameOver) return;
    
    // Don't process mouseup if we just did a chord with both buttons
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
    
    // Don't flag if we're chording
    if (gameOver || chordingActive) return;
    
    const row = parseInt(e.target.dataset.row);
    const col = parseInt(e.target.dataset.col);
    
    handleFlag(row, col);
}

// Core game actions
function handleReveal(row, col) {
    if (gameOver || grid[row][col].isFlagged || grid[row][col].isRevealed) return;
    
    // Start game on first click
    if (!gameStarted) {
        placeMines(row, col);
        startTimer();
        gameStarted = true;
    }
    
    if (grid[row][col].isMine) {
        // Game over
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

// Chording - reveal all adjacent cells if flags match mine count
function handleChord(row, col) {
    const cell = grid[row][col];
    
    if (!cell.isRevealed || cell.neighborMines === 0) return;
    
    // Count adjacent flags
    let adjacentFlags = 0;
    const neighbors = getNeighbors(row, col);
    
    for (const [nr, nc] of neighbors) {
        if (grid[nr][nc].isFlagged) {
            adjacentFlags++;
        }
    }
    
    // If flags match mine count, reveal all non-flagged neighbors
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
    
    // Flood fill if no adjacent mines
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

// Hint feature (surprise gameplay element)
function useHint() {
    if (hints <= 0 || gameOver || !gameStarted) return;
    
    // Find a safe, unrevealed, unflagged cell
    let safeCells = [];
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            if (!grid[r][c].isMine && !grid[r][c].isRevealed && !grid[r][c].isFlagged) {
                safeCells.push([r, c]);
            }
        }
    }
    
    if (safeCells.length > 0) {
        // Pick a random safe cell
        const [safeRow, safeCol] = safeCells[Math.floor(Math.random() * safeCells.length)];
        
        hints--;
        hintCount.textContent = hints;
        
        if (hints === 0) {
            hintButton.disabled = true;
        }
        
        // Reveal the safe cell with animation
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
        timer++;
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
        updateFace('😎');
        soundSystem.win();
        gameBoard.classList.add('win');
        setTimeout(() => gameBoard.classList.remove('win'), 1500);
        
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
        updateFace('😵');
        revealAllMines();
    }
}

// UI Updates
function updateCounters() {
    const remaining = mineCount - flagCount;
    mineCounter.textContent = String(remaining).padStart(3, '0');
    timeCounter.textContent = String(Math.min(timer, 999)).padStart(3, '0');
    hintCount.textContent = hints;
}

function updateFace(emoji) {
    faceButton.textContent = emoji;
}

// Event listeners
faceButton.addEventListener('click', () => {
    const activeDifficulty = document.querySelector('.diff-btn.active').dataset.difficulty;
    initGame(activeDifficulty);
});

hintButton.addEventListener('click', () => {
    if (hints > 0 && !gameOver && gameStarted) {
        useHint();
    }
});

soundToggle.addEventListener('change', (e) => {
    soundEnabled = e.target.checked;
});

difficultyButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        difficultyButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        initGame(btn.dataset.difficulty);
    });
});
faceButton.addEventListener('click', () => {
    const activeDifficulty = document.querySelector('.diff-btn.active').dataset.difficulty;
    initGame(activeDifficulty);
});

hintButton.addEventListener('click', () => {
    if (hints > 0 && !gameOver && gameStarted) {
        useHint();
    }
});

soundToggle.addEventListener('change', (e) => {
    soundEnabled = e.target.checked;
});

difficultyButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        difficultyButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        initGame(btn.dataset.difficulty);
    });
});

// Prevent context menu on game board
gameBoard.addEventListener('contextmenu', (e) => e.preventDefault());

// Initialize DOM and start game
function initializeGame() {
    gameBoard = document.getElementById('gameBoard');
    faceButton = document.getElementById('faceButton');
    mineCounter = document.getElementById('mineCounter');
    timeCounter = document.getElementById('timeCounter');
    hintButton = document.getElementById('hintButton');
    hintCount = document.getElementById('hintCount');
    soundToggle = document.getElementById('soundToggle');
    difficultyButtons = document.querySelectorAll('.diff-btn');
    particleContainer = document.getElementById('particleContainer');
    
    // Add event listeners
    faceButton.addEventListener('click', () => {
        const activeDifficulty = document.querySelector('.diff-btn.active').dataset.difficulty;
        initGame(activeDifficulty);
    });
    
    hintButton.addEventListener('click', () => {
        if (hints > 0 && !gameOver && gameStarted) {
            useHint();
        }
    });
    
    soundToggle.addEventListener('change', (e) => {
        soundEnabled = e.target.checked;
    });
    
    difficultyButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            difficultyButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            initGame(btn.dataset.difficulty);
        });
    });
    
    gameBoard.addEventListener('contextmenu', (e) => e.preventDefault());
    
    // Start the game
    initGame('easy');
}

// Wait for DOM to be ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeGame);
} else {
    initializeGame();
}
