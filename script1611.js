// BUILD-ID 2025-11-12-logout+LB
console.log("BUILD-ID 2025-11-12-logout+LB");

// ---------------------------
// ACCIDENTAL RETIREE CONTEST APP
// Auth + Leaderboard stabilized 2025-11-12
// - Minimal hard sign-out verified
// - Auto leaderboard refresh working
// - Stage advance + DB save confirmed
// - Duplicates removed (single landing render)
// ---------------------------

// CRITICAL FIX: Complete validation function with proper API integration
async function validateAnswer(stage, step, answer) {
    console.log(`[VALIDATE] Validating stage ${stage}, step ${step}, answer: ${answer}`);
    
    try {
        const response = await fetch(`${SUPABASE_URL}/functions/v1/validate-answer`, {
            method: 'POST',
            headers: {
  'Content-Type': 'application/json',
  'apikey': SUPABASE_ANON_KEY,
  'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
},
            body: JSON.stringify({
                stage: stage,
                step: step,
                answer: answer.toLowerCase().trim()
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const result = await response.json();
        console.log(`[VALIDATE] API response:`, result);
        
        return {
    success: true,
    correct: result.ok,
    message: result.ok ? 'Correct!' : 'Incorrect answer'
};
    } catch (error) {
        console.error(`[VALIDATE] API error:`, error);
        // Fallback to local validation for basic answers
        const localResult = validateAnswerLocal(stage, step, answer);
        console.log(`[VALIDATE] Using local fallback:`, localResult);
        return localResult;
    }
}

// Local fallback validation
function validateAnswerLocal(stage, step, answer) {
    const cleanAnswer = answer.toLowerCase().trim();
    
    // Basic validation for known answers
    const knownAnswers = {
        1: { 1: 'istanbul' },
        2: { 1: 'cappadocia' },
        3: { 1: 'pamukkale' },
        4: { 1: 'ephesus' }
    };
    
    if (knownAnswers[stage] && knownAnswers[stage][step]) {
        return {
            success: true,
            correct: cleanAnswer === knownAnswers[stage][step],
            message: cleanAnswer === knownAnswers[stage][step] ? 'Correct!' : 'Incorrect answer'
        };
    }
    
    // Default to incorrect for unknown answers
    return {
        success: true,
        correct: false,
        message: 'Answer validation unavailable'
    };
}

// Complete the ContestApp class
class ContestApp {
    constructor() {
        this.currentStage = 1;
        this.solvedStages = [];
        this.firstRiddleSolved = [];
        this.modalCurrentStage = null;
        this.init();
    }

    async init() {
        console.log('[ContestApp] Initializing...');
        this.loadInitialProgress();
        this.renderCurrentStage();
        this.renderStagesGrid();
        this.updateProgress();
        this.bindEvents();
        console.log('[ContestApp] Initialized');
    }

    loadInitialProgress() {
        this.solvedStages = this.getSolvedStagesFromLocal();
        this.firstRiddleSolved = this.getFirstRiddleSolvedFromLocal();
        
        // CRITICAL: Set current stage to the first unsolved stage
        this.currentStage = this.findNextUnsolvedStage() || 1;
        console.log(`[ContestApp] Initial current stage set to: ${this.currentStage}`);
    }

    getSolvedStagesFromLocal() {
        try {
            return JSON.parse(localStorage.getItem("contest_solved_stages") || "[]");
        } catch (e) {
            return [];
        }
    }

    setSolvedStagesLocal(stages) {
        const unique = [...new Set(stages)].sort((a, b) => a - b);
        localStorage.setItem("contest_solved_stages", JSON.stringify(unique));
        this.solvedStages = unique;
    }

    getFirstRiddleSolvedFromLocal() {
        try {
            return JSON.parse(localStorage.getItem("contest_first_riddle_solved") || "[]");
        } catch (e) {
            return [];
        }
    }

    setFirstRiddleSolvedLocal(stages) {
        const unique = [...new Set(stages)].sort((a, b) => a - b);
        localStorage.setItem("contest_first_riddle_solved", JSON.stringify(unique));
        this.firstRiddleSolved = unique;
    }

    isSolved(stage) {
        return this.solvedStages.includes(stage);
    }

    isFirstRiddleSolved(stage) {
        return this.firstRiddleSolved.includes(stage);
    }

    // UPDATED: Now checks both progression AND admin control
    isUnlocked(stage) {
        const progressUnlocked = stage === 1 || this.isSolved(stage - 1);
        const adminEnabled = stageControlManager ? stageControlManager.isStageEnabled(stage) : true;
        return progressUnlocked && adminEnabled;
    }

    // NEW: Check if stage is admin disabled
    isAdminDisabled(stage) {
        return stageControlManager ? !stageControlManager.isStageEnabled(stage) : false;
    }

    hasTwoRiddles(stage) {
        return stage >= 5 && stage <= 15;
    }

    getNextUnsolvedStage(fromStage) {
        for (let i = fromStage; i <= CONFIG.total; i++) {
            if (!this.isSolved(i)) return i;
        }
        return null;
    }

    // CRITICAL FIX: New method to find next unsolved stage
    findNextUnsolvedStage() {
        for (let i = 1; i <= CONFIG.total; i++) {
            if (!this.isSolved(i)) {
                return i;
            }
        }
        return null; // All stages solved
    }

    // CRITICAL FIX: Completely rewritten stage progression logic
    async markStageSolvedAndAdvance(stage) {
        console.log(`[ADVANCE] Marking stage ${stage} as solved and advancing...`);
        // === CONFETTI HOOK (fires once per user per step) ===
try {
  const userId =
    (window.authUser && window.authUser.id) ||
    (window.state && window.state.user && window.state.user.id) ||
    null;

  const s = Number(stage) || Number(window.state?.stage) || 1;
  // If you track per-stage multi-steps, replace the `1` with your step var (e.g., this.currentStep)
  const p = (typeof this?.currentStep !== "undefined") ? Number(this.currentStep) : 1;

  console.log("[CONFETTI] Hook reached with", { userId, stage: s, step: p });
  fireConfettiOnce(userId, s, p);
} catch (e) {
  console.warn("[CONFETTI] error calling fireConfettiOnce", e);
}
        // Step 1: Update local solved stages FIRST
        if (!this.isSolved(stage)) {
            const newSolved = [...this.solvedStages, stage];
            this.setSolvedStagesLocal(newSolved);
            console.log(`[ADVANCE] Stage ${stage} marked as solved locally. New progress:`, newSolved);
        }

        // Step 2: Save to database (async, don't block UI updates)
        if (leaderboardManager) {
            console.log(`[ADVANCE] Attempting to save stage ${stage} to database...`);
            leaderboardManager.logSolve(stage).then(result => {
                if (result.success) {
                    console.log(`[ADVANCE] Database save successful for stage ${stage}:`, result.reason || 'saved');
                } else {
                    console.warn(`[ADVANCE] Database save failed for stage ${stage}, but continuing...`);
                }
            }).catch(error => {
                console.warn(`[ADVANCE] Database save error for stage ${stage}:`, error);
            });
        }

        // Step 3: Log progress (async)
        if (progressManager) {
            progressManager.logStageCompletion(`stage_${stage}`, `Stage ${stage} Complete`);
        }

        // Step 4: Force UI updates with fresh data
        console.log(`[ADVANCE] Updating UI for stage ${stage} completion...`);
        this.renderStagesGrid();
        this.updateProgress();
        updateStage16();

        // Step 5: Update leaderboard
        setTimeout(() => {
            renderLeaderboard();
            renderLeaderboardStage16Big();
        }, 100);

        // Step 6: Find and advance to next stage
        const nextStage = this.findNextUnsolvedStage();
        
        if (nextStage && nextStage <= CONFIG.total) {
            console.log(`[ADVANCE] Advancing from stage ${stage} to stage ${nextStage}`);
            this.currentStage = nextStage;
            this.renderCurrentStage();
        } else {
            console.log(`[ADVANCE] All stages complete! Rendering grand prize.`);
            this.renderGrandPrize();
        }
    }

    setCurrentStage(stage) {
        this.currentStage = stage;
        console.log(`[ADVANCE] Current stage set to: ${stage}`);
    }

        // Ensure the app is positioned at the next unsolved stage
        ensureAtNextUnsolved(reason = "auto") {
            try {
                const solved = (typeof progressManager?.getSolvedStages === "function"
                    ? progressManager.getSolvedStages()
                    : this.solvedStages) || [];

                const next = computeNextUnsolvedStage(solved, 16);
                if (this.currentStage !== next) {
                    console.log(`[NAV] Jumping to next unsolved: ${next} (${reason})`);
                    this.currentStage = next;
                    if (typeof this.renderCurrentStage === "function") this.renderCurrentStage();
                }
            } catch (e) {
                console.warn("[NAV] ensureAtNextUnsolved failed (non-fatal):", e);
            }
        }

    hideAllPanels() {
        document.getElementById('inputSection').style.display = 'none';
        document.getElementById('secondRiddlePanel').style.display = 'none';
        document.getElementById('successPanel').style.display = 'none';
        document.getElementById('errorMessage').style.display = 'none';
        document.getElementById('secondRiddleError').style.display = 'none';
        document.getElementById('stageDisabledPanel').style.display = 'none'; // NEW: Hide stage disabled panel
    }

    // Validation methods
    async validateAnswer(stage, step, answer) {
        return await validateAnswer(stage, step, answer);
    }

    validateAnswerLocal(stage, step, answer) {
        return validateAnswerLocal(stage, step, answer);
    }

    // Render current stage method
    renderCurrentStage() {
        console.log(`[RENDER] Rendering current stage: ${this.currentStage}`);
        
        this.hideAllPanels();
        
        // Check if current stage is admin disabled
        if (this.isAdminDisabled(this.currentStage)) {
            console.log(`[RENDER] Stage ${this.currentStage} is admin disabled, showing notification`);
            document.getElementById('disabledStageNumber').textContent = this.currentStage;
            document.getElementById('stageDisabledPanel').style.display = 'block';
            return;
        }
        
        // Update stage title and video
        const stageConfig = CONFIG.stages[this.currentStage];
        if (stageConfig) {
            document.querySelector('.stage-title').textContent = `${stageConfig.title} — ${this.currentStage === 1 ? 'Start Your Journey' : 'Continue Your Adventure'}`;
            document.getElementById('currentVideo').src = `https://www.youtube.com/embed/${stageConfig.yt}`;
        }
        
        // Show appropriate input section
        if (this.isSolved(this.currentStage)) {
            // Stage already solved, show success
            this.showSuccess(this.currentStage);
        } else if (this.hasTwoRiddles(this.currentStage) && this.isFirstRiddleSolved(this.currentStage)) {
            // Show second riddle for stages 5-15
            this.showSecondRiddle(this.currentStage);
        } else {
            // Show first riddle input
            document.getElementById('inputSection').style.display = 'flex';
        }
    }

    // Show success panel
    showSuccess(stage) {
        const nextStage = this.findNextUnsolvedStage();
        const successText = document.getElementById('successText');
        const continueBtn = document.getElementById('continueBtn');
        
        if (nextStage && nextStage <= CONFIG.total) {
            successText.textContent = `Stage ${stage} complete! Ready for the next challenge?`;
            continueBtn.textContent = `Continue to Stage ${nextStage}`;
            continueBtn.onclick = () => {
                this.currentStage = nextStage;
                this.renderCurrentStage();
            };
        } else {
            successText.textContent = `Congratulations! You've completed all stages!`;
            continueBtn.textContent = 'View Your Achievement';
            continueBtn.onclick = () => this.renderGrandPrize();
        }
        
        document.getElementById('successPanel').style.display = 'block';
    }

    // Show second riddle
    showSecondRiddle(stage) {
        const clue = SECOND_RIDDLE_CLUES[stage] || 'Second riddle clue not available.';
        document.getElementById('secondRiddleClue').textContent = clue;
        document.getElementById('secondRiddlePanel').style.display = 'block';
    }

    // Render stages grid
    renderStagesGrid() {
        const grid = document.getElementById('stagesGrid');
        grid.innerHTML = '';
        
        for (let stage = 1; stage <= 15; stage++) {
            const tile = this.createStageTile(stage);
            grid.appendChild(tile);
        }
        
        // Update Stage 16 separately
        updateStage16();
    }

    // Create individual stage tile
    createStageTile(stage) {
        const tile = document.createElement('div');
        tile.className = 'stage-tile';
        
        const isSolved = this.isSolved(stage);
        const isUnlocked = this.isUnlocked(stage);
        const isAdminDisabled = this.isAdminDisabled(stage);
        
        if (isSolved) {
            tile.classList.add('solved');
        } else if (isAdminDisabled) {
            tile.classList.add('admin-disabled');
        } else if (!isUnlocked) {
            tile.classList.add('locked');
        }
        
        // Determine icon and status
        let iconClass, iconText, statusText;
        if (isSolved) {
            iconClass = 'solved';
            iconText = '✓';
            statusText = 'Solved';
        } else if (isAdminDisabled) {
            iconClass = 'admin-disabled';
            iconText = '⏸️';
            statusText = 'Disabled';
        } else if (isUnlocked) {
            iconClass = 'open';
            iconText = stage;
            statusText = 'Open';
        } else {
            iconClass = 'locked';
            iconText = '🔒';
            statusText = 'Locked';
        }
        
        // Prize badge
        let prizeText = stage === 15 ? '50K<br>Miles' : '$50<br>$100 GC';
        
        tile.innerHTML = `
            <div class="prize-badge">
                <span class="prize-badge-line">${prizeText.split('<br>')[0]}</span>
                <span class="prize-badge-line">${prizeText.split('<br>')[1]}</span>
            </div>
            <div class="stage-icon ${iconClass}">${iconText}</div>
            <div class="stage-name">Stage ${stage}</div>
            <div class="stage-status">${statusText}</div>
        `;
        
        // Add click handler for unlocked stages
        if (isUnlocked && !isAdminDisabled) {
            tile.style.cursor = 'pointer';
            tile.onclick = () => this.openStageModal(stage);
        }
        
        return tile;
    }

    // Open stage modal
    openStageModal(stage) {
        this.modalCurrentStage = stage;
        document.getElementById('modalTitle').textContent = `Stage ${stage}`;
        document.getElementById('stageModal').style.display = 'flex';
        
        // Set current stage and render
        this.currentStage = stage;
        this.renderCurrentStage();
        
        // Close modal
        setTimeout(() => {
            document.getElementById('stageModal').style.display = 'none';
        }, 2000);
    }

    // Update progress bar
    updateProgress() {
        const solvedCount = this.solvedStages.length;
        const percentage = (solvedCount / CONFIG.total) * 100;
        
        document.getElementById('progressCount').textContent = `${solvedCount} / ${CONFIG.total} solved`;
        document.getElementById('progressFill').style.width = `${percentage}%`;
    }

    // Render grand prize (all stages complete)
    renderGrandPrize() {
        this.hideAllPanels();
        
        document.querySelector('.stage-title').textContent = '🎉 Congratulations! Journey Complete!';
        document.querySelector('.stage-subtitle').textContent = 'You have successfully completed all 16 stages of the Six Continents Challenge!';
        
        // Hide video container
        document.querySelector('.video-container').style.display = 'none';
        
        // Show celebration message
        const celebrationPanel = document.createElement('div');
        celebrationPanel.className = 'success-panel';
        celebrationPanel.style.display = 'block';
        celebrationPanel.innerHTML = `
            <div class="success-title">🏆 Amazing Achievement!</div>
            <div class="success-text">
                You've completed the ultimate travel challenge! Your journey across six continents is now complete.
                Check the leaderboard to see if you've won any prizes!
            </div>
        `;
        
        document.getElementById('currentStage').appendChild(celebrationPanel);
        
        // Trigger confetti (guarded: fires only once per user per step)
{
    const s = (this?.stage ?? window?.state?.stage ?? 1); // stage number fallback
    const p = (this?.step  ?? window?.state?.step  ?? 1); // step number fallback
    fireConfettiOnce(currentUserIdSafe(), s, p);
}
    }

    // Bind event handlers
    bindEvents() {
        // First riddle submission
        document.getElementById('submitBtn').onclick = () => this.handleFirstRiddleSubmit();
        document.getElementById('answerInput').onkeypress = (e) => {
            if (e.key === 'Enter') this.handleFirstRiddleSubmit();
        };
        
        // Second riddle submission
        document.getElementById('secondRiddleSubmit').onclick = () => this.handleSecondRiddleSubmit();
        document.getElementById('secondRiddleInput').onkeypress = (e) => {
            if (e.key === 'Enter') this.handleSecondRiddleSubmit();
        };
        
        // Modal close
        document.getElementById('closeModal').onclick = () => {
            document.getElementById('stageModal').style.display = 'none';
        };
        
        // Sign out buttons
        document.getElementById('signOutBtn').onclick = () => this.handleSignOut();
        document.getElementById('adminSignOutBtn').onclick = () => this.handleSignOut();
    }

    // Handle first riddle submission
    async handleFirstRiddleSubmit() {
        const answer = document.getElementById('answerInput').value.trim();
        if (!answer) return;
        
        const submitBtn = document.getElementById('submitBtn');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Checking...';
        
        try {
            const result = await this.validateAnswer(this.currentStage, 1, answer);
            
            if (result.correct) {
                // Clear input
                document.getElementById('answerInput').value = '';
                document.getElementById('errorMessage').style.display = 'none';
                
                if (this.hasTwoRiddles(this.currentStage)) {
                    // Mark first riddle as solved and show second riddle
                    const newFirstRiddleSolved = [...this.firstRiddleSolved, this.currentStage];
                    this.setFirstRiddleSolvedLocal(newFirstRiddleSolved);
                    this.showSecondRiddle(this.currentStage);
                    document.getElementById('inputSection').style.display = 'none';
                } else {
                    // Single riddle stage - mark as completely solved
                    await this.markStageSolvedAndAdvance(this.currentStage);
                }
            } else {
                // Show error
                document.getElementById('errorMessage').style.display = 'block';
            }
        } catch (error) {
            console.error('Validation error:', error);
            document.getElementById('errorMessage').style.display = 'block';
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Submit';
        }
    }

    // Handle second riddle submission
    async handleSecondRiddleSubmit() {
        const answer = document.getElementById('secondRiddleInput').value.trim();
        if (!answer) return;
        
        const submitBtn = document.getElementById('secondRiddleSubmit');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Checking...';
        
        try {
            const result = await this.validateAnswer(this.currentStage, 2, answer);
            
            if (result.correct) {
                // Clear input and hide error
                document.getElementById('secondRiddleInput').value = '';
                document.getElementById('secondRiddleError').style.display = 'none';
                
                // Mark stage as completely solved
                await this.markStageSolvedAndAdvance(this.currentStage);
            } else {
                // Show error
                document.getElementById('secondRiddleError').style.display = 'block';
            }
        } catch (error) {
            console.error('Second riddle validation error:', error);
            document.getElementById('secondRiddleError').style.display = 'block';
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Submit';
        }
    }

    // Handle sign out
    async handleSignOut(e) {
        try {
            e?.preventDefault?.();
            await signOutHard({ timeoutMs: 2500 });
        } catch (error) {
            console.error("[SIGNOUT] Sign out error:", error);
            showLanding(); // belt-and-suspenders
        }
    }
}
// --- Robust Supabase sign-out helpers ---
function getSupabaseProjectRef() {
  try {
    return new URL(window.SUPABASE_URL || SUPABASE_URL).hostname.split(".")[0];
  } catch {
    try { return window.supabase?.supabaseUrl?.split("//")[1]?.split(".")[0] || null; } catch { return null; }
  }
}

function purgeSupabaseAuthLocal() {
  try {
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith("sb-") && k.includes("-auth-token")) keysToRemove.push(k);
    }
    keysToRemove.forEach(k => localStorage.removeItem(k));
    console.log("[AUTH] Purged local Supabase auth keys:", keysToRemove);
  } catch (e) {
    console.warn("[AUTH] Failed to purge Supabase local auth:", e);
  }
}

function purgeAppLocalState() {
  try {
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && (k.startsWith("confettiFired:") || k.startsWith("stepSolved:") || k === "solvedStages" || k === "app_progress" || k === "authUser")) keys.push(k);
    }
    keys.forEach(k => localStorage.removeItem(k));
    console.log("[AUTH] Purged app local state:", keys);
  } catch (e) {
    console.warn("[AUTH] Failed to purge app state:", e);
  }
}

