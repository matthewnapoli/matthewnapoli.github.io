const STORAGE_KEY = "qip-theory-mastery-v1";
const DAY = 86400000;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export function normalize(value) {
    return String(value || "")
        .toLowerCase()
        .replaceAll("β", "beta").replaceAll("ε", "epsilon").replaceAll("σ", "sigma")
        .replaceAll("θ", "theta").replaceAll("μ", "mu").replaceAll("λ", "lambda")
        .replaceAll("π", "pi").replaceAll("ᵀ", " transpose ").replaceAll("−", "-")
        .replace(/\^\s*t\b/g, " transpose ").replace(/\bt\s*\^/g, " transpose ")
        .replace(/[^a-z0-9+\-*/=.'|()[\]_^]+/g, " ")
        .replace(/\s+/g, " ").trim();
}

function compact(value) {
    return normalize(value).replace(/[\s.'()[\]{}_^|]/g, "");
}

function includesTerm(answer, term) {
    const normalizedAnswer = normalize(answer);
    const normalizedTerm = normalize(term);
    return normalizedAnswer.includes(normalizedTerm) || compact(answer).includes(compact(term));
}

export function localGrade(question, rawAnswer) {
    if (question.type === "choice") {
        const selected = Number(rawAnswer);
        return {
            correct: selected === question.answer,
            score: selected === question.answer ? 1 : 0,
            passed: selected === question.answer ? ["Correct selection"] : [],
            missing: selected === question.answer ? [] : ["Correct selection"],
            feedback: selected === question.answer ? "Correct." : "That selection does not match the approved answer.",
            source: "local",
            confidence: 1
        };
    }
    const checks = question.checkpoints.map(item => ({ ...item, passed: item.any.some(term => includesTerm(rawAnswer, term)) }));
    const passed = checks.filter(item => item.passed).map(item => item.label);
    const missing = checks.filter(item => !item.passed).map(item => item.label);
    const score = checks.length ? passed.length / checks.length : 0;
    return {
        correct: score >= .8,
        score,
        passed,
        missing,
        feedback: missing.length ? `The local rubric did not find: ${missing.join(", ")}.` : "All required checkpoints were found.",
        source: "local",
        confidence: question.type === "free" ? .68 : 1
    };
}

export function createProfile() {
    return { version: 1, modules: { derivations: {}, models: {} }, history: [] };
}

export function loadProfile(storage = globalThis.localStorage) {
    try {
        const saved = JSON.parse(storage.getItem(STORAGE_KEY));
        return saved && saved.modules ? { ...createProfile(), ...saved, modules: { derivations: {}, models: {}, ...saved.modules } } : createProfile();
    } catch {
        return createProfile();
    }
}

export function saveProfile(profile, storage = globalThis.localStorage) {
    try { storage.setItem(STORAGE_KEY, JSON.stringify(profile)); } catch { /* The module remains usable without persistence. */ }
}

function initialStat() {
    return { attempts: 0, correct: 0, mastery: 0, repetitions: 0, intervalDays: 0, ease: 2.3, dueAt: 0, lastAt: 0 };
}

export function questionStat(profile, moduleName, questionId) {
    return profile.modules[moduleName]?.[questionId] || initialStat();
}

export function recordResult(profile, moduleName, question, result, rawAnswer, skipped = false, now = Date.now()) {
    profile.modules[moduleName] ||= {};
    const current = { ...initialStat(), ...(profile.modules[moduleName][question.id] || {}) };
    const score = clamp(Number(result.score) || 0, 0, 1);
    const quality = score >= .92 ? 4 : score >= .8 ? 3 : score >= .5 ? 2 : 1;
    current.attempts += 1;
    current.correct += result.correct ? 1 : 0;
    current.mastery = Math.round(current.attempts === 1 ? score * 100 : current.mastery * .72 + score * 100 * .28);

    if (quality <= 1) {
        current.repetitions = 0;
        current.intervalDays = 10 / 1440;
        current.ease = clamp(current.ease - .18, 1.3, 3);
    } else if (quality === 2) {
        current.repetitions = 0;
        current.intervalDays = 1;
        current.ease = clamp(current.ease - .08, 1.3, 3);
    } else {
        current.repetitions += 1;
        if (current.repetitions === 1) current.intervalDays = 2;
        else if (current.repetitions === 2) current.intervalDays = 5;
        else current.intervalDays = Math.max(2, Math.round(current.intervalDays * current.ease * (quality === 4 ? 1.2 : 1)));
        current.ease = clamp(current.ease + (quality === 4 ? .08 : .02), 1.3, 3);
    }
    current.lastAt = now;
    current.dueAt = now + current.intervalDays * DAY;
    profile.modules[moduleName][question.id] = current;
    profile.history = [...profile.history, {
        id: `${question.id}-${now}`,
        questionId: question.id,
        topic: question.topic,
        module: moduleName,
        date: new Date(now).toISOString(),
        score,
        correct: result.correct,
        skipped,
        source: result.source,
        answer: skipped ? "I don't know" : String(rawAnswer || "")
    }].slice(-1500);
    saveProfile(profile);
    return current;
}

export function topicSummary(profile, moduleName, topic) {
    const stats = topic.questions.map(question => questionStat(profile, moduleName, question.id));
    const attempted = stats.filter(stat => stat.attempts > 0);
    const attempts = stats.reduce((sum, stat) => sum + stat.attempts, 0);
    const correct = stats.reduce((sum, stat) => sum + stat.correct, 0);
    const mastery = attempted.length ? Math.round(attempted.reduce((sum, stat) => sum + stat.mastery, 0) / attempted.length) : 0;
    const due = stats.filter(stat => stat.attempts && stat.dueAt <= Date.now()).length;
    return { attempts, correct, accuracy: attempts ? correct / attempts : 0, mastery, due, coverage: attempted.length / topic.questions.length };
}

export function selectQuestion(profile, moduleName, questions, topicId = null, excludeId = null, now = Date.now()) {
    const pool = questions.filter(question => (!topicId || question.topic === topicId) && question.id !== excludeId);
    const ranked = pool.map(question => ({ question, stat: questionStat(profile, moduleName, question.id), noise: Math.random() * 6 }))
        .sort((a, b) => {
            const aDue = a.stat.attempts === 0 || a.stat.dueAt <= now;
            const bDue = b.stat.attempts === 0 || b.stat.dueAt <= now;
            if (aDue !== bDue) return aDue ? -1 : 1;
            if (a.stat.attempts !== b.stat.attempts) return a.stat.attempts - b.stat.attempts;
            if (a.stat.mastery !== b.stat.mastery) return a.stat.mastery - b.stat.mastery;
            return a.noise - b.noise;
        });
    return ranked[0]?.question || questions.find(question => question.id !== excludeId) || questions[0];
}

export function dueLabel(stat, now = Date.now()) {
    if (!stat.attempts) return "New";
    const delta = stat.dueAt - now;
    if (delta <= 0) return "Due now";
    if (delta < 3600000) return `Due in ${Math.max(1, Math.round(delta / 60000))}m`;
    if (delta < DAY) return `Due in ${Math.max(1, Math.round(delta / 3600000))}h`;
    return `Due in ${Math.max(1, Math.round(delta / DAY))}d`;
}

export const engineInternals = { STORAGE_KEY, compact, includesTerm, DAY };
