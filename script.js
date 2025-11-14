// ColorChain Game Logic

// Board constants
const ROWS = 6;
const COLS = 6;
const COLOURS = ['red', 'blue', 'yellow', 'green', 'purple'];

// Game state variables
let board = [];
let isDrawing = false;
let selectedPath = [];
let currentColour = null;
let lastRow = null;
let lastCol = null;
let lastDirection = null;
let turnCount = 0;

let score = 0;
let chainCount = 1;
let maxChain = 0;

let timeLeft = 60;
let timerInterval = null;
let chainTimeout = null;

// Persistent best scores
let bestScore = 0;
let bestChainValue = 0;

// For scaling the time bar when bonus time extends beyond the initial limit
let maxTimeForBar = 60;

// Web Audio context for sound effects
let audioCtx = null;

/**
 * Play a short beep sound when a chain is cleared.
 */
function playSound() {
    try {
        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        oscillator.type = 'triangle';
        oscillator.frequency.value = 440 + Math.random() * 200;
        gainNode.gain.setValueAtTime(0.2, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.2);
        oscillator.connect(gainNode).connect(audioCtx.destination);
        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 0.2);
    } catch (_) {
        // Ignore audio errors
    }
}

// DOM elements
const boardElement = document.getElementById('board');
const timeElement = document.getElementById('time');
const scoreElement = document.getElementById('score');
const chainElement = document.getElementById('chain');
const maxChainElement = document.getElementById('maxChain');
const currentChainElement = document.getElementById('currentChain');
const bestScoreElement = document.getElementById('bestScore');
const bestChainElement = document.getElementById('bestChain');

const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlayTitle');
const overlayInstructions = document.getElementById('overlayInstructions');
const finalScoreDiv = document.getElementById('finalScore');
const playButton = document.getElementById('playButton');
const replayButton = document.getElementById('replayButton');
const shareButtonModal = document.getElementById('shareButtonModal');

const breakCutIn = document.getElementById('breakCutIn');
const timeBar = document.getElementById('timeBar');

/**
 * Initialize a new board with random colours.
 */
function initBoard() {
    board = [];
    for (let r = 0; r < ROWS; r++) {
        board[r] = [];
        for (let c = 0; c < COLS; c++) {
            const colour = COLOURS[Math.floor(Math.random() * COLOURS.length)];
            board[r][c] = colour;
        }
    }
    renderBoard(true);
}

/**
 * Render the board. If createElements is true, create tile elements; otherwise update classes only.
 * @param {boolean} createElements
 */
function renderBoard(createElements = false) {
    if (createElements) {
        boardElement.innerHTML = '';
        for (let r = 0; r < ROWS; r++) {
            for (let c = 0; c < COLS; c++) {
                const tile = document.createElement('div');
                tile.classList.add('tile');
                tile.dataset.row = r;
                tile.dataset.col = c;
                tile.classList.add(board[r][c]);
                boardElement.appendChild(tile);
            }
        }
    } else {
        const tiles = boardElement.querySelectorAll('.tile');
        tiles.forEach(tile => {
            const r = parseInt(tile.dataset.row);
            const c = parseInt(tile.dataset.col);
            COLOURS.forEach(colour => tile.classList.remove(colour));
            const colour = board[r][c];
            if (colour) {
                tile.classList.add(colour);
                tile.style.visibility = 'visible';
            } else {
                tile.style.visibility = 'hidden';
            }
        });
    }
}

/**
 * Start a new game: reset stats, timer, board and overlay.
 */
function startGame() {
    score = 0;
    chainCount = 1;
    maxChain = 0;
    turnCount = 0;
    updateScoreDisplay();
    chainElement.textContent = chainCount;
    maxChainElement.textContent = maxChain;
    currentChainElement.textContent = 0;
    timeLeft = 60;
    maxTimeForBar = 60;
    timeElement.textContent = timeLeft;
    updateTimeBar();
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        timeLeft--;
        if (timeLeft < 0) timeLeft = 0;
        timeElement.textContent = timeLeft;
        updateTimeBar();
        if (timeLeft <= 0) {
            endGame();
        }
    }, 1000);
    // Initialize board
    initBoard();
    if (!hasAvailableMoves()) {
        shuffleBoard();
    }
    // enable interactions
    boardElement.style.pointerEvents = 'auto';
    // Hide overlay
    overlay.classList.add('hidden');
}

/**
 * End the game: stop timer, disable interactions and show result overlay.
 */