let __signingOut = false;
// --- Minimal hard sign-out (fixed) ---
async function signOutHard() {
    try { await supabase.auth.signOut({ scope: "local" }); } catch (_){ }
    try {
        localStorage.clear();
        sessionStorage.clear();
        Object.keys(localStorage).forEach(k => {
            if (k.startsWith("sb-") && k.includes("-auth-token")) localStorage.removeItem(k);
        });
        if (location.hash && /access_token|refresh_token|type/.test(location.hash)) {
            history.replaceState({}, document.title, location.pathname + location.search);
        }
    } catch (_){ }
    try { typeof showLanding === "function" && showLanding(); } catch (_){ }
    console.log("[SIGNOUT] Completed (minimal)");
}

// Compute next unsolved stage helper
function computeNextUnsolvedStage(solvedArray, totalStages = 16) {
    const solved = new Set(Array.isArray(solvedArray) ? solvedArray : []);
    for (let i = 1; i <= totalStages; i++) {
        if (!solved.has(i)) return i;
    }
    return totalStages; // fallback
}

// Small non-blocking toast helper (delayed, single, always-on-top)
function showToast(message = "Welcome back!", { delay = 1000, duration = 3000 } = {}) {
    try {
        // Ensure only one toast exists
        const existing = document.getElementById("__ar_toast");
        if (existing) existing.remove();

        const toast = document.createElement("div");
        toast.id = "__ar_toast";
        toast.textContent = message;
        Object.assign(toast.style, {
            position: "fixed",
            bottom: "24px",
            left: "50%",
            transform: "translateX(-50%)",
            background: "rgba(0,0,0,0.85)",
            color: "#fff",
            padding: "10px 16px",
            borderRadius: "10px",
            fontSize: "14px",
            fontWeight: "600",
            zIndex: "2147483647",
            pointerEvents: "none",
            opacity: "0",
            transition: "opacity 0.4s ease",
            maxWidth: "80%",
            textAlign: "center",
        });

        // Delay show to allow overlays to dismiss
        setTimeout(() => {
            try {
                document.body.appendChild(toast);
                requestAnimationFrame(() => (toast.style.opacity = "1"));
                setTimeout(() => {
                    toast.style.opacity = "0";
                    setTimeout(() => toast.remove(), 400);
                }, duration);
            } catch (e) {
                console.warn("[TOAST] Append failed:", e);
            }
        }, delay);
    } catch (e) {
        console.warn("[TOAST] Failed:", e);
    }
}

