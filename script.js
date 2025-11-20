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

// Colour values for particle and ripple effects. These roughly correspond to the gradient colours used
// on the tiles but with fixed opacity. The values are used to derive particle and ripple
// colours when tiles burst.
const COLOUR_VALUES = {
    red:    { r: 231, g: 76,  b: 60,  ripple: 'rgba(231,76,60,0.5)' },
    blue:   { r: 52,  g: 152, b: 219, ripple: 'rgba(52,152,219,0.5)' },
    yellow: { r: 241, g: 196, b: 15,  ripple: 'rgba(241,196,15,0.5)' },
    green:  { r: 46,  g: 204, b: 113, ripple: 'rgba(46,204,113,0.5)' },
    purple: { r: 155, g: 89,  b: 182, ripple: 'rgba(155,89,182,0.5)' }
};

/**
 * Update glow intensity for the current selection.  The glow intensity and size grow
 * with the length of the selected path to emphasise longer chains.  This function
 * applies a dynamic box-shadow to each selected tile based on the current path length.
 */
function updateSelectionGlow() {
    const n = selectedPath.length;
    // Early exit if no tiles
    if (n === 0) return;
    // Compute an intensity ratio capped at 1
    const intensity = Math.min(1, 0.35 + n * 0.08);
    const spread = 2 + n * 2; // outer spread for shadow
    const blur = 4 + n * 4;   // blur radius grows with chain length
    // For each tile in selection, update style
    selectedPath.forEach(tile => {
        // Use a blue glow consistent with default selected style but scale intensity
        tile.style.boxShadow = `0 0 ${blur}px ${spread}px rgba(100, 180, 255, ${intensity.toFixed(2)})`;
    });
}

/**
 * Clear dynamic glow from all tiles in the current selection.  This resets the
 * box-shadow style applied by updateSelectionGlow().  Should be called when
 * finishing or cancelling a selection.
 */
function clearSelectionGlow() {
    selectedPath.forEach(tile => {
        tile.style.boxShadow = '';
    });
}

/**
 * Spawn particle and ripple effects at a tile's position.  This function creates
 * temporary DOM elements positioned over the target tile that animate outward
 * and then remove themselves.  The colours are derived from the tile's colour class.
 * @param {HTMLElement} tileElement The tile DOM element.
 * @param {string} colourName The colour class of the tile (e.g. 'red').
 */
function spawnEffectsAtTile(tileElement, colourName) {
    // Ensure colour data exists
    const colour = COLOUR_VALUES[colourName];
    if (!colour) return;
    // Determine position relative to board
    const boardRect = boardElement.getBoundingClientRect();
    const tileRect = tileElement.getBoundingClientRect();
    // Compute offsets relative to board's content area. Subtract board's padding so effects align
    const computed = window.getComputedStyle(boardElement);
    const paddingX = parseFloat(computed.paddingLeft);
    const paddingY = parseFloat(computed.paddingTop);
    const x = tileRect.left - boardRect.left - paddingX;
    const y = tileRect.top - boardRect.top - paddingY;
    // Create effect container
    const container = document.createElement('div');
    container.className = 'effect-container';
    container.style.position = 'absolute';
    container.style.pointerEvents = 'none';
    container.style.left = `${x}px`;
    container.style.top = `${y}px`;
    container.style.width = `${tileRect.width}px`;
    container.style.height = `${tileRect.height}px`;
    container.style.zIndex = 200;
    // Generate particles
    const particleCount = 8;
    for (let i = 0; i < particleCount; i++) {
        const p = document.createElement('span');
        p.className = 'particle';
        // Random direction offsets within a range relative to tile size
        const angle = Math.random() * 2 * Math.PI;
        const distance = Math.random() * 0.6 + 0.4; // between 0.4 and 1.0 times tile size
        const dx = Math.cos(angle) * distance * tileRect.width;
        const dy = Math.sin(angle) * distance * tileRect.height;
        p.style.setProperty('--dx', `${dx.toFixed(1)}px`);
        p.style.setProperty('--dy', `${dy.toFixed(1)}px`);
        // Particle colour: use light version of tile colour
        p.style.backgroundColor = `rgba(${colour.r}, ${colour.g}, ${colour.b}, 0.8)`;
        container.appendChild(p);
    }
    // Create ripple element
    const ripple = document.createElement('span');
    ripple.className = 'ripple';
    ripple.style.backgroundColor = colour.ripple;
    container.appendChild(ripple);
    // Append container to board
    boardElement.appendChild(container);
    // Remove after animation completes
    setTimeout(() => {
        container.remove();
    }, 600);
}

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

// Global ranking container (displayed at game end)
const globalRankingElement = document.getElementById('globalRanking');

