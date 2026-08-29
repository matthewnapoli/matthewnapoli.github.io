import assert from "node:assert/strict";
import { generateQuestion, generateSquareQuestion, generateTimesTableQuestion, percentageReverseScaffold, validateAnswer, parseAnswer, makeChoices, SKILL_KEYS } from "../js/generators.js";
import { formatCompletedStep, needsBreakdown } from "../js/learning-policy.js";

const memory = new Map();
globalThis.localStorage = {
    getItem: key => memory.get(key) ?? null,
    setItem: (key, value) => memory.set(key, value),
    removeItem: key => memory.delete(key)
};

const { createProfile, recordAttempt, recordBreakdownStep, factSummary, saveProfile, loadProfile } = await import("../js/profile.js");

let generated = 0;
for (const skillKey of SKILL_KEYS) {
    for (let difficulty = 1; difficulty <= 6; difficulty += 1) {
        for (let sample = 0; sample < 40; sample += 1) {
            const question = generateQuestion({ skillKey, difficulty });
            generated += 1;
            assert.ok(Number.isFinite(question.answer), `${skillKey} produced a finite answer`);
            assert.ok(question.prompt && question.skillKey, `${skillKey} contains display and metadata`);
            assert.ok(question.scaffold.length > 0, `${skillKey} includes worksheet subproblems`);
            question.scaffold.forEach(step => assert.ok(Number.isFinite(Number(step.answer)), `${skillKey} worksheet step has a deterministic answer`));
            assert.ok(validateAnswer(question, String(question.answer)), `${question.prompt} accepts its numeric answer`);
            assert.ok(validateAnswer(question, question.answerDisplay), `${question.prompt} accepts its display answer`);
            assert.equal(validateAnswer(question, String(question.answer + Math.max(2, Math.abs(question.answer) * .2))), false, `${question.prompt} rejects a meaningfully wrong answer`);
            const choices = makeChoices(question);
            assert.equal(choices.length, 4, "multiple-choice generator returns four distinct choices");
            assert.ok(choices.includes(question.answerDisplay), "multiple-choice options include the correct answer");
        }
    }
}

assert.equal(parseAnswer("3/4"), .75, "fraction answers parse");
assert.equal(parseAnswer("46%"), 46, "percent answers parse in displayed units");
assert.equal(parseAnswer("1,200"), 1200, "grouped integers parse");

const anchorScale = percentageReverseScaffold(7, 5, 140);
assert.deepEqual(anchorScale.map(step => step.answer), [70, 2, 140], "inverse percentages use anchor-and-scale answers");
assert.deepEqual(anchorScale.map(step => formatCompletedStep(step, step.answer)), ["7 is 10% of 70", "10% ÷ 2 = 5%", "Keep 7 fixed: 70 × 2 = 140"], "anchor-and-scale route stays readable");
assert.equal(formatCompletedStep({ prompt: "1/7 = ?/84" }, 12), "1/7 = 12/84", "fraction values replace the gap in place");
assert.equal(formatCompletedStep({ prompt: "Smallest common denominator for 7 and 12?" }, 84), "Smallest common denominator for 7 and 12 = 84", "question prompts render as complete equations");
assert.equal(formatCompletedStep({ prompt: "Simplify 61/84." }, "61/84"), "Simplify 61/84 → 61/84", "instruction steps use a readable result arrow");

assert.equal(needsBreakdown({ type: "integer", operator: "subtraction", difficulty: 4, operands: [175, 105], answer: 70 }, "Arithmetic slip"), false, "aligned subtraction such as 175 − 105 skips a worksheet");
assert.equal(needsBreakdown({ type: "integer", operator: "addition", difficulty: 4, operands: [87, 58], answer: 145 }, "Arithmetic slip"), true, "complex carrying addition gets a worksheet");
assert.equal(needsBreakdown({ type: "integer", operator: "division", difficulty: 3, operands: [68, 4], answer: 17 }, "Arithmetic slip"), true, "non-table division gets a worksheet");

const sixtyA = Array.from({ length: 60 }, (_, index) => generateQuestion({ skillKey: SKILL_KEYS[index % SKILL_KEYS.length], difficulty: 2 + index % 4 }).prompt);
const sixtyB = Array.from({ length: 60 }, (_, index) => generateQuestion({ skillKey: SKILL_KEYS[(index * 5) % SKILL_KEYS.length], difficulty: 2 + (index * 3) % 4 }).prompt);
assert.ok(new Set([...sixtyA, ...sixtyB]).size >= 80, "two 60-question tests contain substantial procedural variety");