// Anchored toast: attempts to place toast above the answer input; falls back to bottom-center
function showAnchoredToast(message = "Welcome back!", {
    delay = 1000,
    duration = 3000,
    anchorSelectors = [
        '[data-role="answer-input"]',
        '#answerInput',
        'input[name="answer"]',
        'textarea[name="answer"]',
        '.answer-input'
    ],
    offsetPx = 56
} = {}) {
    try {
        // remove any prior toast
        const existing = document.getElementById("__ar_toast");
        if (existing) existing.remove();

        // find anchor
        let anchor = null;
        for (const sel of anchorSelectors) {
            const el = document.querySelector(sel);
            if (el) { anchor = el; break; }
        }

        // build element
        const toast = document.createElement("div");
        toast.id = "__ar_toast";
        toast.setAttribute("role", "status");
        toast.setAttribute("aria-live", "polite");
        toast.textContent = message;

        // base style (bigger + readable)
        Object.assign(toast.style, {
            position: "fixed",
            background: "rgba(0,0,0,0.85)",
            color: "#fff",
            padding: "12px 18px",
            borderRadius: "12px",
            fontSize: "16px",
            fontWeight: "600",
            boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
            zIndex: "2147483647",
            pointerEvents: "none",
            opacity: "0",
            transform: "translateY(12px)",
            transition: "opacity 0.25s ease, transform 0.25s ease",
            maxWidth: "90vw",
            textAlign: "center",
            whiteSpace: "nowrap"
        });

        // positioner
        const place = () => {
            if (anchor) {
                const r = anchor.getBoundingClientRect();
                const top = Math.max(12, r.top - offsetPx);
                const left = Math.round(r.left + (r.width / 2));
                toast.style.top = `${top}px`;
                toast.style.left = `${left}px`;
                toast.style.transform = "translate(-50%, 12px)";
            } else {
                // fallback: bottom-center
                toast.style.bottom = "24px";
                toast.style.left = "50%";
                toast.style.transform = "translate(-50%, 12px)";
            }
        };

        const onScrollOrResize = () => place();

        setTimeout(() => {
            document.body.appendChild(toast);
            place();
            // animate in
            requestAnimationFrame(() => {
                toast.style.opacity = "1";
                // remove translateY
                toast.style.transform = "translate(-50%, 0)";
            });

            // keep it in place if viewport changes
            window.addEventListener("scroll", onScrollOrResize, { passive: true });
            window.addEventListener("resize", onScrollOrResize);

            // schedule hide + cleanup
            setTimeout(() => {
                toast.style.opacity = "0";
                toast.style.transform = "translate(-50%, 12px)";
                setTimeout(() => {
                    window.removeEventListener("scroll", onScrollOrResize);
                    window.removeEventListener("resize", onScrollOrResize);
                    toast.remove();
                }, 300);
            }, duration);
        }, delay);
    } catch (e) {
        console.warn("[TOAST] Failed:", e);
    }
}

// CRITICAL: Global initialization guards to prevent circular dependencies
window.__appInitialized = false;
window.__gameShown = false;

// FIXED: Supabase Configuration - Use window object for browser environment
const SUPABASE_URL = window.SUPABASE_URL || 'https://vlcjilzgntxweomnyfgd.supabase.co';
const SUPABASE_ANON_KEY = window.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZsY2ppbHpnbnR4d2VvbW55ZmdkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE5MTM0MzUsImV4cCI6MjA3NzQ4OTQzNX0.MeIJpGfdAGqQwx9t0_Tdog9W-Z1cWX3z4cUffeoQW-c';

// Admin email for role detection
const ADMIN_EMAIL = 'hola@theaccidentalretiree.mx';

