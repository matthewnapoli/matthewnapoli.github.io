import { SKILL_KEYS, SKILL_LABELS } from "./generators.js";

const STORAGE_KEY = "qip-mental-math-profile-v1";
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const average = (values) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;

function initialSkill() {
    return {
        rating: 50,
        difficulty: 2,
        attempts: 0,
        correct: 0,
        streak: 0,
        avgTime: 0,
        recentTime: 0,
        recentAccuracy: .68,
        times: [],
        recent: [],
        bestStreak: 0,
        errors: {},
        strategies: {}
    };
}

function initialFact() {
    return { rating: 50, attempts: 0, correct: 0, avgTime: 0, recentAccuracy: .68, streak: 0 };
}

export function createProfile() {
    const skills = {};
    SKILL_KEYS.forEach(key => { skills[key] = initialSkill(); });
    return {
        version: 2,
        createdAt: new Date().toISOString(),
        lastActiveAt: new Date().toISOString(),
        calibrated: false,
        preferredMode: "learn",
        settings: {
            workingMemory: "minimal",
            showTestScore: true,
            testFormat: "mixed",
            sound: false
        },
        skills,
        breakdownFacts: {},
        breakdownObservationIds: [],
        history: [],
        tests: [],
        reinforcement: [],
        sessionCount: 0
    };
}

function migrate(raw) {
    const profile = { ...createProfile(), ...raw };
    profile.version = 2;
    profile.settings = { ...createProfile().settings, ...(raw.settings || {}) };
    profile.skills = profile.skills || {};
    SKILL_KEYS.forEach(key => { profile.skills[key] = { ...initialSkill(), ...(profile.skills[key] || {}) }; });
    profile.breakdownFacts = profile.breakdownFacts || {};
    profile.breakdownObservationIds = Array.isArray(profile.breakdownObservationIds) ? profile.breakdownObservationIds : [];
    profile.history = Array.isArray(profile.history) ? profile.history : [];
    profile.tests = Array.isArray(profile.tests) ? profile.tests : [];
    profile.reinforcement = Array.isArray(profile.reinforcement) ? profile.reinforcement : [];
    return profile;
}

export function loadProfile() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        return saved ? migrate(JSON.parse(saved)) : createProfile();
    } catch {
        return createProfile();
    }
}

export function saveProfile(profile) {
    profile.lastActiveAt = new Date().toISOString();
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(profile)); } catch { /* Browsing still works without persistence. */ }
}

function inferError(question, rawAnswer, responseMs, correct) {
    if (correct) return null;
    if (responseMs > question.targetTime * 2000) return "Ran out of time";
    const value = Number(String(rawAnswer).replace("%", ""));
    if (Number.isFinite(value)) {
        if (Math.abs(value * 10 - question.answer) < question.tolerance * 10 || Math.abs(value / 10 - question.answer) < question.tolerance * 10) return "Decimal placement";
        if (question.type === "percentage") return "Percent conversion";
        if (question.type === "fraction") return "Fraction simplification";
        if (question.operator === "multiplication") return "Multiplication fact";
        if (question.operator === "division") return "Division fact";
    }
    return "Arithmetic slip";
}

function updateReinforcement(profile, question, correct, responseMs) {
    const concept = question.reinforcement || question.strategies?.[0];
    if (!concept) return;
    const index = profile.reinforcement.findIndex(item => item.concept === concept);
    const slow = responseMs > question.targetTime * 1000 * 1.35;
    if (!correct || slow) {
        const current = index >= 0 ? profile.reinforcement[index] : { concept, interval: 2, due: 2, successes: 0 };
        current.interval = Math.max(2, Math.floor(current.interval * .65));
        current.due = current.interval + Math.floor(Math.random() * 3);
        current.successes = 0;
        if (index < 0) profile.reinforcement.push(current);
    } else if (index >= 0) {
        const current = profile.reinforcement[index];
        current.successes += 1;
        current.interval = clamp(Math.round(current.interval * 1.7), 3, 40);
        current.due = current.interval;
        if (current.successes >= 4) profile.reinforcement.splice(index, 1);
    }
    profile.reinforcement.forEach(item => { if (item.concept !== concept) item.due -= 1; });
    profile.reinforcement = profile.reinforcement.slice(0, 16);
}