function endGame() {
    if (timerInterval) clearInterval(timerInterval);
    boardElement.style.pointerEvents = 'none';
    overlayTitle.textContent = '結果';
    overlayInstructions.style.display = 'none';
    finalScoreDiv.style.display = 'block';
    finalScoreDiv.textContent = `スコア: ${score} / 最長チェーン: ${maxChain}`;
    playButton.style.display = 'none';
    replayButton.style.display = 'block';
    shareButtonModal.style.display = 'block';
    overlay.classList.remove('hidden');
    shareButtonModal.onclick = () => shareResult();
}

/**
 * Update the displayed score.
 */
function updateScoreDisplay() {
    scoreElement.textContent = score;
}

/**
 * Update the width of the time bar based on remaining time.
 */
function updateTimeBar() {
    const ratio = Math.max(0, Math.min(timeLeft / maxTimeForBar, 1));
    timeBar.style.width = (ratio * 100) + '%';
}

/**
 * Load best score and chain from localStorage.
 */
function loadBestStats() {
    const storedScore = localStorage.getItem('colorchain-bestScore');
    const storedChain = localStorage.getItem('colorchain-bestChain');
    bestScore = storedScore ? parseInt(storedScore, 10) : 0;
    bestChainValue = storedChain ? parseInt(storedChain, 10) : 0;
    bestScoreElement.textContent = bestScore;
    bestChainElement.textContent = bestChainValue;
}

/**
 * Save current best score and chain to localStorage.
 */
function saveBestStats() {
    localStorage.setItem('colorchain-bestScore', bestScore.toString());
    localStorage.setItem('colorchain-bestChain', bestChainValue.toString());
}

/**
 * Show a cut-in message in the centre of the screen.
 * @param {string} text
 */
function showCutIn(text) {
    breakCutIn.textContent = text;
    breakCutIn.classList.remove('hidden');
    breakCutIn.classList.add('show');
    setTimeout(() => {
        breakCutIn.classList.remove('show');
        breakCutIn.classList.add('hidden');
    }, 1200);
}

/**
 * Reset overlay to show instructions.
 */
function resetOverlay() {
    overlayTitle.textContent = '遊び方';
    overlayInstructions.style.display = 'block';
    finalScoreDiv.style.display = 'none';
    playButton.style.display = 'block';
    replayButton.style.display = 'none';
    shareButtonModal.style.display = 'none';
}

/**
 * Start a selection when pointer is pressed.
 * @param {HTMLElement} tile
 */
function startSelection(tile) {
    if (timeLeft <= 0) return;
    isDrawing = true;
    selectedPath = [];
    currentColour = null;
    lastDirection = null;
    turnCount = 0;
    const r = parseInt(tile.dataset.row);
    const c = parseInt(tile.dataset.col);
    currentColour = board[r][c];
    lastRow = r;
    lastCol = c;
    selectedPath.push(tile);
    tile.classList.add('selected');
    currentChainElement.textContent = selectedPath.length;
}

/**
 * Handle entering a tile while drawing.
 * Called continuously on pointermove to update the selection.
 * @param {HTMLElement} tile
 */
function handleEnter(tile) {
    if (!isDrawing) return;
    const r = parseInt(tile.dataset.row);
    const c = parseInt(tile.dataset.col);
    const colour = board[r][c];
    if (colour !== currentColour) return;
    const idx = selectedPath.indexOf(tile);
    if (idx >= 0) {
        // Backtrack to previous tile only
        if (idx === selectedPath.length - 2) {
            const lastTile = selectedPath.pop();
            lastTile.classList.remove('selected');
            updateTurnCount();
            currentChainElement.textContent = selectedPath.length;
        }
        return;
    }
    // check adjacency (Manhattan distance 1)
    const dr = Math.abs(r - lastRow);
    const dc = Math.abs(c - lastCol);
    if (dr + dc !== 1) return;
    // update turn count
    const dx = r - lastRow;
    const dy = c - lastCol;
    const dir = `${dx},${dy}`;
    if (lastDirection !== null && dir !== lastDirection) {
        turnCount++;
    }
    lastDirection = dir;
    lastRow = r;
    lastCol = c;
    selectedPath.push(tile);
    tile.classList.add('selected');
    currentChainElement.textContent = selectedPath.length;
}

/**
 * Update turn count after backtracking by recalculating from scratch.
 */