// Stage-specific second riddle clues
const SECOND_RIDDLE_CLUES = {
    5: "We slept where Ra's first light awoke, In walls that held the desert's smoke. Seek not the tombs of kings long gone, But the humble door our fate shone on— Three numbers guard the path once more, The code that wakes the chamber door.",
    6: "From city skies to seaside song, Where golden butter makes you strong. The name is whispered, soft and gone, A coastal town where flavors dawn.",
    7: "A whisper called before we flew, A brand appeared, then left our view. The clue was fleeting, yet it's true— One word, four numbers—seen and heard by few.",
    8: "A sign of steel, a steady hand, The numbers bold, the prices stand. For blade and shear, combine their wit— Old phrase says, 'two bits!'",
    9: "This is just a placeholder (you can just use that for now and I can update stage by stage). If you get stuck, go back to the video on YouTube and comment that you need help! Joel will give you a nudge.",
    10: "This is just a placeholder (you can just use that for now and I can update stage by stage). If you get stuck, go back to the video on YouTube and comment that you need help! Joel will give you a nudge.",
    11: "This is just a placeholder (you can just use that for now and I can update stage by stage). If you get stuck, go back to the video on YouTube and comment that you need help! Joel will give you a nudge.",
    12: "This is just a placeholder (you can just use that for now and I can update stage by stage). If you get stuck, go back to the video on YouTube and comment that you need help! Joel will give you a nudge.",
    13: "This is just a placeholder (you can just use that for now and I can update stage by stage). If you get stuck, go back to the video on YouTube and comment that you need help! Joel will give you a nudge.",
    14: "This is just a placeholder (you can just use that for now and I can update stage by stage). If you get stuck, go back to the video on YouTube and comment that you need help! Joel will give you a nudge.",
    15: "This is just a placeholder (you can just use that for now and I can update stage by stage). If you get stuck, go back to the video on YouTube and comment that you need help! Joel will give you a nudge."
};

// Initialize Supabase client
let supabase = null;
let supabaseAuth = null;
let progressManager = null;
let leaderboardManager = null;
let authUI = null;
let stageControlManager = null;
let adminManager = null;

// Admin Manager for stage control functionality
class AdminManager {
    constructor() {
        this.stagesData = [];
        this.solveCounts = {};
        this.API_BASE = `${SUPABASE_URL}/functions/v1`;
    }

    // Check if current user is admin
    isAdmin() {
        return supabaseAuth && supabaseAuth.user && supabaseAuth.user.email === ADMIN_EMAIL;
    }

    // Load stage data from API
    async loadStageData() {
        try {
            this.updateStatus('Loading stage data...', 'loading');
            
            const response = await fetch(`${this.API_BASE}/admin_stage_control`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                },
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            
            if (data.success) {
                this.stagesData = data.stages || [];
                this.solveCounts = data.solve_counts || {};
                this.renderStages();
                this.updateStatus(`Data loaded successfully (${this.stagesData.length} stages)`, 'success');
                this.clearMessages();
            } else {
                throw new Error(data.error || 'Failed to load data');
            }
        } catch (error) {
            console.error('Failed to load stage data:', error);
            this.updateStatus('Failed to load data', 'error');
            this.showMessage(`Error loading data: ${error.message}`, 'error');
        }
    }

    // Render stages grid
    renderStages() {
        const container = document.getElementById('adminStagesContainer');
        
        if (!this.stagesData.length) {
            container.innerHTML = '<p class="admin-loading">No stage data available</p>';
            return;
        }

        const stagesHTML = this.stagesData.map(stage => {
            const solveCount = this.solveCounts[stage.stage] || 0;
            const isEnabled = stage.is_enabled;
            const lastUpdated = stage.updated_at ? new Date(stage.updated_at).toLocaleString() : 'Never';
            
            return `
                <div class="admin-stage-card ${isEnabled ? 'enabled' : 'disabled'}">
                    <div class="admin-stage-header">
                        <h3 class="admin-stage-title">Stage ${stage.stage}</h3>
                        <label class="stage-toggle">
                            <input type="checkbox" ${isEnabled ? 'checked' : ''} 
                                   onchange="adminManager.toggleStage(${stage.stage}, this.checked)">
                            <span class="toggle-slider"></span>
                        </label>
                    </div>
                    
                    <div class="admin-stage-info">
                        <div class="admin-info-item">
                            <span class="admin-info-label">Status</span>
                            <span class="admin-info-value">${isEnabled ? '🟢 Live' : '🔴 Disabled'}</span>
                        </div>
                        <div class="admin-info-item">
                            <span class="admin-info-label">Solvers</span>
                            <span class="admin-info-value">${solveCount} users</span>
                        </div>
                        <div class="admin-info-item">
                            <span class="admin-info-label">Last Updated</span>
                            <span class="admin-info-value">${lastUpdated}</span>
                        </div>
                        <div class="admin-info-item">
                            <span class="admin-info-label">Updated By</span>
                            <span class="admin-info-value">${stage.updated_by || 'System'}</span>
                        </div>
                    </div>
                    
                    <div class="admin-stage-notes">
                        <textarea class="admin-notes-input" 
                                  placeholder="Add notes about this stage..."
                                  id="admin-notes-${stage.stage}">${stage.notes || ''}</textarea>
                        <button class="admin-update-btn" onclick="adminManager.updateStageNotes(${stage.stage})">
                            💾 Update Notes
                        </button>
                    </div>
                </div>
            `;
        }).join('');

        container.innerHTML = `<div class="admin-stages-grid">${stagesHTML}</div>`;
    }

    // Toggle individual stage
    async toggleStage(stageNumber, isEnabled) {
        try {
            this.updateStatus(`Updating Stage ${stageNumber}...`, 'loading');
            
            const response = await fetch(`${this.API_BASE}/admin_stage_control`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    stage: stageNumber,
                    is_enabled: isEnabled,
                    admin_user: 'admin_panel',
                    notes: `Stage ${isEnabled ? 'enabled' : 'disabled'} via admin panel`
                }),
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            
            if (data.success) {
                this.showMessage(data.message, 'success');
                this.updateStatus('Update successful', 'success');
                
                // Refresh data after short delay
                setTimeout(() => this.loadStageData(), 1000);
                
                // Update stage control manager and refresh game UI
                if (stageControlManager) {
                    await stageControlManager.loadStageControl();
                }
            } else {
                throw new Error(data.error || 'Update failed');
            }
        } catch (error) {
            console.error('Failed to toggle stage:', error);
            this.showMessage(`Failed to update Stage ${stageNumber}: ${error.message}`, 'error');
            this.updateStatus('Update failed', 'error');
            
            // Revert toggle on error
            this.loadStageData();
        }
    }

    // Update stage notes
    async updateStageNotes(stageNumber) {
        const notesTextarea = document.getElementById(`admin-notes-${stageNumber}`);
        const notes = notesTextarea.value.trim();
        
        try {
            this.updateStatus(`Updating notes for Stage ${stageNumber}...`, 'loading');
            
            // Find current stage data
            const currentStage = this.stagesData.find(s => s.stage === stageNumber);
            if (!currentStage) {
                throw new Error('Stage not found');
            }
            
            const response = await fetch(`${this.API_BASE}/admin_stage_control`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    stage: stageNumber,
                    is_enabled: currentStage.is_enabled,
                    admin_user: 'admin_panel',
                    notes: notes || `Stage ${stageNumber} notes updated`
                }),
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            
            if (data.success) {
                this.showMessage(`Notes updated for Stage ${stageNumber}`, 'success');
                this.updateStatus('Notes updated', 'success');
                
                // Refresh data after short delay
                setTimeout(() => this.loadStageData(), 1000);
            } else {
                throw new Error(data.error || 'Update failed');
            }
        } catch (error) {
            console.error('Failed to update notes:', error);
            this.showMessage(`Failed to update notes for Stage ${stageNumber}: ${error.message}`, 'error');
            this.updateStatus('Update failed', 'error');
        }
    }

    // Bulk operations
    async bulkOperation(action, stages = null) {
        try {
            this.updateStatus(`Performing bulk operation: ${action}...`, 'loading');
            
            const requestBody = {
                action: action,
                admin_user: 'admin_panel'
            };
            
            if (stages) {
                requestBody.stages = stages;
            }
            
            const response = await fetch(`${this.API_BASE}/admin_stage_control/bulk`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody),
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            
            if (data.success) {
                this.showMessage(data.message, 'success');
                this.updateStatus('Bulk operation completed', 'success');
                
                // Refresh data after short delay
                setTimeout(() => this.loadStageData(), 1500);
                
                // Update stage control manager and refresh game UI
                if (stageControlManager) {
                    setTimeout(() => stageControlManager.loadStageControl(), 2000);
                }
            } else {
                throw new Error(data.error || 'Bulk operation failed');
            }
        } catch (error) {
            console.error('Bulk operation failed:', error);
            this.showMessage(`Bulk operation failed: ${error.message}`, 'error');
            this.updateStatus('Bulk operation failed', 'error');
        }
    }

    // UI Helper Functions
    updateStatus(message, type) {
        const indicator = document.getElementById('adminStatusIndicator');
        if (indicator) {
            indicator.textContent = message;
            indicator.className = `status-indicator status-${type}`;
        }
    }

    showMessage(message, type) {
        const container = document.getElementById('adminMessageContainer');
        if (container) {
            const messageDiv = document.createElement('div');
            messageDiv.className = `admin-${type}`;
            messageDiv.textContent = message;
            
            container.appendChild(messageDiv);
            
            // Auto-remove after 5 seconds
            setTimeout(() => {
                if (messageDiv.parentNode) {
                    messageDiv.parentNode.removeChild(messageDiv);
                }
            }, 5000);
        }
    }

    clearMessages() {
        const container = document.getElementById('adminMessageContainer');
        if (container) {
            container.innerHTML = '';
        }
    }
}

