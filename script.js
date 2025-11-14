// ColorChain game logic

// Board dimensions and colour palette
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

// Persistent best score and chain values
let bestScore = 0;
let bestChainValue = 0;

// Maximum time used to scale the time bar; starts at 60 and increases if timeLeft exceeds it
let maxTimeForBar = 60;

// Audio context for simple sound effects
let audioCtx = null;

/**
 * Play a simple beep sound when a chain is cleared. Uses the Web Audio API.
 */
function playSound() {
    try {
        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        // Ensure context is resumed (required on some browsers after user interaction)
        if (audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        oscillator.type = 'triangle';
        // Slight random variation in frequency for more organic feel
        oscillator.frequency.value = 440 + Math.random() * 200;
        gainNode.gain.setValueAtTime(0.2, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.2);
        oscillator.connect(gainNode).connect(audioCtx.destination);
        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 0.2);
    } catch (e) {
        // Ignore audio errors
    }
}

// DOM elements
const boardElement = document.getElementById('board');
const timeElement = document.getElementById('time');
const scoreElement = document.getElementById('score');
const chainElement = document.getElementById('chain');
const maxChainElement = document.getElementById('maxChain');
const startButton = document.getElementById('startButton');
const shareButton = document.getElementById('shareButton');
const messageElement = document.getElementById('message');

// Overlay elements for onboarding and game over
const overlay = document.getElementById('overlay');
const playButton = document.getElementById('playButton');
const replayButton = document.getElementById('replayButton');
const shareButtonModal = document.getElementById('shareButtonModal');
const overlayTitle = document.getElementById('overlayTitle');
const overlayInstructions = document.getElementById('overlayInstructions');
const finalScoreDiv = document.getElementById('finalScore');

// Additional UI elements
const currentChainElement = document.getElementById('currentChain');
const timeBarContainer = document.getElementById('timeBarContainer');
const timeBar = document.getElementById('timeBar');
const bestScoreElement = document.getElementById('bestScore');
const bestChainElement = document.getElementById('bestChain');

// Cut-in overlay element
const breakCutIn = document.getElementById('breakCutIn');

/**
 * Reset the onboarding/game-over overlay to its initial "how to play" state.
 * This ensures that when the page is loaded or the game is restarted without a
 * user-initiated endGame() call, the overlay shows the tutorial rather than
 * lingering result text from a previous session.  It also resets which
 * buttons are visible.
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
 * Initialise a new board with random colours and render it.
 */
function initBoard() {
    board = [];
    for (let row = 0; row < ROWS; row++) {
        board[row] = [];
        for (let col = 0; col < COLS; col++) {
            const colour = COLOURS[Math.floor(Math.random() * COLOURS.length)];
            board[row][col] = colour;
        }
    }
    renderBoard(true);
}

/**
 * Render the board. If createElements is true, tile elements are created, otherwise
 * existing tile elements are updated.
 * @param {boolean} createElements
 */