function updateTurnCount() {
    turnCount = 0;
    lastDirection = null;
    for (let i = 1; i < selectedPath.length; i++) {
        const prev = selectedPath[i - 1];
        const curr = selectedPath[i];
        const pr = parseInt(prev.dataset.row);
        const pc = parseInt(prev.dataset.col);
        const cr = parseInt(curr.dataset.row);
        const cc = parseInt(curr.dataset.col);
        const dx = cr - pr;
        const dy = cc - pc;
        const dir = `${dx},${dy}`;
        if (lastDirection !== null && dir !== lastDirection) {
            turnCount++;
        }
        lastDirection = dir;
    }
    // update last position
    const lastTile = selectedPath[selectedPath.length - 1];
    lastRow = parseInt(lastTile.dataset.row);
    lastCol = parseInt(lastTile.dataset.col);
}

/**
 * Finish the current selection: remove if path length ≥3 or clear selection otherwise.
 */
function finishSelection() {
    if (!isDrawing) return;
    isDrawing = false;
    if (selectedPath.length >= 3) {
        const pathLength = selectedPath.length;
        // calculate score and add
        const gained = calculateScore(pathLength, turnCount, chainCount);
        score += gained;
        updateScoreDisplay();
        playSound();
        // bonus time for long chains
        if (pathLength >= 5) {
            const bonusTime = pathLength - 4;
            timeLeft += bonusTime;
            if (timeLeft > maxTimeForBar) {
                maxTimeForBar = timeLeft;
            }
            timeElement.textContent = timeLeft;
            updateTimeBar();
        }
        // update max chain
        if (pathLength > maxChain) {
            maxChain = pathLength;
            maxChainElement.textContent = maxChain;
        }
        // update best stats
        if (score > bestScore) {
            bestScore = score;
            bestScoreElement.textContent = bestScore;
            saveBestStats();
        }
        if (maxChain > bestChainValue) {
            bestChainValue = maxChain;
            bestChainElement.textContent = bestChainValue;
            saveBestStats();
        }
        // remove tiles with burst animation
        selectedPath.forEach(tile => {
            const rr = parseInt(tile.dataset.row);
            const cc = parseInt(tile.dataset.col);
            board[rr][cc] = null;
            tile.classList.remove('selected');
            tile.classList.add('burst');
            setTimeout(() => {
                tile.classList.remove('burst');
            }, 400);
        });
        // collapse and fill after a short delay for burst animation
        setTimeout(() => {
            collapseBoard();
            fillBoard();
            // check available moves
            if (!hasAvailableMoves()) {
                shuffleBoard();
            } else {
                renderBoard();
            }
            applyFallAnimation();
            // chain multiplier update
            chainCount++;
            chainElement.textContent = chainCount;
            if (chainTimeout) clearTimeout(chainTimeout);
            chainTimeout = setTimeout(() => {
                chainCount = 1;
                chainElement.textContent = chainCount;
            }, 2000);
        }, 150);
    } else {
        // less than 3: just clear selection
        selectedPath.forEach(tile => tile.classList.remove('selected'));
    }
    // reset path variables
    selectedPath = [];
    currentColour = null;
    lastDirection = null;
    turnCount = 0;
    currentChainElement.textContent = 0;
}

/**
 * Calculate points for a chain.
 * @param {number} length
 * @param {number} turns
 * @param {number} multiplier
 */
function calculateScore(length, turns, multiplier) {
    const base = length * length * 10;
    const turnBonus = base * 0.15 * turns;
    return Math.round((base + turnBonus) * multiplier);
}

/**
 * Collapse the board vertically: move tiles down to fill empty slots.
 */
function collapseBoard() {
    for (let c = 0; c < COLS; c++) {
        let pointer = ROWS - 1;
        for (let r = ROWS - 1; r >= 0; r--) {
            if (board[r][c] !== null) {
                if (r !== pointer) {
                    board[pointer][c] = board[r][c];
                    board[r][c] = null;
                }
                pointer--;
            }
        }
    }
}

/**
 * Fill empty board slots with new random colours.
 */
function fillBoard() {
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            if (board[r][c] === null) {
                board[r][c] = COLOURS[Math.floor(Math.random() * COLOURS.length)];
            }
        }
    }
}

/**
 * Apply bounce animation to all visible tiles.
 */
function applyFallAnimation() {
    const tiles = boardElement.querySelectorAll('.tile');
    tiles.forEach(tile => {
        tile.classList.add('fall');
        tile.addEventListener('animationend', () => {
            tile.classList.remove('fall');
        }, { once: true });
    });
}

/**
 * Determine if there is any available move (a connected component of size ≥3).
 */