// Global admin functions for button onclick handlers
function loadAdminStageData() {
    if (adminManager) {
        adminManager.loadStageData();
    }
}

function adminBulkOperation(action, stages = null) {
    if (adminManager) {
        adminManager.bulkOperation(action, stages);
    }
}

// Wait for Supabase to load
function initializeSupabase() {
    if (window.supabase) {
        console.log('[SUPABASE] Initializing with URL:', SUPABASE_URL);
        console.log('[SUPABASE] Using key ending in:', SUPABASE_ANON_KEY.slice(-10));
        
        supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

        // Initialize auth system
        supabaseAuth = {
            user: null,
            isAuthenticated: () => !!supabaseAuth.user,

            async signInWithEmail(email, password) {
                console.log('[AUTH] Attempting sign in for:', email);
                const { data, error } = await supabase.auth.signInWithPassword({ email, password });
                if (error) {
                    console.error('[AUTH] Sign in error:', error);
                    throw error;
                }
                console.log('[AUTH] Sign in successful:', data.user?.email);
                return data;
            },

            async signUpWithEmail(email, password, metadata = {}) {
                console.log('[AUTH] Attempting sign up for:', email);
                
                try {
                    const { data, error } = await supabase.auth.signUp({
                        email,
                        password,
                        options: { 
                            data: metadata,
                            emailRedirectTo: window.location.origin
                        }
                    });
                    
                    if (error) {
                        console.error('[AUTH] Sign up error:', error);
                        throw error;
                    }
                    
                    console.log('[AUTH] Sign up response:', data);
                    
                    // Check if user needs email confirmation
                    if (data.user && !data.session) {
                        console.log('[AUTH] User created but needs email confirmation');
                        return {
                            ...data,
                            needsConfirmation: true
                        };
                    }
                    
                    console.log('[AUTH] Sign up successful:', data.user?.email);
                    return data;
                } catch (error) {
                    console.error('[AUTH] Sign up exception:', error);
                    throw error;
                }
            },

            async resetPassword(email) {
                const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
                    redirectTo: window.location.origin
                });
                if (error) throw error;
                return data;
            },

            // New: explicit handler that hard-codes the reset redirect to the live site
            async handlePasswordResetRequest(email) {
                const redirectTo = 'https://theaccidentalretiree.app/reset.html';
                console.log('[PasswordReset] Sending reset email for:', email, 'redirectTo:', redirectTo);
                try {
                    const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
                        redirectTo,
                    });
                    if (error) {
                        console.error('[PasswordReset] Error sending reset email:', error);
                        alert('Error sending password reset email. Please try again.');
                        throw error;
                    }
                    console.log('[PasswordReset] Reset email sent');
                    alert('If an account exists for that email, a password reset link has been sent.');
                    return data;
                } catch (err) {
                    console.error('[PasswordReset] Exception while sending reset email:', err);
                    alert('Failed to send password reset email. Please contact support.');
                    throw err;
                }
            },

            async signOut() {
                console.log('[AUTH] Sign out initiated...');
                try {
                    const { error } = await supabase.auth.signOut();
                    if (error) {
                        console.error('[AUTH] Sign out error:', error);
                        throw error;
                    }
                    console.log('[AUTH] Sign out successful');
                    
                    // Clear user state immediately
                    supabaseAuth.user = null;
                    
                    // Clear local storage
                    localStorage.removeItem("contest_solved_stages");
                    localStorage.removeItem("contest_first_riddle_solved");
                    
                    // Navigation to landing is centralized in signOutHard();
                    // Avoid calling showLanding() here to prevent duplicate navigation/logs.
                    // showLanding();
                    
                    return true;
                } catch (error) {
                    console.error('[AUTH] Sign out failed:', error);
                    // Even if sign out fails, clear local state
                    supabaseAuth.user = null;
                    // showLanding(); // handled by signOutHard()
                    throw error;
                }
            }
        };

        // CRITICAL FIX: Auth state listener with proper admin detection
        supabase.auth.onAuthStateChange(async (event, session) => {
            console.log('[AUTH] State changed:', event, session?.user?.email);

            // Handle Supabase password recovery flow
            if (event === 'PASSWORD_RECOVERY') {
                console.log('[PasswordReset] PASSWORD_RECOVERY event detected for', session?.user?.email);

                (async () => {
                    const email = session?.user?.email;
                    if (!email) {
                        console.error('[PasswordReset] No email on session during PASSWORD_RECOVERY');
                        alert('Unable to complete password reset. Please request a new reset link.');
                        return;
                    }

                    const newPassword = prompt('Enter your new password:');
                    if (!newPassword) {
                        console.log('[PasswordReset] User cancelled password reset');
                        return;
                    }

                    // 1) Update the password
                    const { data: updateData, error: updateError } = await supabase.auth.updateUser({
                        password: newPassword,
                    });

                    if (updateError) {
                        console.error('[PasswordReset] Error updating password:', updateError);
                        alert('Error updating password. Please request a new reset link and try again.');
                        return;
                    }

                    console.log('[PasswordReset] Password updated successfully:', updateData);

                    // 2) Immediately sign the user in with the new password
                    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
                        email,
                        password: newPassword,
                    });

                    if (signInError) {
                        console.error('[PasswordReset] Password changed, but auto-login failed:', signInError);
                        alert('Password changed, but auto-login failed. Please log in manually with your new password.');
                        return;
                    }

                    console.log('[PasswordReset] Auto-login after reset successful:', signInData);
                    alert('Password updated! You are now logged in with your new password.');
                    // No reload needed; existing SIGNED_IN handler will show the game UI.
                })();

                return; // prevent the rest of the handler from running for this event
            }

            if (session?.user) {
                supabaseAuth.user = session.user;
                
                // CRITICAL FIX: Check if user is admin and show appropriate interface
                if (session.user.email === ADMIN_EMAIL) {
                    console.log('[AUTH] Admin user detected, showing admin panel');
                    showAdmin();
                } else {
                    console.log('[AUTH] Regular user detected, showing game');
                    if (progressManager) {
                        console.log('[AUTH] User signed in, syncing progress...');
                        await progressManager.syncWithSupabase();
                    }

                    // NEW: Jump to the next unsolved stage before showing the game
                    if (typeof (app || window.contestApp)?.ensureAtNextUnsolved === "function") {
                        try { (app || window.contestApp).ensureAtNextUnsolved("signed_in"); } catch (e) { console.warn('[NAV] ensureAtNextUnsolved error:', e); }
                    }

                    // Show the game UI after positioning
                    showGame();

                    // Toast: anchored above the answer input (falls back to bottom-center)
                    try {
                        showAnchoredToast("👋 Welcome back, continuing your journey...", {
                            delay: 1000,
                            duration: 3000,
                            anchorSelectors: [
                                '[data-role="answer-input"]',
                                '#answerInput',
                                'input[name="answer"]',
                                'textarea[name="answer"]',
                                '.answer-input'
                            ],
                            offsetPx: 64
                        });
                    } catch (e) { /* noop */ }

                    // Keep leaderboard refresh behavior
                    try { typeof queueLeaderboardRefresh === 'function' && queueLeaderboardRefresh('signed_in'); } catch (e) { /* noop */ }
                }
            } else {
                console.log('[AUTH] User signed out, clearing state...');
                supabaseAuth.user = null;
                // Landing view is handled by signOutHard() to avoid duplicate navigation
                // if (window.__gameShown || window.__adminShown) {
                //     showLanding();
                // }
            }
        });

        // Progress manager
        progressManager = {
            async syncWithSupabase() {
                if (!supabaseAuth.isAuthenticated()) {
                    console.log('[progressManager] User not authenticated, using local storage only');
                    return null;
                }

                try {
                    console.log('[progressManager] Syncing progress from cloud...');

                    const { data: solves, error } = await supabase
                        .from('solves')
                        .select('stage')
                        .eq('user_id', supabaseAuth.user.id)
                        .order('stage', { ascending: true });

                    if (error) {
                        console.warn('[progressManager] Failed to sync from cloud:', error);
                        return null;
                    }

                    if (solves && solves.length > 0) {
                        const cloudStages = solves.map(solve => solve.stage);
                        console.log('[progressManager] Found cloud progress:', cloudStages);

                        const localStages = window.contestApp ? window.contestApp.getSolvedStagesFromLocal() : [];
                        const mergedStages = [...new Set([...cloudStages, ...localStages])].sort((a, b) => a - b);

                        if (window.contestApp) {
                            console.log('[progressManager] Updating contest app with merged progress:', mergedStages);
                            window.contestApp.setSolvedStagesLocal(mergedStages);
                            
                            window.contestApp.renderStagesGrid();
                            window.contestApp.updateProgress();
                            window.contestApp.renderCurrentStage();
                            
                            console.log('[progressManager] UI updated with synced progress');
                        }

                        console.log('[progressManager] Progress synced successfully:', mergedStages);
                        return mergedStages;
                    } else {
                        console.log('[progressManager] No cloud progress found, using local storage');
                        return null;
                    }

                } catch (error) {
                    console.warn('[progressManager] Cloud sync failed:', error);
                    return null;
                }
            },

            async logStageCompletion(stage, answer, additionalData = {}) {
                console.log('[progressManager] Local logging only:', { stage, answer });
            }
        };

                // Leaderboard manager
                                                                leaderboardManager = {
                                                                                                                                                                                                async logSolve(stage) {
    console.groupCollapsed('[logSolve] Starting solve log');
    console.log('[logSolve] Stage:', stage);

    try {
        // Fetch authenticated user
        const { data: { user }, error: userError } = await supabase.auth.getUser();

        if (userError || !user) {
            console.error('[logSolve] No authenticated user or error:', userError);
            return { success: false, reason: 'no_user' };
        }

        // Construct payload matching the solves table schema
        const now = new Date().toISOString();
        const payload = {
            stage: Number(stage),
            user_id: user.id,
            username: user.email,
            email: user.email,
            solved_at: now,
            won_at: now,
            step: 1
        };

        console.log('[logSolve] Inserting payload:', payload);

        const { data, error } = await supabase
            .from('solves')
            .insert(payload)
            .select();

        if (error) {
            console.error('[logSolve] Supabase insert FAILED:', error);
            return { success: false, reason: 'supabase_error', error };
        }

        console.log('[logSolve] Successfully saved:', data);
        return { success: true, reason: 'saved' };

    } catch (err) {
        console.error('[logSolve] Unexpected exception:', err);
        return { success: false, reason: 'exception', error: err };
    } finally {
        console.groupEnd();
    }
}
                                                                                                                                };

