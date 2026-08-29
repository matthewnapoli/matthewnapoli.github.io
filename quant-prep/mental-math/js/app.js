import { generateQuestion, makeChoices, parseAnswer, validateAnswer, SKILL_KEYS, SKILL_LABELS } from "./generators.js";
import { loadProfile, saveProfile, recordAttempt, recordBreakdownStep, overrideError, skillSummary, weakestSkills, strongestSkills, dueReinforcement, completeTest, resetProfile, exportProfile, factSummary, median } from "./profile.js";
import { STRATEGIES, FACTS, formatStrategyName } from "./strategies.js";
import { formatCompletedStep, needsBreakdown, quickCorrection } from "./learning-policy.js";

const app = document.querySelector("#app");
const nav = document.querySelector("#primary-nav");
const profileStatus = document.querySelector("#profile-status");
const state = {
    profile: loadProfile(),
    view: "dashboard",
    session: null,
    timer: null,
    filters: { type: "all", operator: "all", result: "all", gap: "all", difficulty: "all", period: "all", mode: "all" },
    sort: { key: "date", direction: "desc" },
    factMatrix: "addition",
    factDrill: null
};

const esc = (value) => String(value ?? "").replace(/[&<>'"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));
const pct = (value) => `${Math.round(value * 100)}%`;
const seconds = (value) => value ? `${value.toFixed(1)}s` : "—";
const dateLabel = (value) => new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(value));
const sessionId = () => `session-${Date.now().toString(36)}`;

function setView(view) {
    clearTimer();
    state.view = view;
    state.session = null;
    render();
    window.scrollTo({ top: 0, behavior: "instant" });
}

function updateChrome() {
    nav?.querySelectorAll("button").forEach(button => button.classList.toggle("active", button.dataset.view === state.view || (state.view === "dashboard" && button.dataset.view === "dashboard")));
    const attempts = state.profile.history.length;
    const factAttempts = Object.values(state.profile.breakdownFacts || {}).reduce((sum, fact) => sum + (fact.attempts || 0), 0);
    profileStatus.innerHTML = `<span class="status-dot"></span>${attempts ? `${attempts} attempts saved` : factAttempts ? `${factAttempts} fact attempts saved` : "Local profile ready"}`;
}

function modeCard({ title, eyebrow, description, action, button, tone = "mint", detail }) {
    return `<article class="mode-card ${tone}">
        <div><div class="eyebrow">${esc(eyebrow)}</div><h3>${esc(title)}</h3><p>${esc(description)}</p></div>
        ${detail ? `<div class="mode-detail">${detail}</div>` : ""}
        <button class="text-button" data-action="${esc(action)}">${esc(button)} <span>→</span></button>
    </article>`;
}

function renderDashboard() {
    const weak = weakestSkills(state.profile, 3);
    const total = state.profile.history.length;
    const recent = state.profile.history.slice(-40);
    const accuracy = recent.length ? recent.filter(item => item.correct).length / recent.length : 0;
    const recentMedian = median(recent.map(item => item.responseMs / 1000));
    const latestTest = state.profile.tests.at(-1);
    const calibration = !state.profile.calibrated ? `<aside class="calibration-callout">
        <div><div class="eyebrow">New profile</div><h3>Start at the right level</h3><p>A 20-question calibration samples every core category and initializes your adaptive difficulty.</p></div>
        <button class="button secondary" data-action="start-calibration">Run skill calibration <span>~6 min</span></button>
    </aside>` : "";

    app.innerHTML = `<section class="dashboard-hero">
        <div><div class="eyebrow mint">Mental Math / Training Desk</div><h1>Build speed<br><span>without losing precision.</span></h1><p>Adaptive trader-style arithmetic that teaches you to recognize the efficient route—not just reach the answer.</p></div>
        <div class="hero-readout" aria-label="Recent performance">
            <div><span>Recent accuracy</span><strong>${recent.length ? pct(accuracy) : "—"}</strong></div>
            <div><span>Median response</span><strong>${seconds(recentMedian)}</strong></div>
            <div><span>Last test</span><strong>${latestTest ? pct(latestTest.accuracy) : "—"}</strong></div>
        </div>
    </section>
    ${calibration}
    <section class="section-block">
        <div class="section-heading"><div><div class="eyebrow">Choose a mode</div><h2>Today's desk</h2></div><span>${total} lifetime attempts</span></div>
        <div class="mode-grid">
            ${modeCard({ title: "Learn", eyebrow: "Adaptive practice", description: "Immediate feedback, progressive scaffolding, and strategy coaching that fades as your mastery grows.", action: "start-learn", button: "Start adaptive session", detail: `<span>No score pressure</span><span>Keyboard-first</span>` })}
            ${modeCard({ title: "Test", eyebrow: "Trader assessment", description: "A timed, low-noise assessment. No hints or explanations until the test is complete.", action: "test-setup", button: "Configure test", tone: "amber", detail: `<span>Accuracy first</span><span>15-second question cap</span>` })}
            ${modeCard({ title: "Base Facts", eyebrow: "Retrieval helper", description: "Make multiplication and division through 15 × 15 automatic, then lock in squares from 15² through 20².", action: "start-facts", button: "Drill base facts", detail: `<span>30 prompts</span><span>Updates mastery grid</span>` })}
        </div>
    </section>
    <section class="lower-grid">
        <article class="panel today-panel">
            <div class="panel-top"><div><div class="eyebrow">Daily protocol</div><h3>Today's Training</h3></div><span class="time-chip">~10 min</span></div>
            <div class="training-mix"><span style="--w:20%">Review 20%</span><span style="--w:50%">Weak 50%</span><span style="--w:20%">Medium 20%</span><span style="--w:10%">Stretch 10%</span></div>
            <p>Interleaved practice weighted toward durable improvement—not today's easiest score.</p>
            <button class="button" data-action="start-daily">Begin daily training</button>
        </article>
        <article class="panel focus-panel">
            <div class="panel-top"><div><div class="eyebrow">Adaptive focus</div><h3>Focus Areas</h3></div><span class="rank-label">Priority</span></div>
            <ol class="focus-list">${weak.map((skill, index) => `<li><span>0${index + 1}</span><div><strong>${esc(skill.label)}</strong><small>${skill.attempts ? `${skill.ratingLabel} · ${skill.rating}/100` : "Awaiting calibration"}</small></div></li>`).join("")}</ol>
            <button class="button secondary" data-action="start-focus">Practice weak areas</button>
        </article>
    </section>`;
}

function factCandidates() {
    const times = Array.from({ length: 15 }, (_, leftIndex) => Array.from({ length: 15 }, (_, rightIndex) => {
        const left = leftIndex + 1;
        const right = rightIndex + 1;
        return { key: `times:${left}x${right}`, left, right, answer: left * right, kind: "times" };
    })).flat();
    const squares = Array.from({ length: 6 }, (_, index) => {
        const value = index + 15;
        return { key: `square:${value}`, left: value, right: value, answer: value * value, kind: "square" };
    });
    return [...times, ...squares];
}

function selectFactQuestion(excludeKey = null) {
    const squareTurn = state.factDrill.index % 6 === 5;
    const candidates = factCandidates().filter(item => item.key !== excludeKey && (squareTurn ? item.kind === "square" : item.kind === "times")).map(item => ({ ...item, stat: factSummary(state.profile, item.key), noise: Math.random() * 8 }));
    candidates.sort((a, b) => a.stat.attempts - b.stat.attempts || a.stat.rating - b.stat.rating || a.noise - b.noise);
    const item = candidates[0];
    if (item.kind === "square") return { ...item, prompt: `${item.left}²`, operation: "square" };
    const useDivision = state.factDrill.index % 2 === 1;
    return useDivision
        ? { ...item, prompt: `${item.answer} ÷ ${item.left}`, operation: "division", answer: item.right }
        : { ...item, prompt: `${item.left} × ${item.right}`, operation: "multiplication" };
}

function startFactDrill() {
    clearTimer();
    state.view = "fact-drill";
    state.factDrill = { id: `facts-${Date.now().toString(36)}`, index: 0, total: 30, correct: 0, question: null, feedback: null, startedAt: Date.now() };
    state.factDrill.question = selectFactQuestion();
    render();
    window.scrollTo({ top: 0, behavior: "instant" });
}

function submitFactAnswer(rawAnswer) {
    const drill = state.factDrill;
    if (!drill || drill.feedback) return;
    const responseMs = Date.now() - drill.startedAt;
    const value = Number(String(rawAnswer).replaceAll(",", "").trim());
    const correct = Number.isFinite(value) && value === drill.question.answer;
    recordBreakdownStep(state.profile, { prompt: `${drill.question.prompt} = ?`, answer: drill.question.answer, factKey: drill.question.key }, correct, responseMs, `${drill.id}-${drill.index}`);
    drill.correct += correct ? 1 : 0;
    drill.feedback = { correct, responseMs, rawAnswer };
    renderFactDrill();
}

function advanceFactDrill() {
    const drill = state.factDrill;
    if (drill.index + 1 >= drill.total) {
        drill.complete = true;
        renderFactDrill();
        return;
    }
    const previousKey = drill.question.key;
    drill.index += 1;
    drill.feedback = null;
    drill.startedAt = Date.now();
    drill.question = selectFactQuestion(previousKey);
    renderFactDrill();
    window.scrollTo({ top: 0, behavior: "instant" });
}

function renderFactDrill() {
    const drill = state.factDrill;
    if (drill.complete) {
        app.innerHTML = `<section class="fact-drill-page"><div class="page-heading"><div><div class="eyebrow mint">Base facts / Session complete</div><h1>${drill.correct}<span> / ${drill.total}</span></h1><p>Your multiplication, division, and square observations are now reflected in the mastery grids.</p></div></div><div class="result-actions"><button class="button" data-action="start-facts">Drill another 30</button><button class="quiet-button" data-view="analytics">Open mastery grids</button><button class="quiet-button" data-view="dashboard">Return to desk</button></div></section>`;
        return;
    }
    const question = drill.question;
    const fact = factSummary(state.profile, question.key);
    app.innerHTML = `<section class="fact-drill-page"><header class="fact-drill-header"><button class="icon-button" data-action="exit-facts" aria-label="Exit base facts">×</button><div><div class="eyebrow">Base facts · ${question.operation}</div><div class="progress-line"><span style="width:${(drill.index / drill.total) * 100}%"></span></div></div><div class="fact-drill-stat"><span>Question</span><strong>${drill.index + 1} / ${drill.total}</strong></div><div class="fact-drill-stat"><span>Correct</span><strong>${drill.correct}</strong></div></header>
        <article class="fact-drill-card"><div class="question-tags"><span>${fact.attempts ? `${fact.status} · ${fact.rating}/100` : "unmeasured"}</span><span>${question.kind === "square" ? "15²–20²" : "1×1–15×15"}</span></div><div class="fact-prompt">${question.prompt}<span>= ?</span></div>
        ${drill.feedback ? `<section class="fact-feedback ${drill.feedback.correct ? "correct" : "incorrect"}"><strong>${drill.feedback.correct ? "Correct" : `Answer: ${question.answer}`}</strong><span>${(drill.feedback.responseMs / 1000).toFixed(1)}s · mastery updated</span><button class="button" data-action="next-fact">Next fact</button></section>` : `<form class="fact-answer-form" data-form="fact-answer"><input name="answer" inputmode="decimal" autocomplete="off" aria-label="Answer" autofocus required><button class="button" type="submit">Submit</button></form>`}</article></section>`;
    if (!drill.feedback) app.querySelector("[name='answer']")?.focus();
}

function weightedSkill(mode, index) {
    const weak = weakestSkills(state.profile, 6).map(item => item.key);
    if (mode === "focus") return weak[index % Math.min(weak.length, 3)];
    if (mode === "daily") {
        const roll = index % 10;
        if (roll < 5) return weak[index % Math.min(weak.length, 4)];
        if (roll < 7) return SKILL_KEYS[(index * 3) % SKILL_KEYS.length];
        if (roll < 9) return SKILL_KEYS[(index * 5 + 2) % SKILL_KEYS.length];
        return strongestSkills(state.profile, 4)[0]?.key || SKILL_KEYS[(index * 7) % SKILL_KEYS.length];
    }
    if (Math.random() < .58) return weak[index % weak.length];
    return SKILL_KEYS[(index * 5 + Math.floor(Math.random() * SKILL_KEYS.length)) % SKILL_KEYS.length];
}

function reviewWorksheet(item, answer) {
    const prompt = item.prompt.trim();
    const numeric = "(-?\\d+(?:\\.\\d+)?)";
    const decimals = value => (String(value).split(".")[1] || "").length;
    let match = prompt.match(new RegExp(`^${numeric}\\s*([+−×÷])\\s*${numeric}$`));
    if (match) {
        const a = Number(match[1]);
        const symbol = match[2];
        const b = Number(match[3]);
        if (symbol === "×" && (!Number.isInteger(a) || !Number.isInteger(b))) {
            const scaleA = 10 ** decimals(a);
            const scaleB = 10 ** decimals(b);
            const integerA = Math.round(a * scaleA);
            const integerB = Math.round(b * scaleB);
            const raw = integerA * integerB;
            return [{ prompt: `${a} × ${scaleA} = ?`, answer: integerA }, { prompt: `${b} × ${scaleB} = ?`, answer: integerB }, { prompt: `${integerA} × ${integerB} = ?`, answer: raw }, { prompt: `Move the decimal ${decimals(a) + decimals(b)} places left in ${raw}.`, answer }];
        }
        if (symbol === "×") {
            const first = b >= 10 ? Math.floor(b / 10) * 10 : Math.max(1, Math.floor(b / 2));
            const rest = b - first;
            return [{ prompt: `${a} × ${first} = ?`, answer: a * first }, ...(rest ? [{ prompt: `${a} × ${rest} = ?`, answer: a * rest }] : []), { prompt: `${a * first} + ${a * rest} = ?`, answer }];
        }
        if (symbol === "÷") {
            const firstQuotient = Math.max(1, Math.floor(answer / 2));
            const firstDividend = b * firstQuotient;
            return [{ prompt: `${firstDividend} ÷ ${b} = ?`, answer: firstQuotient }, { prompt: `${a - firstDividend} ÷ ${b} = ?`, answer: answer - firstQuotient }, { prompt: `${firstQuotient} + ${answer - firstQuotient} = ?`, answer }];
        }
        const places = Math.max(decimals(a), decimals(b));
        const scale = 10 ** places;
        const scaledA = Math.round(a * scale);
        const scaledB = Math.round(b * scale);
        const scaledAnswer = Math.round(answer * scale);
        return [{ prompt: `${a} × ${scale} = ?`, answer: scaledA }, { prompt: `${b} × ${scale} = ?`, answer: scaledB }, { prompt: `${scaledA} ${symbol} ${scaledB} = ?`, answer: scaledAnswer }, { prompt: `Move the decimal ${places} place${places === 1 ? "" : "s"} left in ${scaledAnswer}.`, answer }];
    }
    match = prompt.match(new RegExp(`^${numeric}% of ${numeric}$`));
    if (match) {
        const percent = Number(match[1]);
        const base = Number(match[2]);
        return [{ prompt: `10% of ${base} = ?`, answer: base / 10 }, { prompt: `1% of ${base} = ?`, answer: base / 100 }, { prompt: `${Math.floor(percent / 10)} × ${base / 10} + ${percent % 10} × ${base / 100} = ?`, answer }];
    }
    match = prompt.match(new RegExp(`^(Increase|Decrease) ${numeric} by ${numeric}%$`));
    if (match) {
        const base = Number(match[2]);
        const percent = Number(match[3]);
        const change = base * percent / 100;
        const symbol = match[1] === "Increase" ? "+" : "−";
        return [{ prompt: `10% of ${base} = ?`, answer: base / 10 }, { prompt: `${percent}% of ${base} = ?`, answer: change }, { prompt: `${base} ${symbol} ${change} = ?`, answer }];
    }
    match = prompt.match(new RegExp(`^${numeric} is what % of ${numeric}\\??$`));
    if (match) {
        const part = Number(match[1]);
        const base = Number(match[2]);
        return [{ prompt: `10% of ${base} = ?`, answer: base / 10 }, { prompt: `${part} ÷ ${base} = ?`, answer: part / base }, { prompt: `${part / base} × 100 = ?`, answer }];
    }
    match = prompt.match(new RegExp(`^\\? × ${numeric} = ${numeric}$`));
    if (match) return [{ prompt: `${Number(match[2])} ÷ ${Number(match[1])} = ?`, answer }];
    match = prompt.match(new RegExp(`^${numeric} ÷ \\? = ${numeric}$`));
    if (match) return [{ prompt: `${Number(match[1])} ÷ ${Number(match[2])} = ?`, answer }];
    match = prompt.match(new RegExp(`^${numeric} \\+ \\? = ${numeric}$`));
    if (match) return [{ prompt: `${Number(match[2])} − ${Number(match[1])} = ?`, answer }];
    match = prompt.match(new RegExp(`^${numeric} − \\? = ${numeric}$`));
    if (match) return [{ prompt: `${Number(match[1])} − ${Number(match[2])} = ?`, answer }];
    match = prompt.match(/^(-?\d+)\/(\d+)\s*([+−×÷])\s*(-?\d+)\/(\d+)$/);
    if (match) {
        const n1 = Number(match[1]), d1 = Number(match[2]), symbol = match[3], n2 = Number(match[4]), d2 = Number(match[5]);
        if (symbol === "+" || symbol === "−") {
            const gcd = (x, y) => y ? gcd(y, x % y) : Math.abs(x);
            const common = Math.abs(d1 * d2) / gcd(d1, d2);
            const first = n1 * (common / d1);
            const second = n2 * (common / d2);
            const combined = symbol === "+" ? first + second : first - second;
            return [{ prompt: `Smallest common denominator for ${d1} and ${d2}?`, answer: common }, { prompt: `${n1}/${d1} = ?/${common}`, answer: first }, { prompt: `${n2}/${d2} = ?/${common}`, answer: second }, { prompt: `${first} ${symbol} ${second} = ?`, answer: combined }, { prompt: `Simplify ${combined}/${common}.`, answer, answerDisplay: item.answer }];
        }
        const rightN = symbol === "÷" ? d2 : n2;
        const rightD = symbol === "÷" ? n2 : d2;
        const rawN = n1 * rightN;
        const rawD = d1 * rightD;
        return [...(symbol === "÷" ? [{ prompt: `Flip ${n2}/${d2}. New numerator?`, answer: d2 }, { prompt: `Flip ${n2}/${d2}. New denominator?`, answer: n2 }] : []), { prompt: `${n1} × ${rightN} = ?`, answer: rawN }, { prompt: `${d1} × ${rightD} = ?`, answer: rawD }, { prompt: `Simplify ${rawN}/${rawD}.`, answer, answerDisplay: item.answer }];
    }
    return [{ prompt: "Recalculate the original expression in one line.", answer, answerDisplay: item.answer }];
}

function buildQuestion(session) {
    if (session.reviewQueue?.length) {
        const item = session.reviewQueue.shift();
        const answer = parseAnswer(item.answer);
        return {
            id: `review-${item.id}-${Date.now()}`, type: item.type, operator: item.operator, difficulty: item.difficulty,
            structuralType: "review", gap: item.gap, strategies: [item.strategy], operands: [], answer,
            answerDisplay: item.answer, prompt: item.prompt, skillKey: item.skillKey, targetTime: 10,
            tolerance: Math.max(.0001, Math.abs(answer) * .00001), hint: `Rebuild this with ${formatStrategyName(item.strategy)}.`,
            explanation: item.explanation || [`The correct answer is ${item.answer}.`], factKeys: item.factKeys || [],
            scaffold: reviewWorksheet(item, answer)
        };
    }
    const calibrationOrder = [
        "integer:addition", "integer:subtraction", "integer:multiplication", "integer:division",
        "decimal:addition", "decimal:subtraction", "decimal:multiplication", "decimal:division",
        "fraction:addition", "fraction:multiplication", "fraction:division", "percentage:multiplication",
        "percentage:division", "gap:mixed", "integer:multiplication", "decimal:multiplication",
        "percentage:addition", "percentage:subtraction", "fraction:subtraction", "gap:mixed"
    ];
    const skillKey = session.mode === "calibration" ? calibrationOrder[session.index % calibrationOrder.length] : session.focusKey || weightedSkill(session.mode, session.index);
    const skill = state.profile.skills[skillKey];
    const baseDifficulty = session.mode === "calibration" ? 2 + Math.floor(session.index / 7) : skill?.difficulty || 2;
    const stretch = session.mode === "daily" && session.index % 10 === 9 ? 1 : 0;
    const reinforcement = session.mode !== "test" && session.index > 1 ? dueReinforcement(state.profile) : null;
    return generateQuestion({ skillKey, difficulty: Math.min(6, baseDifficulty + stretch), previousType: session.previousType, reinforcement });
}

function startLearn(mode = "learn", focusKey = null, reviewQueue = null) {
    const ratings = Object.fromEntries(SKILL_KEYS.map(key => [key, state.profile.skills[key].rating]));
    state.profile.preferredMode = mode;
    state.session = {
        id: sessionId(), mode, focusKey, reviewQueue: reviewQueue ? [...reviewQueue] : null,
        total: reviewQueue?.length || 20, index: 0, correct: 0, startedAt: Date.now(),
        questionStartedAt: Date.now(), question: null, feedback: null, attempts: [], baseline: ratings,
        helpActive: false, scaffoldIndex: 0, scaffoldCorrect: 0, scaffoldError: "", scaffoldMistakes: 0, scaffoldStepStartedAt: Date.now(), scratch: [], locked: false
    };
    state.view = "session";
    nextQuestion();
}

function nextQuestion() {
    const session = state.session;
    if (!session || session.index >= session.total) return session?.mode === "test" || session?.mode === "calibration" ? finishTest() : finishLearn();
    session.previousType = session.question?.type;
    session.question = buildQuestion(session);
    session.questionStartedAt = Date.now();
    session.questionDeadline = session.questionStartedAt + 15000;
    session.feedback = null;
    session.helpActive = false;
    session.scaffoldIndex = 0;
    session.scaffoldCorrect = 0;
    session.scaffoldError = "";
    session.scaffoldMistakes = 0;
    session.scaffoldStepStartedAt = Date.now();
    session.scratch = [];
    session.locked = false;
    if (session.mode === "test" || session.mode === "calibration") {
        const useChoices = session.format === "choice" || (session.format === "mixed" && Math.random() < .42);
        session.choices = useChoices ? makeChoices(session.question) : null;
    }
    renderSession();
    window.scrollTo({ top: 0, behavior: "instant" });
    requestAnimationFrame(focusAnswer);
}

function focusAnswer() {
    app.querySelector("#answer-input")?.focus();
}

function renderScratch(session) {
    const level = state.profile.settings.workingMemory;
    if (level === "off") return "";
    const items = session.scratch;
    return `<aside class="scratchpad ${level}" aria-label="Mental scratchpad"><div class="scratch-head"><span>Working memory support</span><strong>${esc(level)}</strong></div>${items.length ? items.map(item => `<div class="scratch-line">${esc(item.display || item)}</div>`).join("") : `<div class="scratch-empty">Derived values will stay here.</div>`}</aside>`;
}

function answerForm(question, choices, disabled = false) {
    if (choices) return `<form data-form="answer" class="choice-grid">${choices.map((choice, index) => `<button type="submit" name="choice" value="${esc(choice)}" ${disabled ? "disabled" : ""}><kbd>${index + 1}</kbd><span>${esc(choice)}</span></button>`).join("")}</form>`;
    return `<form data-form="answer" class="answer-form"><label for="answer-input">Your answer</label><div class="answer-row"><input id="answer-input" name="answer" inputmode="decimal" autocomplete="off" spellcheck="false" aria-label="Your answer" ${disabled ? "disabled" : ""}><button class="button" type="submit" ${disabled ? "disabled" : ""}>Submit <kbd>↵</kbd></button></div><small>Fractions accepted as 3/4 · Decimals use a tolerance</small></form>`;
}

function renderWorksheet(session, revealAnswer = false) {
    const question = session.question;
    const step = question.scaffold?.[session.scaffoldIndex];
    const completed = session.scratch.length ? `<div class="worksheet-completed">${session.scratch.map((line, index) => `<div><span>${index + 1}</span><strong>${esc(line.display || line)}</strong><i>✓</i></div>`).join("")}</div>` : "";
    if (!step && !revealAnswer) return `<div class="scaffold-card worksheet-card complete"><div class="scaffold-progress"><span>Build it back up</span><strong>Steps complete</strong></div>${completed}<p>Use the intermediate values above to answer the original problem.</p></div>`;
    if (!step) return `<div class="worked-route"><div class="eyebrow">Build back to the full answer</div>${completed}<div>You rebuilt the route. Carry these values into the full answer.</div></div>`;
    const options = step.options?.map(value => `<button type="submit" name="scaffoldAnswer" value="${esc(value)}">${esc(value)}</button>`).join("");
    return `<div class="scaffold-card worksheet-card"><div class="scaffold-progress"><span>Break it down</span><strong>Step ${session.scaffoldIndex + 1} / ${question.scaffold.length}</strong></div>${completed}<p>${esc(step.prompt)}</p>
        <form data-form="scaffold" class="${options ? "scaffold-options" : "mini-answer"}">${options || `<input name="scaffoldAnswer" inputmode="decimal" autocomplete="off" aria-label="Intermediate answer"><button class="button small" type="submit">Check step</button>`}</form>
        ${session.scaffoldError ? `<div class="step-error" role="alert">${esc(session.scaffoldError)}</div>` : ""}
    </div>`;
}

function renderFeedback(session) {
    const feedback = session.feedback;
    if (!feedback) return "";
    if (feedback.correct) return `<section class="feedback correct" aria-live="polite"><div class="feedback-mark">✓</div><div><div class="eyebrow">Correct · ${seconds(feedback.responseMs / 1000)}</div><h3>Clean execution.</h3><p>${session.scratch.length ? "Your intermediate work stays visible so you can reinforce the build-up." : "Answer accepted before the 15-second limit."}</p><button class="text-button" data-action="next-question">Next question <kbd>↵</kbd></button></div></section>`;
    const selectedError = feedback.userError || feedback.error;
    const breakdown = needsBreakdown(session.question, selectedError, session.helpActive);
    const errorSelect = `<label class="error-label">What happened?<select data-action="override-error" data-attempt="${esc(feedback.attemptId)}"><option value="${esc(selectedError)}">${esc(selectedError)}</option>${["I didn't know how", "I knew how but made a mistake", "I forgot an intermediate number", "I ran out of time"].filter(value => value !== selectedError).map(value => `<option>${esc(value)}</option>`).join("")}</select></label>`;
    if (!breakdown) {
        const correction = quickCorrection(session.question);
        return `<section class="feedback incorrect concise-correction" aria-live="polite"><div class="feedback-mark">×</div><div class="feedback-copy"><div class="eyebrow">Not quite · ${esc(selectedError)}</div><h3>Correct it, then retrieve it again.</h3><p>This one does not need a worksheet. Keep the correction short and let it resurface later.</p>${errorSelect}<div class="quick-correction"><span>Correct answer</span><strong>${esc(correction.answer)}</strong>${correction.check ? `<small>Quick check: ${esc(correction.check)}</small>` : ""}</div><button class="text-button" data-action="next-question">Next question <kbd>↵</kbd></button></div></section>`;
    }
    const earned = session.scaffoldCorrect > 0;
    return `<section class="feedback incorrect" aria-live="polite"><div class="feedback-mark">×</div><div class="feedback-copy"><div class="eyebrow">Not quite · ${esc(selectedError)}</div><h3>Build it back up.</h3><p>Solve one subproblem correctly before moving on. Each step only advances after a correct answer.</p>${errorSelect}${renderWorksheet(session, true)}<button class="text-button ${earned ? "" : "muted"}" data-action="next-question" ${earned ? "" : "disabled"}>${earned ? "Continue to next question" : "Complete one step correctly to continue"} ${earned ? "<kbd>↵</kbd>" : ""}</button></div></section>`;
}

function renderSession() {
    const session = state.session;
    if (!session) return;
    const question = session.question;
    const test = session.mode === "test" || session.mode === "calibration";
    const label = session.mode === "focus" ? "Focus practice" : session.mode === "daily" ? "Daily training" : session.mode === "review" ? "Mistake review" : session.mode === "calibration" ? "Skill calibration" : session.mode === "test" ? "Timed test" : "Adaptive learn";
    const remaining = session.deadline ? Math.max(0, session.deadline - Date.now()) : 0;
    const questionRemaining = Math.max(0, session.questionDeadline - Date.now());
    app.innerHTML = `<div class="session-shell ${test ? "test-shell" : "learn-shell"}">
        <header class="session-bar"><button class="icon-button" data-action="exit-session" aria-label="Exit session">×</button><div><div class="eyebrow">${esc(label)}</div><div class="progress-line"><span style="width:${(session.index / session.total) * 100}%"></span></div></div>
            <div class="session-stat"><span>Question</span><strong>${session.index + 1} / ${session.total}</strong></div>
            <div class="session-stat question-timer-stat"><span>Question clock</span><strong id="question-timer-value">${formatQuestionTimer(questionRemaining)}</strong></div>
            ${test ? `<div class="session-stat timer-stat"><span>Test remaining</span><strong id="timer-value">${formatTimer(remaining)}</strong></div>${state.profile.settings.showTestScore ? `<div class="session-stat score-stat"><span>Score</span><strong>${session.correct}</strong></div>` : ""}` : `<div class="session-stat streak-stat"><span>Streak</span><strong>${state.profile.skills[question.skillKey]?.streak || 0}</strong></div>`}
        </header>
        <div class="question-layout">
            <main class="question-stage">
                ${test ? "" : `<div class="question-tags"><span>${esc(SKILL_LABELS[question.skillKey] || question.skillKey)}</span><span>Level ${question.difficulty}</span>${question.gap ? "<span>Gap</span>" : ""}</div>`}
                <div class="question-number">${esc(question.prompt)}<span>= ?</span></div>
                ${!test && session.helpActive && !session.feedback ? renderWorksheet(session, false) : ""}
                ${session.feedback ? "" : answerForm(question, session.choices)}
                ${!test && !session.feedback ? `<div class="question-tools"><button class="quiet-button" data-action="show-help">${session.helpActive ? "Subproblem worksheet open" : "Break into subproblems"}</button><span>15 seconds · Enter to submit</span></div>` : ""}
                ${!test ? renderFeedback(session) : ""}
            </main>
            ${!test ? renderScratch(session) : ""}
        </div>
    </div>`;
    startTimerLoop();
}

function submitMainAnswer(rawAnswer) {
    const session = state.session;
    if (!session || session.feedback || session.locked) return;
    session.locked = true;
    const question = session.question;
    const responseMs = Date.now() - session.questionStartedAt;
    const timedOut = responseMs >= 15000;
    const correct = !timedOut && validateAnswer(question, rawAnswer);
    const recordedTime = Math.min(responseMs, 15000);
    const result = recordAttempt(state.profile, question, timedOut ? "—" : rawAnswer, correct, recordedTime, session.mode, session.id, timedOut ? "Ran out of time" : null);
    session.attempts.push(result.entry);
    session.correct += correct ? 1 : 0;

    if (session.mode === "test" || session.mode === "calibration") {
        session.index += 1;
        nextQuestion();
        return;
    }
    session.feedback = { correct, responseMs: recordedTime, error: timedOut ? "Ran out of time" : result.inferredError, attemptId: result.entry.id };
    renderSession();
    if (!correct) requestAnimationFrame(() => app.querySelector("[data-form='scaffold'] input")?.focus());
}

function submitScaffold(rawAnswer) {
    const session = state.session;
    const step = session?.question.scaffold?.[session.scaffoldIndex];
    if (!step) return;
    const target = Number(step.answer);
    const actual = parseAnswer(rawAnswer);
    const correct = Number.isFinite(actual) && Math.abs(actual - target) <= Math.max(.0001, Math.abs(target) * .00001);
    const shownAnswer = step.answerDisplay || String(step.answer);
    if (!correct) {
        session.scaffoldMistakes += 1;
        session.scaffoldError = "Not yet. Rework this same step—nothing advances until it is correct.";
        renderSession();
        requestAnimationFrame(() => app.querySelector("[data-form='scaffold'] input")?.focus());
        return;
    }
    session.scaffoldError = "";
    recordBreakdownStep(state.profile, step, session.scaffoldMistakes === 0, Date.now() - session.scaffoldStepStartedAt, `${session.id}:${session.index}:${session.scaffoldIndex}`);
    session.scaffoldCorrect += 1;
    session.scratch.push({ display: formatCompletedStep(step, shownAnswer) });
    session.scaffoldIndex += 1;
    session.scaffoldMistakes = 0;
    session.scaffoldStepStartedAt = Date.now();
    renderSession();
    requestAnimationFrame(() => app.querySelector("[data-form='scaffold'] input")?.focus());
}

function handleQuestionTimeout() {
    const session = state.session;
    if (!session || session.feedback || session.locked) return;
    session.locked = true;
    const result = recordAttempt(state.profile, session.question, "—", false, 15000, session.mode, session.id, "Ran out of time");
    session.attempts.push(result.entry);
    if (session.mode === "test" || session.mode === "calibration") {
        session.index += 1;
        nextQuestion();
        return;
    }
    session.feedback = { correct: false, responseMs: 15000, error: "Ran out of time", attemptId: result.entry.id };
    renderSession();
    requestAnimationFrame(() => app.querySelector("[data-form='scaffold'] input")?.focus());
}

function advanceLearn() {
    const session = state.session;
    if (!session) return;
    const selectedError = session.feedback?.userError || session.feedback?.error;
    if (session.feedback && !session.feedback.correct && needsBreakdown(session.question, selectedError, session.helpActive) && session.scaffoldCorrect < 1) return;
    session.index += 1;
    nextQuestion();
}

function finishLearn() {
    const session = state.session;
    if (!session) return;
    clearTimer();
    state.profile.sessionCount += 1;
    saveProfile(state.profile);
    const duration = Math.max(1, Math.round((Date.now() - session.startedAt) / 60000));
    const improvements = SKILL_KEYS.map(key => ({ key, delta: state.profile.skills[key].rating - session.baseline[key] })).filter(item => item.delta > 0).sort((a, b) => b.delta - a.delta).slice(0, 2);
    const weak = weakestSkills(state.profile, 2);
    state.session = null;
    state.view = "summary";
    app.innerHTML = `<section class="result-page concise"><div class="eyebrow mint">Session complete</div><h1>Good work.<br><span>Keep the edge.</span></h1>
        <div class="result-kpis"><div><span>Duration</span><strong>${duration} min</strong></div><div><span>Questions</span><strong>${session.total}</strong></div><div><span>Accuracy</span><strong>${pct(session.correct / session.total)}</strong></div></div>
        <div class="summary-grid"><div class="panel"><div class="eyebrow">Improved</div>${improvements.length ? improvements.map(item => `<div class="summary-row"><span>${esc(SKILL_LABELS[item.key])}</span><strong>+${item.delta}</strong></div>`).join("") : `<p>Your ratings stabilize after several observations. Keep going.</p>`}</div>
        <div class="panel"><div class="eyebrow">Needs work</div>${weak.map(item => `<div class="summary-row"><span>${esc(item.label)}</span><strong>${item.rating}/100</strong></div>`).join("")}</div></div>
        <button class="button primary-action" data-action="start-focus">Practice weak areas <span>→</span></button>
        <button class="quiet-button" data-view="dashboard">Return to desk</button>
    </section>`;
    updateChrome();
}

function renderTestSetup() {
    app.innerHTML = `<section class="setup-page"><div class="eyebrow amber-text">Timed assessment</div><h1>Configure your test.</h1><p>Accuracy is weighted before speed. Fast wrong answers never improve your performance score.</p>
        <form data-form="test-setup" class="setup-form">
            <fieldset><legend>Questions</legend><div class="segmented"><label><input type="radio" name="count" value="10" checked><span>10</span></label><label><input type="radio" name="count" value="20"><span>20</span></label><label><input type="radio" name="count" value="40"><span>40</span></label><label><input type="radio" name="count" value="60"><span>60</span></label></div></fieldset>
            <fieldset><legend>Time limit</legend><div class="segmented"><label><input type="radio" name="minutes" value="2"><span>2 min</span></label><label><input type="radio" name="minutes" value="5" checked><span>5 min</span></label><label><input type="radio" name="minutes" value="10"><span>10 min</span></label><label><input type="radio" name="minutes" value="custom"><span>Custom</span></label></div><label class="custom-time">Custom minutes<input type="number" name="customMinutes" min="1" max="60" value="7"></label></fieldset>
            <fieldset><legend>Answer format</legend><div class="segmented three"><label><input type="radio" name="format" value="typed"><span>Typed</span></label><label><input type="radio" name="format" value="mixed" checked><span>Mixed</span></label><label><input type="radio" name="format" value="choice"><span>Multiple choice</span></label></div></fieldset>
            <div class="setup-note"><span>Test protocol</span><ul><li>15 seconds per question</li><li>No hints or explanations</li><li>Detailed post-test review</li></ul></div>
            <button class="button wide" type="submit">Start test <span>→</span></button>
        </form>
    </section>`;
}

function startTest(count, minutes, format = "mixed", mode = "test") {
    state.session = {
        id: sessionId(), mode, total: count, index: 0, correct: 0, startedAt: Date.now(),
        deadline: Date.now() + minutes * 60000, question: null, questionStartedAt: Date.now(),
        format, attempts: [], previousType: null, helpActive: false, scaffoldIndex: 0, scratch: [], locked: false
    };
    state.view = "session";
    nextQuestion();
}

function formatTimer(ms) {
    const totalSeconds = Math.ceil(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const secondsPart = totalSeconds % 60;
    return `${String(minutes).padStart(2, "0")}:${String(secondsPart).padStart(2, "0")}`;
}

function formatQuestionTimer(ms) {
    return `${Math.max(0, Math.ceil(ms / 1000))}s`;
}

function startTimerLoop() {
    if (state.timer) return;
    state.timer = window.setInterval(() => {
        const session = state.session;
        if (!session || state.view !== "session") return clearTimer();
        if (session.deadline) {
            const remaining = session.deadline - Date.now();
            const output = document.querySelector("#timer-value");
            if (output) output.textContent = formatTimer(Math.max(0, remaining));
            if (remaining <= 0) { finishTest(); return; }
        }
        const questionRemaining = session.questionDeadline - Date.now();
        const questionOutput = document.querySelector("#question-timer-value");
        if (questionOutput) {
            questionOutput.textContent = formatQuestionTimer(Math.max(0, questionRemaining));
            questionOutput.classList.toggle("urgent", questionRemaining <= 5000);
        }
        if (questionRemaining <= 0) handleQuestionTimeout();
    }, 250);
}

function clearTimer() {
    if (state.timer) window.clearInterval(state.timer);
    state.timer = null;
}

function aggregateAttempts(attempts) {
    const groups = {};
    attempts.forEach(item => {
        const key = item.skillKey;
        groups[key] ||= { key, total: 0, correct: 0, times: [] };
        groups[key].total += 1;
        groups[key].correct += item.correct ? 1 : 0;
        groups[key].times.push(item.responseMs / 1000);
    });
    return Object.values(groups).map(group => ({ ...group, accuracy: group.correct / group.total, median: median(group.times) }));
}

function finishTest() {
    const session = state.session;
    if (!session) return;
    clearTimer();
    const answered = session.attempts.length;
    const times = session.attempts.map(item => item.responseMs / 1000);
    const groups = aggregateAttempts(session.attempts);
    const result = {
        id: session.id, date: new Date().toISOString(), mode: session.mode,
        score: session.correct, total: session.total, answered,
        accuracy: answered ? session.correct / answered : 0,
        averageTime: times.length ? times.reduce((a, b) => a + b, 0) / times.length : 0,
        medianTime: median(times), durationMs: Date.now() - session.startedAt,
        attempts: session.attempts.map(item => item.id)
    };
    completeTest(state.profile, result);
    const finished = { ...session, result, groups };
    state.session = finished;
    state.view = "test-results";
    renderTestResults();
}

function renderTestResults() {
    const session = state.session;
    const result = session.result;
    const groups = [...session.groups].sort((a, b) => b.accuracy - a.accuracy || a.median - b.median);
    const strongest = groups.slice(0, 2);
    const weakest = [...groups].sort((a, b) => a.accuracy - b.accuracy || b.median - a.median).slice(0, 3);
    const misses = session.attempts.filter(item => !item.correct);
    app.innerHTML = `<section class="result-page"><div class="result-heading"><div><div class="eyebrow mint">Assessment complete</div><h1>${result.score} <span>/ ${result.total}</span></h1><p>${result.answered < result.total ? `Time expired after ${result.answered} answered questions.` : "Full test completed."}</p></div><div class="score-ring" style="--score:${Math.round(result.accuracy * 100)}"><strong>${pct(result.accuracy)}</strong><span>accuracy</span></div></div>
        <div class="result-kpis"><div><span>Score</span><strong>${result.score} / ${result.total}</strong></div><div><span>Median response</span><strong>${seconds(result.medianTime)}</strong></div><div><span>Average response</span><strong>${seconds(result.averageTime)}</strong></div><div><span>Answered</span><strong>${result.answered}</strong></div></div>
        <div class="summary-grid"><div class="panel"><div class="eyebrow">Strongest</div>${strongest.length ? strongest.map(item => `<div class="summary-row"><span>${esc(SKILL_LABELS[item.key] || item.key)}</span><strong>${pct(item.accuracy)}</strong></div>`).join("") : "<p>No category data yet.</p>"}</div><div class="panel"><div class="eyebrow">Weakest</div>${weakest.length ? weakest.map(item => `<div class="summary-row"><span>${esc(SKILL_LABELS[item.key] || item.key)}</span><strong>${pct(item.accuracy)}</strong></div>`).join("") : "<p>No category data yet.</p>"}</div></div>
        <div class="result-actions">${misses.length ? `<button class="button" data-action="review-mistakes">Review mistakes</button>` : ""}<button class="button secondary" data-action="practice-like-test">Practice questions like these</button><button class="quiet-button" data-view="analytics">Open analytics</button></div>
        <section class="review-list"><div class="section-heading"><div><div class="eyebrow">Question log</div><h2>Detailed review</h2></div></div>
            ${session.attempts.map((item, index) => `<details class="review-item ${item.correct ? "correct" : "incorrect"}"><summary><span class="review-index">${String(index + 1).padStart(2, "0")}</span><strong>${esc(item.prompt)}</strong><span>${item.correct ? "Correct" : "Missed"}</span><time>${seconds(item.responseMs / 1000)}</time></summary><div class="review-detail"><div><small>Your answer</small><strong>${esc(item.userAnswer)}</strong></div><div><small>Correct answer</small><strong>${esc(item.answer)}</strong></div><div><small>Category</small><strong>${esc(SKILL_LABELS[item.skillKey] || item.skillKey)} · L${item.difficulty}</strong></div><div><small>Recommended shortcut</small><strong>${esc(formatStrategyName(item.strategy))}</strong></div></div></details>`).join("")}
        </section>
    </section>`;
    updateChrome();
}

function filteredHistory() {
    const f = state.filters;
    const rows = state.profile.history.filter(item =>
        (f.type === "all" || item.type === f.type) &&
        (f.operator === "all" || item.operator === f.operator) &&
        (f.result === "all" || String(item.correct) === f.result) &&
        (f.gap === "all" || String(item.gap) === f.gap) &&
        (f.difficulty === "all" || String(item.difficulty) === f.difficulty) &&
        (f.mode === "all" || item.mode === f.mode) &&
        (f.period === "all" || Date.now() - new Date(item.date).getTime() <= Number(f.period) * 86400000)
    );
    const { key, direction } = state.sort;
    return rows.sort((a, b) => {
        let av = key === "time" ? a.responseMs : key === "date" ? new Date(a.date).getTime() : a[key];
        let bv = key === "time" ? b.responseMs : key === "date" ? new Date(b.date).getTime() : b[key];
        if (typeof av === "string") return direction === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
        return direction === "asc" ? Number(av) - Number(bv) : Number(bv) - Number(av);
    });
}

function factCell(key, equation, answer) {
    const fact = factSummary(state.profile, key);
    const detail = fact.attempts
        ? `${Math.round(fact.accuracy * 100)}% correct · ${seconds(fact.avgTime)} average · ${fact.attempts} attempt${fact.attempts === 1 ? "" : "s"}`
        : "Not measured yet";
    return `<div class="fact-cell ${fact.status}" title="${esc(`${equation} = ${answer} · ${detail}`)}" aria-label="${esc(`${equation} equals ${answer}. ${fact.status}. ${detail}`)}"><strong>${answer}</strong></div>`;
}

function renderFactMastery() {
    const operation = state.factMatrix;
    const matrixHeaders = Array.from({ length: 100 }, (_, index) => `<div class="matrix-axis">${(index + 1) % 10 === 0 || index === 0 ? index + 1 : ""}</div>`).join("");
    const matrixRows = Array.from({ length: 100 }, (_, rowIndex) => {
        const left = rowIndex + 1;
        const cells = Array.from({ length: 100 }, (_, columnIndex) => {
            const right = columnIndex + 1;
            const key = operation === "addition" ? `add:${left}x${right}` : `subtract:${left}x${right}`;
            const fact = factSummary(state.profile, key);
            const symbol = operation === "addition" ? "+" : "−";
            const result = operation === "addition" ? left + right : left - right;
            const detail = fact.attempts ? `${Math.round(fact.accuracy * 100)}% first-try · ${seconds(fact.avgTime)} · ${fact.attempts} completed breakdown${fact.attempts === 1 ? "" : "s"}` : "Not yet seen in a breakdown";
            return `<div class="matrix-cell ${fact.status}" title="${esc(`${left} ${symbol} ${right} = ${result} · ${detail}`)}" aria-label="${esc(`${left} ${symbol} ${right} equals ${result}. ${fact.status}. ${detail}`)}"></div>`;
        }).join("");
        return `<div class="matrix-axis row-axis">${left % 10 === 0 || left === 1 ? left : ""}</div>${cells}`;
    }).join("");
    const timesHeader = Array.from({ length: 15 }, (_, index) => `<div class="fact-axis">${index + 1}</div>`).join("");
    const timesRows = Array.from({ length: 15 }, (_, rowIndex) => {
        const left = rowIndex + 1;
        const cells = Array.from({ length: 15 }, (_, columnIndex) => {
            const right = columnIndex + 1;
            const key = `times:${left}x${right}`;
            return factCell(key, `${left} × ${right}`, left * right);
        }).join("");
        return `<div class="fact-axis">${left}</div>${cells}`;
    }).join("");
    const squareCells = Array.from({ length: 25 }, (_, index) => {
        const value = index + 1;
        const fact = factSummary(state.profile, `square:${value}`);
        const detail = fact.attempts ? `${Math.round(fact.accuracy * 100)}% · ${seconds(fact.avgTime)}` : "Not measured";
        return `<div class="square-fact ${fact.status}" title="${esc(`${value}² = ${value * value} · ${detail}`)}"><span>${value}²</span><strong>${value * value}</strong></div>`;
    }).join("");
    return `<section class="fact-mastery-section"><div class="section-heading"><div><div class="eyebrow">Breakdown mastery</div><h2>Subproblem-strength grids</h2><p>Worksheet steps and Base Facts sessions both update these grids. Retries count as one first-attempt miss, while direct fact drills record one observation per prompt.</p></div><div class="fact-legend"><span class="strong">Strong</span><span class="developing">Developing</span><span class="weak">Weak</span><span class="unmeasured">Unmeasured</span></div></div>
        <div class="fact-board matrix-board"><div class="fact-board-heading"><div><h3>Addition and subtraction · 100 × 100</h3><span>One cell per completed breakdown step</span></div><div class="matrix-switch" role="group" aria-label="Choose operation matrix"><button class="${operation === "addition" ? "active" : ""}" data-action="set-fact-matrix" data-operation="addition">Addition</button><button class="${operation === "subtraction" ? "active" : ""}" data-action="set-fact-matrix" data-operation="subtraction">Subtraction</button></div></div><div class="mastery-matrix-wrap"><div class="mastery-matrix"><div class="matrix-axis corner">${operation === "addition" ? "+" : "−"}</div>${matrixHeaders}${matrixRows}</div></div></div>
        <div class="fact-board"><div class="fact-board-heading"><div><h3>Multiplication / division · shared 15 × 15</h3><span>A ÷ B updates the matching B × quotient fact</span></div><span>Rows × columns</span></div><div class="times-grid-wrap"><div class="times-grid"><div class="fact-axis corner">×÷</div>${timesHeader}${timesRows}</div></div></div><div class="fact-board"><div class="fact-board-heading"><h3>Squares through 25²</h3><span>Base Facts emphasizes 15² through 20²</span></div><div class="squares-grid">${squareCells}</div></div></section>`;
}

function renderAnalytics() {
    const summaries = SKILL_KEYS.map(key => skillSummary(state.profile, key));
    const rated = summaries.filter(item => item.attempts);
    const rows = filteredHistory().slice(0, 120);
    const weak = weakestSkills(state.profile, 3);
    const attempts = state.profile.history.length;
    app.innerHTML = `<section class="analytics-page"><div class="page-heading"><div><div class="eyebrow mint">Performance intelligence</div><h1>Accuracy first.<br><span>Then speed.</span></h1></div><button class="quiet-button" data-action="export-data">Export local data</button></div>
        <div class="analytics-kpis"><div><span>Total attempts</span><strong>${attempts}</strong></div><div><span>Overall accuracy</span><strong>${attempts ? pct(state.profile.history.filter(item => item.correct).length / attempts) : "—"}</strong></div><div><span>Current focus</span><strong>${esc(weak[0].label)}</strong></div><div><span>Tests completed</span><strong>${state.profile.tests.length}</strong></div></div>
        <section class="analytics-grid"><article class="panel scatter-panel"><div class="panel-top"><div><div class="eyebrow">Category map</div><h3>Accuracy vs response time</h3></div><div class="legend"><span>Strong</span><span>Developing</span></div></div>
            <div class="scatter"><span class="axis y">Slower ↑</span><span class="axis x">Accuracy →</span><div class="target-zone">Target zone</div>${rated.map(item => { const left = Math.max(4, Math.min(92, item.accuracy * 100)); const top = Math.max(5, Math.min(88, item.medianTime / 20 * 100)); return `<button class="scatter-dot ${item.ratingLabel.toLowerCase()}" style="left:${left}%;top:${top}%" title="${esc(item.label)}: ${pct(item.accuracy)}, ${seconds(item.medianTime)}"><span>${esc(item.label.replace(/(Integer|Decimal|Fraction|Percentage) /, ""))}</span></button>`; }).join("")}</div>
        </article><article class="panel mastery-panel"><div class="panel-top"><div><div class="eyebrow">Adaptive model</div><h3>Skill mastery</h3></div></div><div class="mastery-list">${summaries.slice().sort((a,b) => b.attempts - a.attempts || a.rating - b.rating).slice(0, 8).map(item => `<div><span>${esc(item.label)}</span><div class="mastery-bar"><i style="width:${item.attempts ? item.rating : 4}%"></i></div><strong>${item.attempts ? item.rating : "—"}</strong></div>`).join("")}</div></article></section>
        ${renderFactMastery()}
        <section class="table-section"><div class="section-heading"><div><div class="eyebrow">Attempt ledger</div><h2>Performance table</h2></div><span>${rows.length} shown</span></div>
            <div class="filter-row"><label>Type<select data-filter="type"><option value="all">All types</option>${["integer","decimal","fraction","percentage","mixed"].map(value => `<option value="${value}" ${state.filters.type === value ? "selected" : ""}>${value}</option>`).join("")}</select></label><label>Operator<select data-filter="operator"><option value="all">All operators</option>${["addition","subtraction","multiplication","division"].map(value => `<option value="${value}" ${state.filters.operator === value ? "selected" : ""}>${value}</option>`).join("")}</select></label><label>Gap<select data-filter="gap"><option value="all">All</option><option value="true" ${state.filters.gap === "true" ? "selected" : ""}>Yes</option><option value="false" ${state.filters.gap === "false" ? "selected" : ""}>No</option></select></label><label>Difficulty<select data-filter="difficulty"><option value="all">All levels</option>${[1,2,3,4,5,6].map(value => `<option value="${value}" ${state.filters.difficulty === String(value) ? "selected" : ""}>Level ${value}</option>`).join("")}</select></label><label>Result<select data-filter="result"><option value="all">All</option><option value="true" ${state.filters.result === "true" ? "selected" : ""}>Correct</option><option value="false" ${state.filters.result === "false" ? "selected" : ""}>Incorrect</option></select></label><label>Session<select data-filter="mode"><option value="all">All sessions</option>${["learn","daily","focus","review","test","calibration"].map(value => `<option value="${value}" ${state.filters.mode === value ? "selected" : ""}>${value}</option>`).join("")}</select></label><label>Date<select data-filter="period"><option value="all">All dates</option><option value="1" ${state.filters.period === "1" ? "selected" : ""}>Today</option><option value="7" ${state.filters.period === "7" ? "selected" : ""}>Last 7 days</option><option value="30" ${state.filters.period === "30" ? "selected" : ""}>Last 30 days</option></select></label></div>
            <div class="table-wrap"><table><thead><tr><th><button data-sort="type">Type</button></th><th><button data-sort="operator">Operator</button></th><th>Gap</th><th><button data-sort="difficulty">Difficulty</button></th><th>Result</th><th><button data-sort="time">Time</button></th><th><button data-sort="date">Date</button></th></tr></thead><tbody>${rows.length ? rows.map(item => `<tr><td>${esc(item.type)}</td><td>${esc(item.operator)}</td><td>${item.gap ? "Yes" : "No"}</td><td>L${item.difficulty}</td><td><span class="result-pill ${item.correct ? "correct" : "incorrect"}">${item.correct ? "Correct" : "Missed"}</span></td><td>${seconds(item.responseMs / 1000)}</td><td>${dateLabel(item.date)}</td></tr>`).join("") : `<tr><td colspan="7" class="empty-table">Complete a session to populate your performance ledger.</td></tr>`}</tbody></table></div>
        </section>
    </section>`;
}

function renderLibrary() {
    app.innerHTML = `<section class="library-page"><div class="page-heading"><div><div class="eyebrow mint">Reusable mental models</div><h1>Strategy library.</h1><p>Transform hard arithmetic into small, reliable operations. These cues appear adaptively during Learn mode.</p></div></div>
        <div class="strategy-grid">${STRATEGIES.map((strategy, index) => `<article class="strategy-card"><div class="strategy-index">${String(index + 1).padStart(2, "0")} / ${esc(strategy.group)}</div><h2>${esc(strategy.title)}</h2><p>${esc(strategy.summary)}</p><div class="worked-example">${strategy.example.map((line, lineIndex) => `<div class="${lineIndex === strategy.example.length - 1 ? "answer" : ""}">${esc(line)}</div>`).join("")}</div><div class="cue"><span>Recognition cue</span>${esc(strategy.cue)}</div></article>`).join("")}</div>
        <section class="facts-section"><div class="section-heading"><div><div class="eyebrow">Retrieval deck</div><h2>Facts worth making automatic</h2></div></div><div class="fact-tabs"><article><h3>Squares 1²–25²</h3><div class="fact-grid">${FACTS.squares.map(item => `<span><b>${item.left}</b>${item.right}</span>`).join("")}</div></article><article><h3>Fraction equivalents</h3><div class="fact-grid compact">${FACTS.fractions.map(item => `<span><b>${item.left}</b>${item.right}</span>`).join("")}</div><h3>Powers of two</h3><div class="fact-grid compact">${FACTS.powers.map(item => `<span><b>${item.left}</b>${item.right}</span>`).join("")}</div></article></div></section>
    </section>`;
}

function renderSettings() {
    app.innerHTML = `<section class="settings-page"><div class="page-heading"><div><div class="eyebrow mint">Local preferences</div><h1>Training settings.</h1><p>Your profile and history stay in this browser. No sign-in is required.</p></div></div>
        <div class="settings-panel"><div class="setting-row"><div><h3>Working Memory Support</h3><p>Preserves intermediate values you have already derived. It is a scratchpad, not a calculator.</p></div><select data-setting="workingMemory" aria-label="Working Memory Support"><option value="off" ${state.profile.settings.workingMemory === "off" ? "selected" : ""}>Off</option><option value="minimal" ${state.profile.settings.workingMemory === "minimal" ? "selected" : ""}>Minimal</option><option value="guided" ${state.profile.settings.workingMemory === "guided" ? "selected" : ""}>Guided</option></select></div>
            <div class="setting-row"><div><h3>Show score during tests</h3><p>Hide it if live scoring adds distraction during timed work.</p></div><label class="switch"><input type="checkbox" data-setting="showTestScore" aria-label="Show score during tests" ${state.profile.settings.showTestScore ? "checked" : ""}><span></span></label></div>
            <div class="setting-row danger"><div><h3>Reset local profile</h3><p>Removes training history, ratings, test scores, and settings from this browser.</p></div><button class="quiet-button" data-action="reset-profile">Reset data</button></div>
        </div>
    </section>`;
}

function render() {
    updateChrome();
    if (state.view === "dashboard") renderDashboard();
    else if (state.view === "test-setup") renderTestSetup();
    else if (state.view === "analytics") renderAnalytics();
    else if (state.view === "library") renderLibrary();
    else if (state.view === "settings") renderSettings();
    else if (state.view === "session") renderSession();
    else if (state.view === "fact-drill") renderFactDrill();
    else if (state.view === "test-results") renderTestResults();
}

document.addEventListener("click", event => {
    const viewButton = event.target.closest("[data-view]");
    if (viewButton) { setView(viewButton.dataset.view); return; }
    const action = event.target.closest("[data-action]")?.dataset.action;
    if (!action) return;
    if (action === "set-fact-matrix") {
        state.factMatrix = event.target.closest("[data-operation]").dataset.operation;
        renderAnalytics();
        return;
    }
    if (action === "start-learn") startLearn("learn");
    if (action === "start-daily") startLearn("daily");
    if (action === "start-focus") startLearn("focus");
    if (action === "start-facts") startFactDrill();
    if (action === "test-setup") { state.view = "test-setup"; render(); }
    if (action === "start-calibration") startTest(20, 8, "mixed", "calibration");
    if (action === "show-help") {
        state.session.helpActive = true;
        renderSession();
        requestAnimationFrame(() => {
            const input = app.querySelector("[data-form='scaffold'] input");
            if (input) input.focus(); else focusAnswer();
        });
    }
    if (action === "next-question") advanceLearn();
    if (action === "exit-session") { if (window.confirm("End this session and return to the training desk?")) setView("dashboard"); }
    if (action === "exit-facts") { if (window.confirm("End this Base Facts session?")) setView("dashboard"); }
    if (action === "next-fact") advanceFactDrill();
    if (action === "review-mistakes") startLearn("review", null, state.session.attempts.filter(item => !item.correct));
    if (action === "practice-like-test") { const key = [...state.session.groups].sort((a, b) => a.accuracy - b.accuracy)[0]?.key; startLearn("focus", key); }
    if (action === "export-data") {
        const blob = new Blob([exportProfile(state.profile)], { type: "application/json" });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob); link.download = `quant-prep-profile-${new Date().toISOString().slice(0, 10)}.json`; link.click(); URL.revokeObjectURL(link.href);
    }
    if (action === "reset-profile" && window.confirm("Reset all local Mental Math data? This cannot be undone.")) { state.profile = resetProfile(); setView("dashboard"); }
    const sortButton = event.target.closest("[data-sort]");
    if (sortButton) {
        const key = sortButton.dataset.sort;
        state.sort = { key, direction: state.sort.key === key && state.sort.direction === "desc" ? "asc" : "desc" };
        renderAnalytics();
    }
});

document.addEventListener("submit", event => {
    const form = event.target;
    if (!form.dataset.form) return;
    event.preventDefault();
    const data = new FormData(form);
    if (form.dataset.form === "answer") submitMainAnswer(data.get("choice") ?? data.get("answer"));
    if (form.dataset.form === "scaffold") submitScaffold(data.get("scaffoldAnswer"));
    if (form.dataset.form === "fact-answer") submitFactAnswer(data.get("answer"));
    if (form.dataset.form === "test-setup") {
        const minutes = data.get("minutes") === "custom" ? Number(data.get("customMinutes")) : Number(data.get("minutes"));
        startTest(Number(data.get("count")), Math.max(1, Math.min(60, minutes || 5)), data.get("format"));
    }
});

document.addEventListener("change", event => {
    const filter = event.target.dataset.filter;
    if (filter) { state.filters[filter] = event.target.value; renderAnalytics(); return; }
    const setting = event.target.dataset.setting;
    if (setting) {
        state.profile.settings[setting] = event.target.type === "checkbox" ? event.target.checked : event.target.value;
        saveProfile(state.profile);
    }
    if (event.target.dataset.action === "override-error") {
        overrideError(state.profile, event.target.dataset.attempt, event.target.value);
        if (state.session?.feedback) state.session.feedback.userError = event.target.value;
        renderSession();
    }
});

document.addEventListener("keydown", event => {
    if (state.view !== "session") return;
    const session = state.session;
    if ((session.mode === "test" || session.mode === "calibration") && /^[1-4]$/.test(event.key) && session.choices) {
        const choice = session.choices[Number(event.key) - 1];
        if (choice !== undefined) { event.preventDefault(); submitMainAnswer(choice); }
    }
    if (event.key === "Enter" && session.feedback && !event.target.closest("form") && event.target.tagName !== "SELECT") { event.preventDefault(); advanceLearn(); }
    if (event.key === "Escape") document.querySelector("[data-action='exit-session']")?.click();
});

render();