function hasAvailableMoves() {
    const visited = Array.from({ length: ROWS }, () => Array(COLS).fill(false));
    const dirs = [[1,0], [-1,0], [0,1], [0,-1]];
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            if (visited[r][c]) continue;
            const colour = board[r][c];
            let count = 0;
            const queue = [];
            queue.push([r, c]);
            visited[r][c] = true;
            while (queue.length > 0) {
                const [rr, cc] = queue.shift();
                count++;
                for (const [dr, dc] of dirs) {
                    const nr = rr + dr;
                    const nc = cc + dc;
                    if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) continue;
                    if (visited[nr][nc]) continue;
                    if (board[nr][nc] === colour) {
                        visited[nr][nc] = true;
                        queue.push([nr, nc]);
                    }
                }
            }
            if (count >= 3) {
                return true;
            }
        }
    }
    return false;
}

/**
 * Shuffle the board until an available move exists, then show a cut-in.
 */
function shuffleBoard() {
    let attempts = 0;
    do {
        for (let r = 0; r < ROWS; r++) {
            for (let c = 0; c < COLS; c++) {
                board[r][c] = COLOURS[Math.floor(Math.random() * COLOURS.length)];
            }
        }
        attempts++;
        if (attempts > 50) {
            break;
        }
    } while (!hasAvailableMoves());
    renderBoard();
    applyFallAnimation();
    showCutIn('BREAK');
}

/**
 * Copy result to clipboard and open share tweet.
 */
function shareResult() {
    const result = `ColorChainで遊んだよ！\nスコア: ${score} / 最長チェーン: ${maxChain}`;
    navigator.clipboard.writeText(result).catch(() => {});
    const tweetUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(result)}`;
    window.open(tweetUrl, '_blank');
}

// Event listeners for pointer interactions

// Start selection on pointerdown
boardElement.addEventListener('pointerdown', (e) => {
    const tile = e.target.closest('.tile');
    if (!tile) return;
    if (timeLeft <= 0) return;
    e.preventDefault();
    // capture pointer for continuous updates
    try {
        boardElement.setPointerCapture(e.pointerId);
    } catch (_) {}
    startSelection(tile);
});

// Update selection on pointermove
boardElement.addEventListener('pointermove', (e) => {
    if (!isDrawing) return;
    e.preventDefault();
    // Get the element directly under the pointer
    const elem = document.elementFromPoint(e.clientX, e.clientY);
    if (!elem) return;
    const tile = elem.closest('.tile');
    if (!tile) return;
    handleEnter(tile);
});

// Finish selection on pointerup or pointercancel
function handlePointerEnd(e) {
    if (!isDrawing) return;
    try {
        boardElement.releasePointerCapture(e.pointerId);
    } catch (_) {}
    finishSelection();
}
document.addEventListener('pointerup', handlePointerEnd);
document.addEventListener('pointercancel', handlePointerEnd);

// Touch event fallbacks for mobile browsers
// These handlers directly use touch coordinates to determine the tile under the finger.
// They run in parallel with pointer events; isDrawing guards ensure no duplicate processing.
boardElement.addEventListener('touchstart', (e) => {
    if (timeLeft <= 0) return;
    if (e.touches.length > 0) {
        e.preventDefault();
        const touch = e.touches[0];
        const elem = document.elementFromPoint(touch.clientX, touch.clientY);
        if (!elem) return;
        const tile = elem.closest('.tile');
        if (!tile) return;
        startSelection(tile);
    }
}, { passive: false });

boardElement.addEventListener('touchmove', (e) => {
    if (!isDrawing) return;
    if (e.touches.length > 0) {
        e.preventDefault();
        const touch = e.touches[0];
        const elem = document.elementFromPoint(touch.clientX, touch.clientY);
        if (!elem) return;
        const tile = elem.closest('.tile');
        if (!tile) return;
        handleEnter(tile);
    }
}, { passive: false });

boardElement.addEventListener('touchend', () => {
    finishSelection();
});

boardElement.addEventListener('touchcancel', () => {
    finishSelection();
});

// Overlay buttons
playButton.addEventListener('click', () => {
    resetOverlay();
    startGame();
});
replayButton.addEventListener('click', () => {
    resetOverlay();
    startGame();
});

// Prevent context menu on long press (mobile)
document.addEventListener('contextmenu', (e) => e.preventDefault());

// On page load: load stats, init board, disable pointer events, show instructions
loadBestStats();
initBoard();
boardElement.style.pointerEvents = 'none';
resetOverlay();
overlay.classList.remove('hidden');