// --- Local fallback helper ---
function localLogSolveFallback(payload) {
    try {
        console.warn('[logSolve] Local logging only (fallback). Payload:', payload);
        const key = 'local_solves';
        const existing = JSON.parse(localStorage.getItem(key) || '[]');
        existing.push(payload);
        localStorage.setItem(key, JSON.stringify(existing));
    } catch (err) {
        console.error('[logSolve] Failed to write local fallback:', err);
    }
}

        // Stage Control Manager - Admin stage control integration
        stageControlManager = {
            stageControlData: {},
            
            async loadStageControl() {
                try {
                    console.log('[STAGE_CONTROL] Loading stage control data...');
                    
                    const { data, error } = await supabase
                        .from('stage_control')
                        .select('stage, is_enabled')
                        .order('stage', { ascending: true });

                    if (error) {
                        console.warn('[STAGE_CONTROL] Failed to load stage control:', error);
                        // Default to all stages enabled if we can't load control data
                        this.stageControlData = {};
                        for (let i = 1; i <= 16; i++) {
                            this.stageControlData[i] = { is_enabled: true };
                        }
                        return;
                    }

                    // Convert array to object for easier lookup
                    this.stageControlData = {};
                    data.forEach(stage => {
                        this.stageControlData[stage.stage] = { is_enabled: stage.is_enabled };
                    });

                    console.log('[STAGE_CONTROL] Stage control data loaded:', this.stageControlData);
                    
                    // Refresh UI if contest app is ready
                    if (window.contestApp) {
                        window.contestApp.renderStagesGrid();
                        window.contestApp.renderCurrentStage();
                        updateStage16();
                    }
                    
                } catch (error) {
                    console.warn('[STAGE_CONTROL] Error loading stage control:', error);
                    // Default to all stages enabled on error
                    this.stageControlData = {};
                    for (let i = 1; i <= 16; i++) {
                        this.stageControlData[i] = { is_enabled: true };
                    }
                }
            },
            
            isStageEnabled(stage) {
                const control = this.stageControlData[stage];
                return control ? control.is_enabled : true; // Default to enabled if no data
            }
        };

        // Initialize Admin Manager
        adminManager = new AdminManager();

        window.supabaseAuth = supabaseAuth;
        window.progressManager = progressManager;
        window.leaderboardManager = leaderboardManager;
        window.stageControlManager = stageControlManager;
        window.adminManager = adminManager;
        
        // Load stage control data
        stageControlManager.loadStageControl();
        
        console.log('[SUPABASE] Initialization complete');
    } else {
        console.error('[SUPABASE] Supabase library not loaded');
    }
}

// FIXED: Leaderboard functionality - Ensure proper rendering
function renderLbCard(stage, winner) {
    const hasWinner = !!winner;
    const pill = hasWinner
        ? `<span class="lb-pill win">Winner: <span class="lb-username">${winner.username || '—'}</span></span>`
        : `<span class="lb-pill none">No Winner Yet</span>`;

    // icon circle replaces the old red stage-number disc
    const icon = hasWinner
        ? `<span class="lb-icon check" aria-hidden="true">✔</span>`
        : `<span class="lb-icon lock" aria-hidden="true">🔒</span>`;

    const status = hasWinner
        ? `🎉 Congratulations!${winner.won_at ? `<span class="lb-date">Won ${new Date(winner.won_at).toLocaleDateString()}</span>` : ''}`
        : `Prize Still Available`;

    let prizeText;
    if (stage === 15) {
        prizeText = '50K Miles';
    } else {
        prizeText = '$50 + $100 GC';
    }

    const card = document.createElement('div');
    card.className = 'lb-card';
    card.setAttribute('role', 'listitem');

    card.innerHTML = `
        <div class="lb-top">
            ${pill}
        </div>

        <div class="lb-left" style="margin-top:8px;">
            ${icon}
            <h4 class="lb-title">Stage ${stage}</h4>
        </div>

        <div class="lb-footer">
            <div class="lb-prize-badge">${prizeText}</div>
            <div class="lb-status">${status}</div>
        </div>
    `;

    return card;
}

// FIXED: Ensure leaderboard renders properly
async function renderLeaderboard() {
    console.log('[LEADERBOARD] Starting leaderboard render...');

    const grid = document.querySelector('.leaderboard-grid');
    if (!grid) {
        console.warn('[LEADERBOARD] Grid element not found');
        return;
    }

    // Clear existing content first
    grid.innerHTML = '';

    let winnersMap = {};

    // Try to fetch winners data
    try {
        if (supabase) {
            console.log('[LEADERBOARD] Fetching winners from stage_winners table...');
            const { data, error } = await supabase
                .from('stage_winners')
                .select('stage, username, won_at')
                .order('stage', { ascending: true });

            if (error) {
                console.warn('[LEADERBOARD] Error fetching winners:', error);
            } else if (data && data.length > 0) {
                console.log('[LEADERBOARD] Winners data received:', data);
                data.forEach(winner => {
                    winnersMap[winner.stage] = winner;
                });
            } else {
                console.log('[LEADERBOARD] No winners found in database');
            }
        } else {
            console.warn('[LEADERBOARD] Supabase not initialized');
        }
    } catch (error) {
        console.warn('[LEADERBOARD] Failed to fetch winners:', error);
    }

    console.log('[LEADERBOARD] Winners map:', winnersMap);

    // ALWAYS render cards for stages 1-15, even if no winners data
    for (let stage = 1; stage <= 15; stage++) {
        const winner = winnersMap[stage];
        const card = renderLbCard(stage, winner);
        grid.appendChild(card);
    }

    console.log('[LEADERBOARD] Successfully rendered 15 leaderboard cards');
}