const decimal = { answer: 327.57, tolerance: .001 };
assert.equal(validateAnswer(decimal, "327.5704"), true, "floating-point tolerance accepts harmless representation noise");
assert.equal(validateAnswer(decimal, "327.58"), false, "floating-point tolerance rejects a different answer");

const profile = createProfile();
const adaptiveQuestion = generateQuestion({ skillKey: "integer:multiplication", difficulty: 2 });
const startingDifficulty = profile.skills[adaptiveQuestion.skillKey].difficulty;
for (let index = 0; index < 7; index += 1) recordAttempt(profile, adaptiveQuestion, adaptiveQuestion.answerDisplay, true, 900, "learn", "test-session");
assert.ok(profile.skills[adaptiveQuestion.skillKey].difficulty > startingDifficulty, "several fast correct answers increase difficulty");
assert.equal(profile.history.length, 7, "attempt history is retained");

saveProfile(profile);
const restored = loadProfile();
assert.equal(restored.history.length, 7, "profile persists through local storage");
assert.equal(restored.skills[adaptiveQuestion.skillKey].attempts, 7, "skill statistics persist");

const timeoutProfile = createProfile();
const timeoutResult = recordAttempt(timeoutProfile, adaptiveQuestion, "—", false, 15000, "test", "timeout-session", "Ran out of time");
assert.equal(timeoutResult.entry.error, "Ran out of time", "the 15-second cap is stored as a timeout error");
assert.equal(timeoutResult.entry.correct, false, "a timed-out question is always incorrect");

const breakdownProfile = createProfile();
const tableQuestion = generateTimesTableQuestion(7, 8);
recordAttempt(breakdownProfile, tableQuestion, tableQuestion.answerDisplay, true, 1200, "learn", "main-attempt");
assert.equal(factSummary(breakdownProfile, "times:7x8").attempts, 0, "main-question answers never update breakdown mastery");
recordBreakdownStep(breakdownProfile, { prompt: "7 × 8 = ?", answer: 56 }, false, 4200, "worksheet-1");
recordBreakdownStep(breakdownProfile, { prompt: "7 × 8 = ?", answer: 56 }, true, 5000, "worksheet-1");
assert.equal(factSummary(breakdownProfile, "times:7x8").attempts, 1, "a retried worksheet step updates mastery only once");
assert.equal(factSummary(breakdownProfile, "times:7x8").correct, 0, "a step completed after retries counts as one first-try miss");
recordBreakdownStep(breakdownProfile, { prompt: "56 ÷ 7 = ?", answer: 8 }, true, 1800, "worksheet-2");
assert.equal(factSummary(breakdownProfile, "times:7x8").attempts, 2, "division and multiplication share the same fact cell");
recordBreakdownStep(breakdownProfile, { prompt: "225 ÷ 15 = ?", answer: 15, factKey: "times:15x15" }, true, 1900, "fact-helper-1");
assert.equal(factSummary(breakdownProfile, "times:15x15").attempts, 1, "base fact helper records multiplication and division through 15 × 15");
recordBreakdownStep(breakdownProfile, { prompt: "20² = ?", answer: 400, factKey: "square:20" }, true, 1800, "fact-helper-2");
assert.equal(factSummary(breakdownProfile, "square:20").attempts, 1, "base fact helper records emphasized squares through 20²");
recordBreakdownStep(breakdownProfile, { prompt: "84 + 16 = ?", answer: 100 }, true, 2200, "worksheet-3");
recordBreakdownStep(breakdownProfile, { prompt: "84 − 16 = ?", answer: 68 }, true, 2200, "worksheet-4");
assert.equal(factSummary(breakdownProfile, "add:84x16").attempts, 1, "addition records one directional cell in the 100 × 100 addition matrix");
assert.equal(factSummary(breakdownProfile, "subtract:84x16").attempts, 1, "subtraction records separately into its 100 × 100 matrix");
for (let index = 0; index < 100; index += 1) assert.ok(generateSquareQuestion().operands[0] <= 25, "square recall never exceeds 25²");

console.log(`Engine checks passed: ${generated} generated questions across ${SKILL_KEYS.length} skills.`);