export function recordAttempt(profile, question, rawAnswer, correct, responseMs, mode, sessionId, forcedError = null) {
    const key = question.skillKey;
    if (!profile.skills[key]) profile.skills[key] = initialSkill();
    const skill = profile.skills[key];
    const seconds = responseMs / 1000;
    const error = forcedError || inferError(question, rawAnswer, responseMs, correct);

    skill.attempts += 1;
    skill.correct += correct ? 1 : 0;
    skill.streak = correct ? skill.streak + 1 : 0;
    skill.bestStreak = Math.max(skill.bestStreak, skill.streak);
    skill.avgTime = skill.attempts === 1 ? seconds : skill.avgTime + (seconds - skill.avgTime) / skill.attempts;
    skill.recentTime = skill.recentTime ? .72 * skill.recentTime + .28 * seconds : seconds;
    skill.recentAccuracy = .78 * skill.recentAccuracy + .22 * (correct ? 1 : 0);
    skill.times = [...skill.times, seconds].slice(-40);
    skill.recent = [...skill.recent, { correct, seconds }].slice(-8);
    if (error) skill.errors[error] = (skill.errors[error] || 0) + 1;
    (question.strategies || []).forEach(strategy => {
        const stats = skill.strategies[strategy] || { attempts: 0, correct: 0 };
        stats.attempts += 1;
        stats.correct += correct ? 1 : 0;
        skill.strategies[strategy] = stats;
    });

    const speedScore = clamp(question.targetTime / Math.max(seconds, .5), 0, 1.2) / 1.2;
    const observation = (correct ? 68 : 8) + (correct ? speedScore * 32 : 0);
    skill.rating = clamp(Math.round(skill.rating * .82 + observation * .18), 10, 99);

    if (skill.recent.length >= 5) {
        const recentCorrect = skill.recent.filter(item => item.correct).length;
        const recentTime = average(skill.recent.map(item => item.seconds));
        if (recentCorrect >= 4 && recentTime < question.targetTime * 1.15) skill.difficulty = clamp(skill.difficulty + 1, 1, 6);
        if (recentCorrect <= 2) skill.difficulty = clamp(skill.difficulty - 1, 1, 6);
    }

    updateReinforcement(profile, question, correct, responseMs);
    const entry = {
        id: question.id,
        date: new Date().toISOString(),
        sessionId,
        mode,
        prompt: question.prompt,
        answer: question.answerDisplay,
        userAnswer: String(rawAnswer || "—"),
        correct,
        responseMs,
        type: question.type,
        operator: question.operator,
        gap: question.gap,
        difficulty: question.difficulty,
        skillKey: key,
        strategy: question.strategies?.[0] || "standard",
        error,
        explanation: question.explanation,
        factKeys: question.factKeys || []
    };
    profile.history = [...profile.history, entry].slice(-700);
    saveProfile(profile);
    return { skill, entry, inferredError: error };
}

export function overrideError(profile, attemptId, error) {
    const attempt = profile.history.find(item => item.id === attemptId);
    if (!attempt || !error) return;
    attempt.userError = error;
    saveProfile(profile);
}