// Stage 16 Leaderboard Card
async function renderLeaderboardStage16Big(){
    const row = document.getElementById('leaderboard-stage16-row');
    if (!row) return;

    // fetch just stage 16 (or fetch all once and filter if you already have data in scope)
    let winner = null;
    try {
        if (supabase) {
            const { data, error } = await supabase
                .from('stage_winners')
                .select('stage, username, won_at')
                .eq('stage', 16)
                .limit(1);

            if (error) {
                console.warn('[LB16] query error', error);
            } else if (data && data.length > 0) {
                winner = data[0];
            }
        }
    } catch (error) {
        console.warn('[LB16] Failed to fetch Stage 16 winner:', error);
    }

    const hasWinner = !!winner;

    const pill = hasWinner
        ? `<span class="lb-pill win">Winner: <span class="lb-username">${winner.username || '—'}</span></span>`
        : `<span class="lb-pill none">No Winner Yet</span>`;

    const icon = hasWinner
        ? `<span class="lb-icon check" aria-hidden="true">✔</span>`
        : `<span class="lb-icon lock" aria-hidden="true">🔒</span>`;

    const status = hasWinner
        ? `🎉 Congratulations!${winner.won_at ? `<span class="lb16-date">Won ${new Date(winner.won_at).toLocaleDateString()}</span>` : ''}`
        : `Prize Still Available`;

    const card = document.createElement('div');
    card.className = 'lb16-card';
    card.setAttribute('role', 'group');
    card.setAttribute('aria-label', 'Stage 16 (Leaderboard)');

    card.innerHTML = `
        <div class="lb16-top">
            ${pill}
            <!-- keep top-right clean -->
        </div>

        <div class="lb16-left" style="margin-top:8px;">
            ${icon}
            <h4 class="lb16-title">Stage 16</h4>
        </div>

        <div class="lb16-footer">
            <div class="lb16-prize">100K Miles</div>
            <div class="lb16-status">${status}</div>
        </div>
    `;

    row.innerHTML = '';
    row.appendChild(card);
}

// Modal Management System
const howToPlayModal = {
    element: null,
    
    init() {
        this.element = document.getElementById('howToPlayModal');
    },
    
    open() {
        if (this.element) {
            this.element.classList.add('show');
            document.body.style.overflow = 'hidden';
        }
    },
    
    close() {
        if (this.element) {
            this.element.classList.remove('show');
            document.body.style.overflow = '';
        }
    }
};

const termsModal = {
    element: null,
    
    init() {
        this.element = document.getElementById('termsModal');
    },
    
    open() {
        if (this.element) {
            this.element.classList.add('show');
            document.body.style.overflow = 'hidden';
        }
    },
    
    close() {
        if (this.element) {
            this.element.classList.remove('show');
            document.body.style.overflow = '';
        }
    }
};

// FIXED: Auth UI with better error handling and timeout management
class AuthUI {
    constructor() {
        this.isProcessing = false;
    }

    showModal() {
        const modal = document.getElementById('auth-modal');
        modal.classList.add('show');
        this.showTab('signup');
    }

    closeModal() {
        const modal = document.getElementById('auth-modal');
        modal.classList.remove('show');
        this.clearMessage();
        this.isProcessing = false;
    }

    showTab(tab) {
        document.querySelectorAll('.auth-form').forEach(form => {
            form.classList.remove('active');
        });

        document.querySelectorAll('.auth-tab').forEach(tabBtn => {
            tabBtn.classList.remove('active');
        });

        if (tab === 'signup') {
            document.getElementById('auth-signup').classList.add('active');
            document.querySelector('.auth-tab:first-child').classList.add('active');
            document.getElementById('auth-title').textContent = 'Join the Game!';
        } else if (tab === 'signin') {
            document.getElementById('auth-signin').classList.add('active');
            document.querySelector('.auth-tab:last-child').classList.add('active');
            document.getElementById('auth-title').textContent = 'Welcome Back!';
        }

        this.clearMessage();
    }

    showForgotPassword() {
        document.querySelectorAll('.auth-form').forEach(form => {
            form.classList.remove('active');
        });
        document.getElementById('auth-forgot').classList.add('active');
        document.getElementById('auth-title').textContent = 'Reset Password';
        this.clearMessage();
    }

    showMessage(message, type = 'info') {
        const messageEl = document.getElementById('auth-message');
        messageEl.textContent = message;
        messageEl.className = `auth-message ${type}`;
        messageEl.style.display = 'block';
    }

    clearMessage() {
        const messageEl = document.getElementById('auth-message');
        messageEl.style.display = 'none';
    }

    async handleSignIn(event) {
        event.preventDefault();
        
        if (this.isProcessing) {
            console.log('[AUTH] Sign in already in progress, ignoring');
            return;
        }
        
        this.isProcessing = true;
        
        const email = document.getElementById('signin-email').value;
        const password = document.getElementById('signin-password').value;

        try {
            this.showMessage('Signing in...', 'info');
            
            const result = await Promise.race([
                supabaseAuth.signInWithEmail(email, password),
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Sign in timeout')), 10000)
                )
            ]);
            
            this.showMessage('Welcome back!', 'success');
            setTimeout(() => {
                this.closeModal();
                // Auth state change will handle showing appropriate interface
            }, 1500);
        } catch (error) {
            console.error('Sign in error:', error);
            this.showMessage(error.message || 'Failed to sign in. Please try again.', 'error');
        } finally {
            this.isProcessing = false;
        }
    }

    async handleSignUp(event) {
        event.preventDefault();
        
        if (this.isProcessing) {
            console.log('[AUTH] Sign up already in progress, ignoring');
            return;
        }
        
        this.isProcessing = true;
        
        const username = document.getElementById('signup-username').value;
        const email = document.getElementById('signup-email').value;
        const password = document.getElementById('signup-password').value;

        try {
            this.showMessage('Creating your account...', 'info');
            
            const result = await Promise.race([
                supabaseAuth.signUpWithEmail(email, password, {
                    full_name: username,
                    username: username
                }),
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Sign up timeout')), 15000)
                )
            ]);
            
            if (result.needsConfirmation) {
                this.showMessage('Account created! Please check your email to confirm your account, then sign in.', 'success');
                setTimeout(() => {
                    this.showTab('signin');
                }, 3000);
            } else {
                this.showMessage('Account created! Let\'s start your journey!', 'success');
                setTimeout(() => {
                    this.closeModal();
                    // Auth state change will handle showing appropriate interface
                }, 2000);
            }
        } catch (error) {
            console.error('Sign up error:', error);
            let errorMessage = 'Failed to create account. Please try again.';
            
            if (error.message.includes('already registered')) {
                errorMessage = 'This email is already registered. Please sign in instead.';
            } else if (error.message.includes('timeout')) {
                errorMessage = 'Sign up is taking too long. Please try again.';
            } else if (error.message.includes('Password')) {
                errorMessage = 'Password must be at least 6 characters long.';
            }
            
            this.showMessage(errorMessage, 'error');
        } finally {
            this.isProcessing = false;
        }
    }

    async handleForgotPassword(event) {
        event.preventDefault();
        
        if (this.isProcessing) {
            return;
        }
        
        this.isProcessing = true;
        
        const email = document.getElementById('forgot-email').value;

        try {
            this.showMessage('Sending reset link...', 'info');

            await Promise.race([
                supabaseAuth.handlePasswordResetRequest(email),
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Reset timeout')), 10000)
                )
            ]);

            this.showMessage('Password reset link sent! Check your email.', 'success');
            setTimeout(() => this.showTab('signin'), 3000);
        } catch (error) {
            console.error('Password reset error:', error);
            this.showMessage(error.message || 'Failed to send reset link', 'error');
        } finally {
            this.isProcessing = false;
        }
    }
}

// Show/Hide functions
function showLanding() {
    console.log('[UI] Showing landing page');
    window.__gameShown = false;
    window.__adminShown = false;
    document.getElementById('landingPage').style.display = 'flex';
    document.getElementById('gameContainer').style.display = 'none';
    document.getElementById('adminContainer').style.display = 'none';
}

function showGame() {
    if (window.__gameShown) {
        console.log('[UI] Game already shown, skipping');
        return;
    }
    
    console.log('[UI] Showing game');
    window.__gameShown = true;
    window.__adminShown = false;
    
    document.getElementById('landingPage').style.display = 'none';
    document.getElementById('gameContainer').style.display = 'block';
    document.getElementById('adminContainer').style.display = 'none';

    window.scrollTo({ top: 0, behavior: 'smooth' });

    if (supabaseAuth && supabaseAuth.user) {
        const userName = supabaseAuth.user.user_metadata?.username ||
            supabaseAuth.user.user_metadata?.full_name ||
            supabaseAuth.user.email.split('@')[0];
        document.getElementById('userName').textContent = userName;
    }

    // FIXED: Force leaderboard render when game is shown
    setTimeout(() => {
        console.log('[UI] Forcing leaderboard render...');
        renderLeaderboard();
        renderLeaderboardStage16Big();
    }, 500);
}

// CRITICAL FIX: Admin panel show function
function showAdmin() {
    if (window.__adminShown) {
        console.log('[UI] Admin already shown, skipping');
        return;
    }
    
    console.log('[UI] Showing admin panel');
    window.__adminShown = true;
    window.__gameShown = false;
    
    document.getElementById('landingPage').style.display = 'none';
    document.getElementById('gameContainer').style.display = 'none';
    document.getElementById('adminContainer').style.display = 'block';

    window.scrollTo({ top: 0, behavior: 'smooth' });

    if (supabaseAuth && supabaseAuth.user) {
        const userName = supabaseAuth.user.user_metadata?.username ||
            supabaseAuth.user.user_metadata?.full_name ||
            supabaseAuth.user.email.split('@')[0];
        document.getElementById('adminUserName').textContent = userName;
    }

    // Load admin data
    if (adminManager) {
        setTimeout(() => {
            adminManager.loadStageData();
        }, 500);
    }
}

