export function formatCompletedStep(step, answer) {
    const prompt = String(step.prompt || "").trim();
    const shown = String(answer);
    if (prompt.includes("?")) {
        const terminalAnswerSlot = /(?:=|of|by|÷|×|\+|−)\s*\?$/.test(prompt);
        if (prompt.endsWith("?") && !terminalAnswerSlot) return `${prompt.slice(0, -1).trim()} = ${shown}`;
        return prompt.replace("?", shown);
    }
    if (prompt.endsWith(".")) return `${prompt.slice(0, -1)} → ${shown}`;
    return `${prompt} = ${shown}`;
}

export function needsBreakdown(question, error, helpActive = false) {
    if (helpActive) return true;
    if (error === "I didn't know how" || error === "I forgot an intermediate number") return true;
    if (error === "I knew how but made a mistake") return false;
    if (question.structuralType === "fact_recall") return false;
    if (question.gap) return true;
    if (question.type === "fraction") return true;
    if (question.type === "percentage") {
        return question.structuralType !== "percentage_of" || question.difficulty >= 3;
    }
    if (question.type === "decimal") {
        return question.operator === "multiplication" || question.operator === "division" || question.difficulty >= 4 || error === "Decimal placement";
    }
    if (question.type === "integer" && question.operator === "division") {
        const divisor = Number(question.operands?.[1]);
        return !(Number.isInteger(question.answer) && question.answer <= 12 && divisor <= 12);
    }
    if (question.type === "integer" && question.operator === "multiplication") {
        const [left, right] = question.operands || [];
        return !(left <= 12 && right <= 12);
    }
    if (question.type === "integer" && (question.operator === "addition" || question.operator === "subtraction")) {
        const [left, right] = (question.operands || []).map(value => Math.abs(Number(value)));
        const simpleRoundMove = right % 10 === 0 || left % 10 === 0;
        const alignedSubtraction = question.operator === "subtraction" && left % 10 === right % 10;
        const noCarryAddition = question.operator === "addition" && left % 10 + right % 10 < 10;
        return question.difficulty >= 3 && !simpleRoundMove && !alignedSubtraction && !noCarryAddition;
    }
    return false;
}

export function quickCorrection(question) {
    const [left, right] = question.operands || [];
    const answer = question.answerDisplay;
    let check = "";
    if (question.type === "integer" || question.type === "decimal") {
        if (question.operator === "addition") check = `${answer} − ${right} = ${left}`;
        if (question.operator === "subtraction") check = `${right} + ${answer} = ${left}`;
        if (question.operator === "multiplication") check = `${left} × ${right} = ${answer}`;
        if (question.operator === "division") check = `${answer} × ${right} = ${left}`;
    }
    return { answer, check };
}
