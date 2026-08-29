import assert from "node:assert/strict";
import { BANKS, getQuestions } from "./question-bank.js";
import { createProfile, dueLabel, engineInternals, localGrade, questionStat, recordResult, selectQuestion, topicSummary } from "./engine.js";

assert.equal(getQuestions("derivations").length, 45, "derivations bank contains 45 prompts");
assert.equal(getQuestions("models").length, 55, "models bank contains 55 prompts");
assert.equal(BANKS.derivations.find(topic => topic.id === "ols").questions.length, 20, "OLS derivations contain 20 prompts");

const objectiveQuestion = BANKS.derivations[0].questions[0];
const localPass = localGrade(objectiveQuestion, "Minimize (y - X beta)'(y - X beta), where y in R^n, X is n by p, and beta in R^p.");
assert.equal(localPass.correct, true, "notation-tolerant local rubric accepts a complete OLS answer");
const localMiss = localGrade(objectiveQuestion, "Make the predictions close.");
assert.equal(localMiss.correct, false, "local rubric rejects an answer without mathematical checkpoints");

const choiceQuestion = BANKS.models.find(topic => topic.id === "ridge").questions[1];
assert.equal(localGrade(choiceQuestion, "0").correct, true, "choice grader accepts the indexed correct option");
assert.equal(localGrade(choiceQuestion, "1").correct, false, "choice grader rejects an incorrect option");

const profile = createProfile();
const start = Date.parse("2026-08-29T12:00:00Z");
recordResult(profile, "derivations", objectiveQuestion, { correct: false, score: 0, source: "local" }, "", true, start);
let stat = questionStat(profile, "derivations", objectiveQuestion.id);
assert.ok(stat.dueAt - start <= 11 * 60 * 1000, "missed question returns in about ten minutes");
assert.equal(dueLabel(stat, start), "Due in 10m", "short intervals have a readable due label");

recordResult(profile, "derivations", objectiveQuestion, { correct: true, score: 1, source: "local" }, "complete", false, start + 12 * 60 * 1000);
stat = questionStat(profile, "derivations", objectiveQuestion.id);
assert.ok(stat.intervalDays >= 2, "correct retry moves to a multi-day interval");
assert.equal(profile.history.length, 2, "review history records skips and submitted answers");

const olsSummary = topicSummary(profile, "derivations", BANKS.derivations[0]);
assert.equal(olsSummary.attempts, 2, "topic summary aggregates attempts");
assert.equal(olsSummary.coverage, 1 / 20, "topic coverage counts unique questions");

const selected = selectQuestion(profile, "derivations", getQuestions("derivations"), "ols", objectiveQuestion.id, start);
assert.equal(selected.topic, "ols", "topic practice stays inside the selected topic");
assert.notEqual(selected.id, objectiveQuestion.id, "selector can exclude the previous question");
assert.equal(engineInternals.STORAGE_KEY, "qip-theory-mastery-v1", "mastery storage key remains stable");

console.log("Theory engine checks passed: 100 prompts, local grading, scheduling, and topic selection.");