// Contest App Configuration
const CONFIG = {
    total: 16,
    stages: {
        1: { title: "Stage 1", yt: "bGI0u0RlW34" },
        2: { title: "Stage 2", yt: "mQgZMa8sjYY" },
        3: { title: "Stage 3", yt: "KUN90a2ZHiw" },
        4: { title: "Stage 4", yt: "YIIR8guq-No" },
        5: { title: "Stage 5", yt: "sGqsQ7YyGPw" },
        6: { title: "Stage 6", yt: "Kv9js6bb35c" },
        7: { title: "Stage 7", yt: "LEZIW9LXwNA" },
        8: { title: "Stage 8", yt: "i81uGvAqi5c" },
        9: { title: "Stage 9", yt: "xxAU10mE0ik" },
        10: { title: "Stage 10", yt: "xxAU10mE0ik" },
        11: { title: "Stage 11", yt: "xxAU10mE0ik" },
        12: { title: "Stage 12", yt: "xxAU10mE0ik" },
        13: { title: "Stage 13", yt: "xxAU10mE0ik" },
        14: { title: "Stage 14", yt: "xxAU10mE0ik" },
        15: { title: "Stage 15", yt: "xxAU10mE0ik" },
        16: { title: "Stage 16", yt: "xxAU10mE0ik" }
    }
};

// Stage 16 Update Function - UPDATED: Now checks admin control
function updateStage16() {
    const stage16Card = document.getElementById('stage16Card');
    if (!stage16Card) return;

    // Get solved stages from contestApp if available, otherwise from localStorage
    let solvedStages = [];
    if (window.contestApp && window.contestApp.getSolvedStagesFromLocal) {
        solvedStages = window.contestApp.getSolvedStagesFromLocal();
    } else {
        try {
            solvedStages = JSON.parse(localStorage.getItem("contest_solved_stages") || "[]");
        } catch (e) {
            solvedStages = [];
        }
    }

    const solved = new Set(solvedStages.filter(n => n >= 1 && n <= 15));
    const progressUnlocked = solved.size === 15; // gate condition
    
    // NEW: Check admin control for Stage 16
    const adminEnabled = stageControlManager ? stageControlManager.isStageEnabled(16) : true;
    const unlocked = progressUnlocked && adminEnabled;

    // Update the card classes and content
    if (!adminEnabled) {
        // Admin disabled - takes priority
        stage16Card.classList.remove('locked');
        stage16Card.classList.add('admin-disabled');
        stage16Card.innerHTML = `
            <div class="stage16-top">
                <div class="stage16-left">
                    <div class="stage16-icon admin-disabled">⏸️</div>
                    <div class="stage16-title">Stage 16</div>
                </div>
                <div class="stage16-prize">100K Miles</div>
            </div>
            <div class="stage16-status">Temporarily Disabled</div>
        `;
        stage16Card.style.cursor = 'not-allowed';
        stage16Card.onclick = null;
    } else if (unlocked) {
        // Fully unlocked and enabled
        stage16Card.classList.remove('locked', 'admin-disabled');
        stage16Card.innerHTML = `
            <div class="stage16-top">
                <div class="stage16-left">
                    <div class="stage16-icon open">✔</div>
                    <div class="stage16-title">Stage 16</div>
                </div>
                <div class="stage16-prize">100K Miles</div>
            </div>
            <div class="stage16-status">Open</div>
        `;
        
        // Add click handler for open Stage 16
        stage16Card.style.cursor = 'pointer';
        stage16Card.onclick = () => {
            if (window.contestApp && window.contestApp.openStageModal) {
                window.contestApp.openStageModal(16);
            }
        };
    } else {
        // Locked due to progress
        stage16Card.classList.add('locked');
        stage16Card.classList.remove('admin-disabled');
        stage16Card.innerHTML = `
            <div class="stage16-top">
                <div class="stage16-left">
                    <div class="stage16-icon locked">🔒</div>
                    <div class="stage16-title">Stage 16</div>
                </div>
                <div class="stage16-prize">100K Miles</div>
            </div>
            <div class="stage16-status">Locked</div>
        `;
        stage16Card.style.cursor = 'not-allowed';
        stage16Card.onclick = null;
    }
}

// Initialize everything when DOM is ready
// Handle Supabase password recovery links in the URL hash
async function handlePasswordRecoveryFromUrl() {
    try {
        const hash = window.location.hash;
        if (!hash || hash.length <= 1) return;

        const params = new URLSearchParams(hash.substring(1));

        const type = params.get('type');
        const error = params.get('error_description');

        if (error) {
            const decoded = decodeURIComponent(error.replace(/\+/g, ' '));
            console.error('[PasswordReset] Error from recovery link:', decoded);
            alert(`Password reset link error: ${decoded}`);
            return;
        }

        if (type !== 'recovery') {
            return; // Not a recovery link
        }

        console.log('[PasswordReset] Recovery link detected, prompting for new password...');

        const newPassword = prompt('Enter your new password:');

        if (!newPassword) {
            alert('Password reset cancelled.');
            return;
        }

        try {
            const { data, error: updateError } = await supabase.auth.updateUser({
                password: newPassword
            });

            if (updateError) {
                console.error('[PasswordReset] Error updating password:', updateError);
                alert('Error updating password. Please request a new reset link and try again.');
                return;
            }

            console.log('[PasswordReset] Password updated successfully:', data);
            alert('Password updated! You can now log in with your new password.');

            // Clear the hash and reload to a clean state
            window.location.hash = '';
            window.location.reload();

        } catch (err) {
            console.error('[PasswordReset] Unexpected exception while updating password:', err);
            alert('Unexpected error while updating password.');
        }
    } catch (err) {
        console.error('[PasswordReset] Error parsing recovery URL:', err);
    }
}

document.addEventListener('DOMContentLoaded', function() {
    console.log('[INIT] DOM loaded, starting initialization...');
    
    // Initialize Supabase first
    initializeSupabase();
    
    // Initialize modals
    howToPlayModal.init();
    termsModal.init();
    
    // Initialize auth UI
    authUI = new AuthUI();
    
    // Bind landing page events
    document.getElementById('playGameBtn').onclick = () => {
        if (supabaseAuth && supabaseAuth.isAuthenticated()) {
            if (supabaseAuth.user.email === ADMIN_EMAIL) {
                showAdmin();
            } else {
                showGame();
            }
        } else {
            authUI.showModal();
        }
    };
    
    // Bind footer links
    document.getElementById('howToPlayLink').onclick = () => howToPlayModal.open();
    document.getElementById('termsLink').onclick = () => termsModal.open();
    document.getElementById('howToPlayLinkGame').onclick = () => howToPlayModal.open();

    // Bind the real sign-out button to the class handler
    const btn = document.querySelector("[data-action='signout']") || document.getElementById("btnSignOut");
    if (btn) {
      if (typeof app?.handleSignOut === "function") {
        btn.onclick = (e) => app.handleSignOut(e);
      } else {
        btn.onclick = (e) => signOutHard();
      }
      console.log("[SIGNOUT] Button bound");
    }
    document.getElementById('termsLinkGame').onclick = () => termsModal.open();
    
    // Initialize contest app after a short delay to ensure Supabase is ready
    setTimeout(() => {
        if (!window.__appInitialized) {
            window.contestApp = new ContestApp();
            // Expose the same instance as `app` for older code paths that expect a global `app`
            try { window.app = window.contestApp; console.log("[INIT] App instance exposed globally"); } catch (e) { /* noop */ }
            window.__appInitialized = true;
            console.log('[INIT] Contest app initialized');
                    // Check if this load came from a Supabase password recovery link
                    try { handlePasswordRecoveryFromUrl(); } catch (e) { console.warn('[PasswordReset] Error running recovery handler:', e); }
        }
    }, 1000);
    
    console.log('[INIT] Initialization complete');
});

// Handle auth state changes
window.addEventListener('load', function() {
    // Check if user is already signed in
    setTimeout(() => {
        if (supabase) {
            supabase.auth.getSession().then(({ data: { session } }) => {
                if (session?.user) {
                    console.log('[LOAD] Found existing session:', session.user.email);
                    supabaseAuth.user = session.user;
                    
                    // CRITICAL FIX: Proper admin detection on page load
                    if (session.user.email === ADMIN_EMAIL) {
                        showAdmin();
                    } else {
                        showGame();
                    }
                } else {
                    console.log('[LOAD] No existing session found');
                    showLanding();
                }
            });
        }
    }, 500);
});

// Global error handler
window.addEventListener('error', function(event) {
    console.error('[GLOBAL ERROR]', event.error);
});

// Global unhandled promise rejection handler
window.addEventListener('unhandledrejection', function(event) {
    console.error('[UNHANDLED PROMISE REJECTION]', event.reason);
});

console.log('[SCRIPT] Contest app script loaded successfully');