export function median(values) {
    if (!values.length) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function skillSummary(profile, key) {
    const skill = profile.skills[key] || initialSkill();
    const accuracy = skill.attempts ? skill.correct / skill.attempts : 0;
    const ratingLabel = skill.attempts < 3 ? "Unrated" : skill.rating >= 78 ? "Strong" : skill.rating >= 60 ? "Developing" : "Weak";
    return {
        key,
        label: SKILL_LABELS[key] || key,
        attempts: skill.attempts,
        accuracy,
        avgTime: skill.avgTime,
        medianTime: median(skill.times),
        recentTime: skill.recentTime,
        rating: skill.rating,
        ratingLabel,
        difficulty: skill.difficulty,
        streak: skill.streak
    };
}

export function weakestSkills(profile, limit = 3) {
    return SKILL_KEYS.map(key => skillSummary(profile, key))
        .sort((a, b) => {
            const aScore = a.attempts < 3 ? 55 : a.rating;
            const bScore = b.attempts < 3 ? 55 : b.rating;
            return aScore - bScore || b.attempts - a.attempts;
        })
        .slice(0, limit);
}

export function strongestSkills(profile, limit = 3) {
    return SKILL_KEYS.map(key => skillSummary(profile, key)).filter(item => item.attempts >= 2).sort((a, b) => b.rating - a.rating).slice(0, limit);
}

export function dueReinforcement(profile) {
    return profile.reinforcement.filter(item => item.due <= 0).sort((a, b) => a.due - b.due)[0]?.concept || null;
}

export function factSummary(profile, key) {
    const fact = profile.breakdownFacts?.[key] || initialFact();
    const accuracy = fact.attempts ? fact.correct / fact.attempts : 0;
    const status = fact.attempts === 0 ? "unmeasured" : fact.rating >= 80 && fact.streak >= 2 ? "strong" : fact.rating >= 62 ? "developing" : "weak";
    return { key, ...fact, accuracy, status };
}

export function weakestFacts(profile, prefix, limit = 8) {
    return Object.keys(profile.breakdownFacts || {})
        .filter(key => key.startsWith(`${prefix}:`))
        .map(key => factSummary(profile, key))
        .sort((a, b) => {
            const aPriority = a.attempts ? a.rating : 45;
            const bPriority = b.attempts ? b.rating : 45;
            return aPriority - bPriority || a.attempts - b.attempts;
        })
        .slice(0, limit);
}

function breakdownFactKey(step) {
    const prompt = String(step?.prompt || "").replaceAll(",", "").trim();
    let match = prompt.match(/^(-?\d+)\s*([+−×÷])\s*(-?\d+)\s*=\s*\?$/);
    if (match && match.length === 4) {
        const left = Math.abs(Number(match[1]));
        const operator = match[2];
        const right = Math.abs(Number(match[3]));
        if (operator === "+" && left >= 1 && left <= 100 && right >= 1 && right <= 100) return `add:${left}x${right}`;
        if (operator === "−" && left >= 1 && left <= 100 && right >= 1 && right <= 100) return `subtract:${left}x${right}`;
        if (operator === "×") {
            if (left === right && left <= 25) return `square:${left}`;
            if (left >= 1 && left <= 12 && right >= 1 && right <= 12) return `times:${left}x${right}`;
        }
        if (operator === "÷") {
            const quotient = Math.abs(Number(step.answer));
            if (right >= 1 && right <= 12 && Number.isInteger(quotient) && quotient >= 1 && quotient <= 12) return `times:${right}x${quotient}`;
        }
    }
    match = prompt.match(/^(\d+)\s+groups of\s+(\d+)\s*=\s*\?$/i);
    if (match) {
        const left = Number(match[1]);
        const right = Number(match[2]);
        if (left <= 12 && right <= 12) return `times:${left}x${right}`;
    }
    match = prompt.match(/^Double\s+(\d+)\.?$/i);
    if (match && Number(match[1]) <= 12) return `times:2x${Number(match[1])}`;
    match = prompt.match(/^Halve\s+(\d+)\.?$/i);
    if (match) {
        const half = Number(step.answer);
        if (Number.isInteger(half) && half >= 1 && half <= 12) return `times:2x${half}`;
    }
    return null;
}

export function recordBreakdownStep(profile, step, firstTryCorrect, responseMs, observationId = null) {
    if (observationId && profile.breakdownObservationIds?.includes(observationId)) return null;
    const key = breakdownFactKey(step);
    if (!key) return null;
    profile.breakdownFacts ||= {};
    const fact = profile.breakdownFacts[key] || initialFact();
    const seconds = Math.max(.1, responseMs / 1000);
    const target = key.startsWith("square:") ? 4 : key.startsWith("times:") ? 3 : 5;
    const speed = clamp(target / seconds, 0, 1);
    const observation = firstTryCorrect ? 70 + 30 * speed : 12;
    fact.rating = fact.attempts ? clamp(Math.round(fact.rating * .76 + observation * .24), 5, 99) : Math.round(observation);
    fact.attempts += 1;
    fact.correct += firstTryCorrect ? 1 : 0;
    fact.avgTime = fact.attempts === 1 ? seconds : fact.avgTime + (seconds - fact.avgTime) / fact.attempts;
    fact.recentAccuracy = .72 * fact.recentAccuracy + .28 * (firstTryCorrect ? 1 : 0);
    fact.streak = firstTryCorrect ? fact.streak + 1 : 0;
    profile.breakdownFacts[key] = fact;
    if (observationId) profile.breakdownObservationIds = [...(profile.breakdownObservationIds || []), observationId].slice(-1200);
    saveProfile(profile);
    return { key, ...fact };
}

export function completeTest(profile, result) {
    profile.tests = [...profile.tests, result].slice(-60);
    if (result.mode === "calibration") profile.calibrated = true;
    profile.sessionCount += 1;
    saveProfile(profile);
}

export function resetProfile() {
    const fresh = createProfile();
    saveProfile(fresh);
    return fresh;
}

export function exportProfile(profile) {
    return JSON.stringify(profile, null, 2);
}

export const profileInternals = { inferError, initialSkill, STORAGE_KEY };