// -----------------------------------------------------------------------------
// Firebase initialisation
//
// To enable cloud saving and leaderboard functionality, we initialise the
// Firebase application and Firestore database. Replace the placeholder
// configuration below with your own Firebase project credentials. You can find
// these values in your Firebase console under Project settings.
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_AUTH_DOMAIN",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_STORAGE_BUCKET",
    messagingSenderId: "YOUR_SENDER_ID",
    appId: "YOUR_APP_ID"
};

// Only initialise Firebase if the firebase object is available (scripts loaded)
let db;
if (typeof firebase !== 'undefined' && firebase && firebase.initializeApp) {
    try {
        firebase.initializeApp(firebaseConfig);
        db = firebase.firestore();
    } catch (e) {
        console.warn('Firebase initialisation failed. Leaderboard will be disabled.', e);
    }
} else {
    console.warn('Firebase SDK not loaded. Leaderboard will be disabled.');
}

/**
 * Submit the player's score and max chain to Firestore. If Firebase is not
 * initialised or unavailable, this function silently fails. Player name is
 * stored in localStorage under the key `colorchain-playerName`. If no name is
 * stored, "Anonymous" is used.
 *
 * @param {number} scoreVal The final score to submit.
 * @param {number} chainVal The highest chain achieved in the run.
 */
async function submitGlobalScore(scoreVal, chainVal) {
    if (!db) return;
    const name = localStorage.getItem('colorchain-playerName') || 'Anonymous';
    try {
        await db.collection('colorchain_scores').add({
            name: name,
            score: scoreVal,
            maxChain: chainVal,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
    } catch (err) {
        console.error('Error submitting score:', err);
    }
}

/**
 * Load the top players from Firestore ordered by score descending. Returns an
 * array of objects containing name, score and maxChain. Limits to a default
 * number of entries (5). Returns an empty array if Firestore is unavailable.
 *
 * @param {number} limit The maximum number of entries to retrieve. Defaults to 5.
 * @returns {Promise<Array<{name: string, score: number, maxChain: number}>>}
 */
async function loadGlobalRanking(limit = 5) {
    if (!db) return [];
    try {
        const snapshot = await db.collection('colorchain_scores')
            .orderBy('score', 'desc')
            .limit(limit)
            .get();
        const list = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            list.push({
                name: data.name || 'Anonymous',
                score: data.score || 0,
                maxChain: data.maxChain || 0
            });
        });
        return list;
    } catch (err) {
        console.error('Error loading ranking:', err);
        return [];
    }
}

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
    // hide global ranking panel on new game start
    if (globalRankingElement) {
        globalRankingElement.style.display = 'none';
        globalRankingElement.innerHTML = '';
    }
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

    // Submit score to global leaderboard and load ranking
    submitGlobalScore(score, maxChain);
    loadGlobalRanking(5).then(list => {
        if (!globalRankingElement) return;
        globalRankingElement.innerHTML = '';
        if (list.length > 0) {
            const heading = document.createElement('div');
            heading.textContent = 'グローバルランキング';
            heading.style.fontWeight = 'bold';
            heading.style.marginBottom = '4px';
            globalRankingElement.appendChild(heading);
            list.forEach((entry, index) => {
                const line = document.createElement('div');
                line.textContent = `${index + 1}. ${entry.name} - スコア ${entry.score} / チェーン ${entry.maxChain}`;
                globalRankingElement.appendChild(line);
            });
            globalRankingElement.style.display = 'block';
        } else {
            globalRankingElement.style.display = 'none';
        }
    });
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
    // hide global ranking container
    if (globalRankingElement) globalRankingElement.style.display = 'none';
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
    // Update glow intensity for the first tile selection
    updateSelectionGlow();
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
            lastTile.style.boxShadow = '';
            updateTurnCount();
            currentChainElement.textContent = selectedPath.length;
            // Update glow intensity after backtracking
            updateSelectionGlow();
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
    // Update glow intensity for the selection path
    updateSelectionGlow();
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
    // Clear any dynamic glow styles from currently selected tiles
    clearSelectionGlow();
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
            // Determine the colour name before removing from board
            const colName = board[rr][cc];
            // Remove tile from game state
            board[rr][cc] = null;
            // Remove selection class and dynamic glow
            tile.classList.remove('selected');
            tile.style.boxShadow = '';
            // Add burst animation class for scale/opacity animation
            tile.classList.add('burst');
            // Spawn particle and ripple effects at this tile
            spawnEffectsAtTile(tile, colName);
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

// Prompt the player for a name on first load if none is set.  This name will
// appear in the global leaderboard.  Stored in localStorage to persist
// between sessions.  The prompt appears only once.
(() => {
    try {
        const key = 'colorchain-playerName';
        const existing = localStorage.getItem(key);
        if (!existing) {
            const name = prompt('プレイヤー名を入力してください（ランキングに表示されます）:', '');
            if (name && name.trim().length > 0) {
                localStorage.setItem(key, name.trim());
            } else {
                localStorage.setItem(key, 'Anonymous');
            }
        }
    } catch (_) {
        // ignore errors (e.g., prompt blocked)
    }
})();