function renderBoard(createElements = false) {
    if (createElements) {
        // Clear previous tiles
        boardElement.innerHTML = '';
        for (let row = 0; row < ROWS; row++) {
            for (let col = 0; col < COLS; col++) {
                const tile = document.createElement('div');
                tile.classList.add('tile');
                tile.dataset.row = row;
                tile.dataset.col = col;
                tile.classList.add(board[row][col]);
                boardElement.appendChild(tile);
            }
        }
    } else {
        // Update existing tile colours
        const tiles = boardElement.querySelectorAll('.tile');
        tiles.forEach(tile => {
            const row = parseInt(tile.dataset.row);
            const col = parseInt(tile.dataset.col);
            // Remove old colour classes
            COLOURS.forEach(colour => tile.classList.remove(colour));
            const colour = board[row][col];
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
 * Start a new game: reset variables, timer and board.
 */
function startGame() {
    // Reset state
    score = 0;
    chainCount = 1;
    maxChain = 0;
    turnCount = 0;
    updateScoreDisplay();
    chainElement.textContent = chainCount;
    maxChainElement.textContent = maxChain;
    messageElement.textContent = '';
    // hide share controls
    shareButton.style.display = 'none';
    boardElement.style.pointerEvents = 'auto';
    startButton.disabled = true;

    // Reset timer
    timeLeft = 60;
    maxTimeForBar = 60;
    timeElement.textContent = timeLeft;
    updateTimeBar();
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        timeLeft--;
        timeElement.textContent = timeLeft;
        updateTimeBar();
        if (timeLeft <= 0) {
            endGame();
        }
    }, 1000);

    // Initialise board
    initBoard();
    // Ensure the initial board has at least one available move
    if (!hasAvailableMoves()) {
        shuffleBoard();
    }
    // Hide overlay after starting
    if (!overlay.classList.contains('hidden')) {
        overlay.classList.add('hidden');
    }
}

/**
 * End the current game: stop timer and disable interactions.
 */
function endGame() {
    // Stop timer
    if (timerInterval) clearInterval(timerInterval);
    timeLeft = 0;
    timeElement.textContent = 0;
    boardElement.style.pointerEvents = 'none';
    startButton.disabled = false;
    // Show overlay with final results
    overlayTitle.textContent = '結果';
    overlayInstructions.style.display = 'none';
    finalScoreDiv.style.display = 'block';
    finalScoreDiv.textContent = `スコア: ${score} / 最長チェーン: ${maxChain}`;
    playButton.style.display = 'none';
    replayButton.style.display = 'block';
    shareButtonModal.style.display = 'block';
    overlay.classList.remove('hidden');
    // Attach share action
    shareButtonModal.onclick = () => shareResult();
}

/**
 * Update score display.
 */
function updateScoreDisplay() {
    scoreElement.textContent = score;
}

/**
 * Update the visual time bar based on remaining time. The bar's maximum
 * corresponds to maxTimeForBar; timeLeft is clamped between 0 and that value.
 */
function updateTimeBar() {
    const ratio = Math.max(0, Math.min(timeLeft / maxTimeForBar, 1));
    timeBar.style.width = (ratio * 100) + '%';
}

/**
 * Load best score and best chain from localStorage. If not present, defaults to 0.
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
 * Display a cut-in message at the center of the screen. The message will
 * animate in and out automatically. Accepts a string.
 * @param {string} text
 */
function showCutIn(text) {
    breakCutIn.textContent = text;
    breakCutIn.classList.remove('hidden');
    breakCutIn.classList.add('show');
    // Remove the animation class after it ends so it can be triggered again
    setTimeout(() => {
        breakCutIn.classList.remove('show');
        breakCutIn.classList.add('hidden');
    }, 1200);
}

/**
 * Begin selecting a path starting from the given tile.
 * @param {HTMLElement} tile
 */
function startSelection(tile) {
    if (timeLeft <= 0) return;
    isDrawing = true;
    selectedPath = [];
    currentColour = null;
    lastDirection = null;
    turnCount = 0;
    // Determine the tile's position
    const row = parseInt(tile.dataset.row);
    const col = parseInt(tile.dataset.col);
    currentColour = board[row][col];
    lastRow = row;
    lastCol = col;
    selectedPath.push(tile);
    tile.classList.add('selected');
    // Initialize current chain length display
    currentChainElement.textContent = selectedPath.length;
}

/**
 * Handle moving over a tile while selecting.
 * @param {HTMLElement} tile
 */
function handleEnter(tile) {
    if (!isDrawing) return;
    const row = parseInt(tile.dataset.row);
    const col = parseInt(tile.dataset.col);
    const colour = board[row][col];
    // Only allow same colour as current selection
    if (colour !== currentColour) return;
    // If already in path
    const index = selectedPath.indexOf(tile);
    if (index >= 0) {
        // Allow backtracking only to the previous cell
        if (index === selectedPath.length - 2) {
            const lastTile = selectedPath.pop();
            lastTile.classList.remove('selected');
            // Recompute last position and direction
            const newLast = selectedPath[selectedPath.length - 1];
            lastRow = parseInt(newLast.dataset.row);
            lastCol = parseInt(newLast.dataset.col);
            // Recompute direction and turn count
            updateTurnCount();
            // Update current chain length display
            currentChainElement.textContent = selectedPath.length;
        }
        return;
    }
    // Check adjacency
    const dr = Math.abs(row - lastRow);
    const dc = Math.abs(col - lastCol);
    if (dr + dc !== 1) return;
    // Update direction and turn count
    const dx = row - lastRow;
    const dy = col - lastCol;
    const dir = `${dx},${dy}`;
    if (lastDirection !== null && dir !== lastDirection) {
        turnCount++;
    }
    lastDirection = dir;
    lastRow = row;
    lastCol = col;
    selectedPath.push(tile);
    tile.classList.add('selected');
    // Update current chain length display
    currentChainElement.textContent = selectedPath.length;
}

/**
 * Recompute turn count after backtracking.
 * This iterates through the current selectedPath and recalculates how many times
 * direction changes.
 */
function updateTurnCount() {
    turnCount = 0;
    lastDirection = null;
    for (let i = 1; i < selectedPath.length; i++) {
        const prev = selectedPath[i - 1];
        const curr = selectedPath[i];
        const prevRow = parseInt(prev.dataset.row);
        const prevCol = parseInt(prev.dataset.col);
        const currRow = parseInt(curr.dataset.row);
        const currCol = parseInt(curr.dataset.col);
        const dx = currRow - prevRow;
        const dy = currCol - prevCol;
        const dir = `${dx},${dy}`;
        if (lastDirection !== null && dir !== lastDirection) {
            turnCount++;
        }
        lastDirection = dir;
    }
    // Update lastRow/lastCol to the end of the path
    const lastTile = selectedPath[selectedPath.length - 1];
    lastRow = parseInt(lastTile.dataset.row);
    lastCol = parseInt(lastTile.dataset.col);
}

/**
 * Finish selection: if path length >=3 remove the tiles, otherwise clear selection.
 */
function finishSelection() {
    if (!isDrawing) return;
    isDrawing = false;
    // If valid path
    if (selectedPath.length >= 3) {
        const pathLength = selectedPath.length;
        // Compute score
        const gained = calculateScore(pathLength, turnCount, chainCount);
        score += gained;
        updateScoreDisplay();
        // Play a sound effect when tiles are cleared
        playSound();
        // Add bonus time for long chains (5 or more)
        if (pathLength >= 5) {
            // For length 5 => +1s, length 6 => +2s, etc.
            const bonusTime = pathLength - 4;
            timeLeft += bonusTime;
            // Increase bar maximum if we exceed previous max
            if (timeLeft > maxTimeForBar) {
                maxTimeForBar = timeLeft;
            }
            // Update timer display and bar
            timeElement.textContent = timeLeft;
            updateTimeBar();
        }
        // Update max chain if needed
        if (pathLength > maxChain) {
            maxChain = pathLength;
            maxChainElement.textContent = maxChain;
        }
        // Update persistent best score and chain if beaten
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
        // Remove tiles from board with burst effect
        selectedPath.forEach(tile => {
            const r = parseInt(tile.dataset.row);
            const c = parseInt(tile.dataset.col);
            board[r][c] = null;
            tile.classList.remove('selected');
            // Add burst animation class
            tile.classList.add('burst');
            // After animation, hide the tile
            setTimeout(() => {
                tile.classList.remove('burst');
            }, 400);
        });
        // Brief delay before collapsing to give visual feedback of removal
        setTimeout(() => {
            // Collapse and refill
            collapseBoard();
            fillBoard();
            // After filling, ensure there are available moves; if not, shuffle
            if (!hasAvailableMoves()) {
                shuffleBoard();
            } else {
                renderBoard();
            }
            // Apply falling animation to all tiles
            applyFallAnimation();
            // Increase chain count and schedule reset
            chainCount++;
            chainElement.textContent = chainCount;
            if (chainTimeout) clearTimeout(chainTimeout);
            chainTimeout = setTimeout(() => {
                chainCount = 1;
                chainElement.textContent = chainCount;
            }, 2000);
        }, 150);
    } else {
        // Clear selection visuals
        selectedPath.forEach(tile => tile.classList.remove('selected'));
    }
    // Reset path variables
    selectedPath = [];
    currentColour = null;
    lastDirection = null;
    turnCount = 0;
    // Reset current chain length display
    currentChainElement.textContent = 0;
}

/**
 * Calculate score for a chain.
 * Long chains and sharp turns grant bonus points. The base points grow
 * quadratically with the path length. The current chain multiplier applies on top.
 * @param {number} length Length of the chain
 * @param {number} turns Number of turns in the chain
 * @param {number} multiplier Current chain multiplier
 * @returns {number} Points gained
 */
function calculateScore(length, turns, multiplier) {
    // Base points: quadratic growth encourages long chains
    const base = length * length * 10;
    // Turn bonus: each turn adds 15% of base
    const turnBonus = base * 0.15 * turns;
    const total = Math.round((base + turnBonus) * multiplier);
    return total;
}

/**
 * Collapse the board vertically: move tiles down to fill empty spaces.
 */
function collapseBoard() {
    for (let col = 0; col < COLS; col++) {
        let pointer = ROWS - 1;
        for (let row = ROWS - 1; row >= 0; row--) {
            if (board[row][col] !== null) {
                // Move down if necessary
                if (row !== pointer) {
                    board[pointer][col] = board[row][col];
                    board[row][col] = null;
                }
                pointer--;
            }
        }
    }
}

/**
 * Fill empty slots in the board with new random tiles.
 */
function fillBoard() {
    for (let row = 0; row < ROWS; row++) {
        for (let col = 0; col < COLS; col++) {
            if (board[row][col] === null) {
                board[row][col] = COLOURS[Math.floor(Math.random() * COLOURS.length)];
            }
        }
    }
}

/**
 * Apply a jelly-like bounce animation to all tiles currently on the board.
 * This is called after new tiles have fallen into place to enhance visual feedback.
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
 * Check if there is any available move on the current board. A move is available
 * if there exists a connected component (using 4-directional adjacency) of
 * at least 3 tiles of the same colour. This indicates the player could draw
 * a chain of length 3 or more.
 * @returns {boolean}
 */
function hasAvailableMoves() {
    const visited = Array.from({ length: ROWS }, () => Array(COLS).fill(false));
    const dirs = [ [1,0], [-1,0], [0,1], [0,-1] ];
    for (let row = 0; row < ROWS; row++) {
        for (let col = 0; col < COLS; col++) {
            if (visited[row][col]) continue;
            const colour = board[row][col];
            // BFS to get size of connected component
            let count = 0;
            const queue = [];
            queue.push([row, col]);
            visited[row][col] = true;
            while (queue.length > 0) {
                const [r, c] = queue.shift();
                count++;
                for (const [dr, dc] of dirs) {
                    const nr = r + dr;
                    const nc = c + dc;
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
 * Shuffle the board by generating new random colours until there is at least
 * one available move. Avoid reseeding colours that result in no available moves.
 */
function shuffleBoard() {
    let attempts = 0;
    do {
        // fill board with random colours
        for (let row = 0; row < ROWS; row++) {
            for (let col = 0; col < COLS; col++) {
                board[row][col] = COLOURS[Math.floor(Math.random() * COLOURS.length)];
            }
        }
        attempts++;
        // Safety: avoid infinite loop by limiting attempts
        if (attempts > 50) {
            break;
        }
    } while (!hasAvailableMoves());
    renderBoard();
    // Apply falling animation after shuffle to emphasise refresh
    applyFallAnimation();
    // Show cut-in message in the centre
    showCutIn('BREAK');
}

/**
 * Copy result string to clipboard and open Twitter share URL.
 */
function shareResult() {
    const result = `ColorChainで遊んだよ！\nスコア: ${score} / 最長チェーン: ${maxChain}`;
    // Copy to clipboard
    navigator.clipboard.writeText(result).catch(() => {});
    // Optionally open Twitter share
    const tweetUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(result)}`;
    window.open(tweetUrl, '_blank');
}

// Attach event listeners
boardElement.addEventListener('pointerdown', e => {
    const tile = e.target.closest('.tile');
    if (!tile) return;
    startSelection(tile);
});
boardElement.addEventListener('pointerover', e => {
    const tile = e.target.closest('.tile');
    if (!tile) return;
    handleEnter(tile);
});
// Listen on pointerup on the whole document so releasing outside board still finishes
document.addEventListener('pointerup', finishSelection);

// Start button listener
startButton.addEventListener('click', startGame);

// Overlay buttons listeners
playButton.addEventListener('click', () => {
    // Reset overlay for playing state
    overlayTitle.textContent = '遊び方';
    overlayInstructions.style.display = 'block';
    finalScoreDiv.style.display = 'none';
    shareButtonModal.style.display = 'none';
    replayButton.style.display = 'none';
    startGame();
});

replayButton.addEventListener('click', () => {
    // Hide overlay and start new game
    overlayTitle.textContent = '遊び方';
    overlayInstructions.style.display = 'block';
    finalScoreDiv.style.display = 'none';
    shareButtonModal.style.display = 'none';
    replayButton.style.display = 'none';
    startGame();
});

// Prevent context menu on long press for better mobile experience
document.addEventListener('contextmenu', e => e.preventDefault());

// Initialise an empty board initially
// Load persistent best stats
loadBestStats();
// Initialise an empty board initially
initBoard();
// Disable interactions until game starts
boardElement.style.pointerEvents = 'none';
// Reset the overlay to the onboarding state so the user sees instructions on load
resetOverlay();
// Ensure overlay is visible on initial load
if (overlay.classList.contains('hidden')) {
    overlay.classList.remove('hidden');
}