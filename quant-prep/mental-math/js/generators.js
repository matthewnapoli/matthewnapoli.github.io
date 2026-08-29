const pick = (items) => items[Math.floor(Math.random() * items.length)];
const int = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const round = (value, places = 6) => Number(value.toFixed(places));

export const SKILL_KEYS = [
    "integer:addition", "integer:subtraction", "integer:multiplication", "integer:division",
    "decimal:addition", "decimal:subtraction", "decimal:multiplication", "decimal:division",
    "fraction:addition", "fraction:subtraction", "fraction:multiplication", "fraction:division",
    "percentage:multiplication", "percentage:division", "percentage:addition", "percentage:subtraction",
    "gap:mixed"
];

export const SKILL_LABELS = {
    "integer:addition": "Integer Addition",
    "integer:subtraction": "Integer Subtraction",
    "integer:multiplication": "Integer Multiplication",
    "integer:division": "Integer Division",
    "decimal:addition": "Decimal Addition",
    "decimal:subtraction": "Decimal Subtraction",
    "decimal:multiplication": "Decimal Multiplication",
    "decimal:division": "Decimal Division",
    "fraction:addition": "Fraction Addition",
    "fraction:subtraction": "Fraction Subtraction",
    "fraction:multiplication": "Fraction Multiplication",
    "fraction:division": "Fraction Division",
    "percentage:multiplication": "Percentage Multiplication",
    "percentage:division": "Percentage Conversion",
    "percentage:addition": "Percentage Increase",
    "percentage:subtraction": "Percentage Decrease",
    "gap:mixed": "Gap Problems"
};

const SYMBOLS = { addition: "+", subtraction: "−", multiplication: "×", division: "÷" };

function gcd(a, b) {
    let x = Math.abs(Math.round(a));
    let y = Math.abs(Math.round(b));
    while (y) [x, y] = [y, x % y];
    return x || 1;
}

function lcm(a, b) {
    return Math.abs(a * b) / gcd(a, b);
}

function fraction(numerator, denominator) {
    const divisor = gcd(numerator, denominator);
    const sign = denominator < 0 ? -1 : 1;
    return { n: sign * numerator / divisor, d: Math.abs(denominator / divisor) };
}

function fractionText(value) {
    if (value.d === 1) return String(value.n);
    return `${value.n}/${value.d}`;
}

function displayNumber(value) {
    return Number.isInteger(value) ? String(value) : String(round(value, 4));
}

function uid() {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

function baseQuestion(data) {
    const answer = round(data.answer);
    return {
        id: uid(),
        type: data.type,
        operator: data.operator,
        difficulty: clamp(data.difficulty || 1, 1, 6),
        structuralType: data.structuralType || "standard_calculation",
        gap: Boolean(data.gap),
        strategies: data.strategies || [],
        operands: data.operands || [],
        answer,
        answerDisplay: data.answerDisplay || displayNumber(answer),
        prompt: data.prompt,
        skillKey: data.skillKey || `${data.type}:${data.operator}`,
        targetTime: data.targetTime || 8,
        tolerance: data.tolerance ?? Math.max(0.0001, Math.abs(answer) * 0.00001),
        hint: data.hint || "Look for a way to turn the problem into easier arithmetic.",
        explanation: data.explanation || [],
        scaffold: data.scaffold || [],
        reinforcement: data.reinforcement || null,
        factKeys: data.factKeys || []
    };
}

function divideByFactorSteps(value, factor) {
    const quotient = value / factor;
    if (!Number.isInteger(quotient) || quotient < 10) return [{ prompt: `${value} ÷ ${factor} = ?`, answer: quotient }];
    const place = 10 ** Math.floor(Math.log10(quotient));
    const leadingQuotient = Math.floor(quotient / place) * place;
    const leadingDividend = leadingQuotient * factor;
    const remainder = value - leadingDividend;
    if (remainder > 0) {
        return [
            { prompt: `${leadingDividend} ÷ ${factor} = ?`, answer: leadingQuotient },
            { prompt: `${remainder} ÷ ${factor} = ?`, answer: remainder / factor },
            { prompt: `${leadingQuotient} + ${remainder / factor} = ?`, answer: quotient }
        ];
    }
    if (place > 1) {
        return [
            { prompt: `${value / place} ÷ ${factor} = ?`, answer: quotient / place },
            { prompt: `${quotient / place} × ${place} = ?`, answer: quotient }
        ];
    }
    return [{ prompt: `${value} ÷ ${factor} = ?`, answer: quotient }];
}

function factorDivisionScaffold(dividend, divisor) {
    const pairs = [];
    for (let factor = 2; factor <= 12; factor += 1) {
        if (divisor % factor === 0 && divisor / factor >= 2 && divisor / factor <= 12) pairs.push([factor, divisor / factor]);
    }
    if (!pairs.length) return null;
    const [small, large] = pairs.sort((a, b) => Math.abs(a[0] - a[1]) - Math.abs(b[0] - b[1]))[0];
    const firstFactor = Math.max(small, large);
    const secondFactor = Math.min(small, large);
    const intermediate = dividend / firstFactor;
    return [
        { prompt: `${divisor} = ${firstFactor} × ?`, answer: secondFactor },
        ...divideByFactorSteps(dividend, firstFactor),
        ...divideByFactorSteps(intermediate, secondFactor)
    ];
}

function integerQuestion(operator, difficulty) {
    const d = clamp(difficulty, 1, 6);
    if (operator === "multiplication") {
        const structure = d >= 3 ? pick(["standard", "near_base", "compensation", "double_half"]) : "standard";
        let a, b, strategy = "multiplication_table_recall", hint, explanation, scaffold;
        if (structure === "near_base") {
            const base = pick([10, 20, 50, 100]);
            a = base + pick([-3, -2, -1, 1, 2, 3]);
            b = base + pick([-3, -2, -1, 1, 2, 3]);
            strategy = (a + b === base * 2) ? "difference_of_squares" : "foil";
            hint = `Both values are close to ${base}. Rewrite them around that anchor.`;
            explanation = [`${a} = ${base} ${a < base ? "−" : "+"} ${Math.abs(a - base)}`, `${b} = ${base} ${b < base ? "−" : "+"} ${Math.abs(b - base)}`, `Combine the base product and correction terms.`];
            const middleCorrection = base * ((a - base) + (b - base));
            const finalCorrection = (a - base) * (b - base);
            scaffold = [
                { prompt: "Choose the most convenient anchor.", answer: base, options: [10, 20, 50, 100] },
                { prompt: `${base} × ${base} = ?`, answer: base * base },
                { prompt: `${base} × (${a - base} + ${b - base}) = ?`, answer: middleCorrection },
                { prompt: `${a - base} × ${b - base} = ?`, answer: finalCorrection },
                { prompt: `${base * base} + (${middleCorrection}) + (${finalCorrection}) = ?`, answer: a * b }
            ];
        } else if (structure === "compensation") {
            a = pick([19, 21, 29, 31, 39, 41, 49, 51, 98, 102]);
            b = int(6, d >= 5 ? 28 : 18);
            const anchor = Math.round(a / 10) * 10;
            strategy = "compensation";
            hint = `Replace ${a} with ${anchor}, then correct the small difference.`;
            explanation = [`${anchor} × ${b} = ${anchor * b}`, `${a < anchor ? "Subtract" : "Add"} ${Math.abs(anchor - a)} × ${b}`, `Result: ${a * b}`];
            scaffold = [
                { prompt: `${anchor} × ${b} = ?`, answer: anchor * b },
                { prompt: `Correction amount: ${Math.abs(anchor - a)} × ${b} = ?`, answer: Math.abs(anchor - a) * b },
                { prompt: `${anchor * b} ${a < anchor ? "−" : "+"} ${Math.abs(anchor - a) * b} = ?`, answer: a * b }
            ];
        } else if (structure === "double_half") {
            a = pick([12, 16, 24, 25, 32, 48, 75, 125]);
            b = pick([8, 12, 16, 24, 28, 32, 36, 48]);
            strategy = "doubling_halving";
            hint = "Can you halve the even factor and double the other until a round number appears?";
            explanation = [`Halve one factor and double the other without changing the product.`, `${a} × ${b} = ${a * b}`];
            const doubled = a * 2;
            const halved = b / 2;
            scaffold = [
                { prompt: `Double ${a}.`, answer: doubled },
                { prompt: `Halve ${b}.`, answer: halved },
                { prompt: `${doubled} × ${halved} = ?`, answer: a * b }
            ];
        } else {
            a = d === 1 ? int(3, 12) : d === 2 ? int(11, 24) : int(13, d >= 5 ? 59 : 39);
            b = d === 1 ? int(3, 12) : d === 2 ? int(3, 12) : int(11, d >= 5 ? 49 : 29);
            hint = `Split ${b} into a round part and a small remainder.`;
            explanation = [`Use the distributive property to split one factor.`, `${a} × ${b} = ${a * b}`];
            const firstPart = b >= 10 ? Math.floor(b / 10) * 10 : Math.max(1, Math.floor(b / 2));
            const remainder = b - firstPart;
            const firstProduct = a * firstPart;
            const remainderProduct = a * remainder;
            scaffold = [
                { prompt: `${a} × ${firstPart} = ?`, answer: firstProduct },
                ...(remainder ? [{ prompt: `${a} × ${remainder} = ?`, answer: remainderProduct }] : []),
                { prompt: `${firstProduct} + ${remainderProduct} = ?`, answer: a * b }
            ];
        }
        return baseQuestion({
            type: "integer", operator, difficulty: d, operands: [a, b], answer: a * b,
            prompt: `${a} × ${b}`, strategies: [strategy], hint, explanation, scaffold,
            targetTime: d <= 2 ? 4 : d <= 4 ? 8 : 12,
            reinforcement: strategy === "difference_of_squares" ? `${Math.round((a + b) / 2)}²` : null,
            factKeys: a <= 12 && b <= 12 ? [multiplicationFactKey(a, b)] : []
        });
    }

    if (operator === "division") {
        const divisor = d === 1 ? int(2, 12) : d <= 3 ? pick([4, 6, 8, 9, 12, 15, 16, 18]) : pick([12, 14, 16, 18, 24, 25, 32]);
        const quotient = d === 1 ? int(2, 12) : int(12, d >= 5 ? 64 : 38);
        const dividend = divisor * quotient;
        const factorScaffold = factorDivisionScaffold(dividend, divisor);
        const firstQuotient = quotient >= 10 ? Math.floor(quotient / 10) * 10 : Math.max(1, Math.floor(quotient / 2));
        const split = divisor * firstQuotient;
        return baseQuestion({
            type: "integer", operator, difficulty: d, operands: [dividend, divisor], answer: quotient,
            prompt: `${dividend} ÷ ${divisor}`, strategies: ["factoring", "splitting", "multiplication_inverse"],
            hint: factorScaffold ? `Factor ${divisor} into two familiar table facts, then divide in two easier passes.` : `Split ${dividend} into two multiples of ${divisor}.`,
            explanation: factorScaffold ? [`${divisor} factors into small table facts.`, `Divide by the first factor, then by the second to reach ${quotient}.`] : [`${split} ÷ ${divisor} = ${split / divisor}`, `${dividend - split} ÷ ${divisor} = ${(dividend - split) / divisor}`, `Add them: ${quotient}`],
            scaffold: factorScaffold || [{ prompt: `${split} ÷ ${divisor} = ?`, answer: split / divisor }, { prompt: `${dividend - split} ÷ ${divisor} = ?`, answer: (dividend - split) / divisor }, { prompt: `${split / divisor} + ${(dividend - split) / divisor} = ?`, answer: quotient }],
            targetTime: d <= 2 ? 5 : 9
        });
    }

    const max = d === 1 ? 50 : d <= 3 ? 180 : d <= 5 ? 650 : 1400;
    let a = int(Math.ceil(max * .35), max);
    let b = int(Math.ceil(max * .15), Math.ceil(max * .65));
    if (operator === "subtraction" && b > a) [a, b] = [b, a];
    const answer = operator === "addition" ? a + b : a - b;
    const anchor = Math.round(b / 10) * 10;
    const correction = b - anchor;
    return baseQuestion({
        type: "integer", operator, difficulty: d, operands: [a, b], answer,
        prompt: `${a} ${SYMBOLS[operator]} ${b}`, strategies: ["compensation", "rounding_correction"],
        hint: `Round ${b} to ${anchor}, then correct by ${Math.abs(correction)}.`,
        explanation: [`Work with ${anchor} first.`, `Correct the ${Math.abs(correction)} difference.`, `Result: ${answer}`],
        scaffold: (() => {
            const anchorResult = operator === "addition" ? a + anchor : a - anchor;
            const correctionOperator = operator === "addition" ? (correction >= 0 ? "+" : "−") : (correction >= 0 ? "−" : "+");
            return [{ prompt: `${a} ${SYMBOLS[operator]} ${anchor} = ?`, answer: anchorResult }, { prompt: `${anchorResult} ${correctionOperator} ${Math.abs(correction)} = ?`, answer }];
        })(),
        targetTime: d <= 2 ? 4 : 7
    });
}

function decimalQuestion(operator, difficulty) {
    const d = clamp(difficulty, 1, 6);
    if (operator === "multiplication" && d >= 4 && Math.random() < .65) {
        const base = pick([10, 12, 15, 18, 20, 25]);
        const x = pick([-0.3, -0.2, -0.1]);
        const y = pick([0.1, 0.2, 0.3, 0.4]);
        const a = round(base + x, 1);
        const b = round(base + y, 1);
        const answer = round(a * b, 2);
        const middle = round(base * (x + y), 2);
        const tail = round(x * y, 2);
        return baseQuestion({
            type: "decimal", operator, difficulty: d, operands: [a, b], answer,
            prompt: `${a} × ${b}`, strategies: [x + y === 0 ? "difference_of_squares" : "foil", "near_base_multiplication"],
            hint: `Both numbers are close to ${base}. Keep ${base}² visible and add the correction terms.`,
            explanation: [`${a} = ${base} − ${Math.abs(x)}`, `${b} = ${base} + ${y}`, `${base}² = ${base * base}; middle correction = ${middle}; final correction = ${tail}`, `${base * base} ${middle >= 0 ? "+" : "−"} ${Math.abs(middle)} − ${Math.abs(tail)} = ${answer}`],
            scaffold: [
                { prompt: "What convenient anchor are both values near?", answer: base, options: [10, 12, 15, 18, 20, 25] },
                { prompt: `${a} = ${base} − ?`, answer: Math.abs(x) },
                { prompt: `${b} = ${base} + ?`, answer: y },
                { prompt: `${base} × ${base} = ?`, answer: base * base },
                { prompt: `${base} × (${x} + ${y}) = ?`, answer: middle },
                { prompt: `${x} × ${y} = ?`, answer: tail },
                { prompt: `${base * base} + (${middle}) + (${tail}) = ?`, answer }
            ],
            targetTime: 12,
            tolerance: .001,
            reinforcement: `${base}²`
        });
    }

    if (operator === "division") {
        const divisor = pick(d <= 2 ? [0.5, 2, 2.5, 4, 5] : [0.25, 0.5, 1.25, 2.5, 4, 6.25, 8]);
        const quotient = d <= 2 ? int(2, 20) : pick([int(8, 48), int(12, 72) / 10]);
        const dividend = round(divisor * quotient, 3);
        const shift = divisor < 1 ? 100 : divisor % 1 ? 10 : 1;
        return baseQuestion({
            type: "decimal", operator, difficulty: d, operands: [dividend, divisor], answer: quotient,
            prompt: `${displayNumber(dividend)} ÷ ${displayNumber(divisor)}`, strategies: ["decimal_movement", "factoring", "multiplication_inverse"],
            hint: divisor % 1 ? `Scale both values by ${shift} to remove the decimal from the divisor.` : "Use the matching multiplication fact.",
            explanation: divisor % 1 ? [`Multiply both values by ${shift}.`, `${displayNumber(dividend * shift)} ÷ ${displayNumber(divisor * shift)} = ${displayNumber(quotient)}`] : [`Reverse the operation: ${divisor} × ${displayNumber(quotient)} = ${displayNumber(dividend)}.`],
            scaffold: divisor % 1 ? [{ prompt: `After scaling, what is the new dividend?`, answer: round(dividend * shift, 3) }, { prompt: `Now divide by ${displayNumber(divisor * shift)}.`, answer: quotient }] : [{ prompt: `? × ${divisor} = ${displayNumber(dividend)}`, answer: quotient }],
            targetTime: d <= 2 ? 6 : 10
        });
    }

    const places = d <= 2 ? 1 : 2;
    const scale = 10 ** places;
    let a = int(80, d >= 5 ? 9000 : 1600) / scale;
    let b = int(15, d >= 5 ? 2200 : 850) / scale;
    if (operator === "subtraction" && b > a) [a, b] = [b, a];
    if (operator === "multiplication") b = int(12, d >= 4 ? 95 : 40) / 10;
    const answer = operator === "addition" ? round(a + b, places) : operator === "subtraction" ? round(a - b, places) : round(a * b, places + 1);
    const symbol = SYMBOLS[operator];
    const decimalScaffold = operator === "multiplication" ? (() => {
        const integerA = round(a * scale);
        const integerB = round(b * 10);
        const rawProduct = integerA * integerB;
        return [
            { prompt: `${displayNumber(a)} × ${scale} = ?`, answer: integerA },
            { prompt: `${displayNumber(b)} × 10 = ?`, answer: integerB },
            { prompt: `${integerA} × ${integerB} = ?`, answer: rawProduct },
            { prompt: `Move the decimal ${places + 1} place${places + 1 === 1 ? "" : "s"} left in ${rawProduct}.`, answer }
        ];
    })() : (() => {
        const scaledA = round(a * scale);
        const scaledB = round(b * scale);
        const scaledAnswer = operator === "addition" ? scaledA + scaledB : scaledA - scaledB;
        return [
            { prompt: `${displayNumber(a)} × ${scale} = ?`, answer: scaledA },
            { prompt: `${displayNumber(b)} × ${scale} = ?`, answer: scaledB },
            { prompt: `${scaledA} ${symbol} ${scaledB} = ?`, answer: scaledAnswer },
            { prompt: `Move the decimal ${places} place${places === 1 ? "" : "s"} left in ${scaledAnswer}.`, answer }
        ];
    })();
    return baseQuestion({
        type: "decimal", operator, difficulty: d, operands: [a, b], answer,
        prompt: `${displayNumber(a)} ${symbol} ${displayNumber(b)}`, strategies: operator === "multiplication" ? ["distributive_property", "decimal_movement"] : ["place_value", "compensation"],
        hint: operator === "multiplication" ? `Ignore decimal placement first; distribute ${displayNumber(b)} into an easy part and a remainder.` : "Line up place values and work from a round anchor.",
        explanation: operator === "multiplication" ? [`Compute the whole-number structure first.`, `Restore the decimal places: ${displayNumber(answer)}.`] : [`Keep tenths and hundredths aligned.`, `Result: ${displayNumber(answer)}.`],
        scaffold: decimalScaffold,
        targetTime: d <= 2 ? 6 : 11
    });
}

function fractionQuestion(operator, difficulty) {
    const d = clamp(difficulty, 1, 6);
    let a, b, result;
    if (operator === "addition" || operator === "subtraction") {
        const common = Math.random() < .4;
        const d1 = pick([4, 5, 6, 7, 8, 9, 10, 12]);
        const d2 = common ? d1 : pick([3, 4, 5, 6, 8, 10, 12]);
        a = fraction(int(1, d1 - 1), d1);
        b = fraction(int(1, d2 - 1), d2);
        if (operator === "subtraction" && a.n / a.d < b.n / b.d) [a, b] = [b, a];
        result = operator === "addition" ? fraction(a.n * b.d + b.n * a.d, a.d * b.d) : fraction(a.n * b.d - b.n * a.d, a.d * b.d);
    } else {
        const d1 = pick([4, 5, 6, 7, 8, 9, 10, 12, 16]);
        const d2 = pick([4, 5, 6, 7, 8, 9, 10, 12, 16, 21]);
        a = fraction(int(2, d1 - 1), d1);
        b = fraction(int(2, d2 - 1), d2);
        result = operator === "multiplication" ? fraction(a.n * b.n, a.d * b.d) : fraction(a.n * b.d, a.d * b.n);
    }
    const answer = result.n / result.d;
    const symbol = SYMBOLS[operator];
    const isProduct = operator === "multiplication" || operator === "division";
    const fractionScaffold = isProduct ? (() => {
        const right = operator === "division" ? { n: b.d, d: b.n } : b;
        const rawNumerator = a.n * right.n;
        const rawDenominator = a.d * right.d;
        return [
            ...(operator === "division" ? [
                { prompt: `Flip ${fractionText(b)}. New numerator?`, answer: b.d },
                { prompt: `Flip ${fractionText(b)}. New denominator?`, answer: b.n }
            ] : []),
            { prompt: `${a.n} × ${right.n} = ?`, answer: rawNumerator },
            { prompt: `${a.d} × ${right.d} = ?`, answer: rawDenominator },
            { prompt: `Simplify ${rawNumerator}/${rawDenominator}.`, answer, answerDisplay: fractionText(result) }
        ];
    })() : (() => {
        const commonDenominator = lcm(a.d, b.d);
        const firstNumerator = a.n * (commonDenominator / a.d);
        const secondNumerator = b.n * (commonDenominator / b.d);
        const combinedNumerator = operator === "addition" ? firstNumerator + secondNumerator : firstNumerator - secondNumerator;
        return [
            { prompt: `Smallest common denominator for ${a.d} and ${b.d}?`, answer: commonDenominator },
            { prompt: `${fractionText(a)} = ?/${commonDenominator}`, answer: firstNumerator },
            { prompt: `${fractionText(b)} = ?/${commonDenominator}`, answer: secondNumerator },
            { prompt: `${firstNumerator} ${symbol} ${secondNumerator} = ?`, answer: combinedNumerator },
            { prompt: `Simplify ${combinedNumerator}/${commonDenominator}.`, answer, answerDisplay: fractionText(result) }
        ];
    })();
    return baseQuestion({
        type: "fraction", operator, difficulty: d, operands: [a, b], answer, answerDisplay: fractionText(result),
        prompt: `${fractionText(a)} ${symbol} ${fractionText(b)}`, structuralType: "fraction_arithmetic",
        strategies: isProduct ? ["fraction_cancellation", "factoring"] : ["common_denominator", "fraction_simplification"],
        hint: isProduct ? "Cancel common factors before multiplying. For division, flip the second fraction first." : "Find the smallest useful common denominator, then simplify.",
        explanation: isProduct ? [operator === "division" ? "Multiply by the reciprocal of the second fraction." : "Rewrite the product and cancel diagonally first.", `The simplified result is ${fractionText(result)}.`] : [`Use a common denominator for both terms.`, `Combine the numerators and simplify to ${fractionText(result)}.`],
        scaffold: fractionScaffold,
        targetTime: d <= 2 ? 8 : 13,
        tolerance: .0005
    });
}

export function percentageReverseScaffold(part, percent, answer) {
    const preferredAnchors = [10, 50, 25, 20, 5, 1];
    const anchor = preferredAnchors.find(value => {
        const ratio = value / percent;
        const factor = ratio >= 1 ? ratio : 1 / ratio;
        return Number.isInteger(factor) && factor <= 12;
    }) || 1;
    const anchorWhole = round(part * 100 / anchor, 4);
    if (anchor === percent) return [
        { prompt: `${displayNumber(part)} is ${anchor}% of ?`, answer }
    ];
    const ratio = anchor / percent;
    if (ratio > 1) {
        return [
            { prompt: `${displayNumber(part)} is ${anchor}% of ?`, answer: anchorWhole },
            { prompt: `${anchor}% ÷ ? = ${percent}%`, answer: ratio },
            { prompt: `Keep ${displayNumber(part)} fixed: ${displayNumber(anchorWhole)} × ${displayNumber(ratio)} = ?`, answer }
        ];
    }
    const multiplier = 1 / ratio;
    return [
        { prompt: `${displayNumber(part)} is ${anchor}% of ?`, answer: anchorWhole },
        { prompt: `${anchor}% × ? = ${percent}%`, answer: multiplier },
        { prompt: `Keep ${displayNumber(part)} fixed: ${displayNumber(anchorWhole)} ÷ ${displayNumber(multiplier)} = ?`, answer }
    ];
}

function percentageQuestion(operator, difficulty) {
    const d = clamp(difficulty, 1, 6);
    const anchors = d <= 2 ? [5, 10, 20, 25, 50] : [7.5, 12, 14, 15, 17, 18, 22, 32, 46];
    const percent = pick(anchors);
    const base = pick(d <= 2 ? [40, 60, 80, 100, 120, 200] : [70, 120, 140, 160, 240, 280, 320, 350, 480]);

    if (operator === "division") {
        if (Math.random() < .55) {
            const part = round(base * percent / 100, 3);
            return baseQuestion({
                type: "percentage", operator, difficulty: d, operands: [part, base], answer: percent,
                prompt: `${displayNumber(part)} is what % of ${base}?`, structuralType: "x_is_what_percent_of_y",
                strategies: ["percentage_decomposition", "ratio_simplification", "decimal_movement"],
                hint: `Find the multiplier that takes ${base} to ${displayNumber(part)}. Start with 10%.`,
                explanation: [`10% of ${base} is ${displayNumber(base / 10)}.`, `Compose anchor percentages until you reach ${displayNumber(part)}.`, `The result is ${percent}%.`],
                scaffold: [{ prompt: `10% of ${base} = ?`, answer: base / 10 }, { prompt: `${displayNumber(part)} ÷ ${base} × 100 = ?`, answer: percent }],
                targetTime: d <= 2 ? 7 : 11
            });
        }
        const part = round(base * percent / 100, 3);
        return baseQuestion({
            type: "percentage", operator, difficulty: d, operands: [part, percent], answer: base,
            prompt: `${displayNumber(part)} is ${percent}% of what number?`, structuralType: "percentage_of_gap", gap: true, skillKey: "gap:mixed",
            strategies: ["percentage_decomposition", "multiplication_inverse"],
            hint: `Anchor ${displayNumber(part)} to a familiar percentage, then scale the whole inversely.`,
            explanation: [`Keep ${displayNumber(part)} fixed while scaling from an anchor percentage to ${percent}%.`, `The whole is ${base}.`],
            scaffold: percentageReverseScaffold(part, percent, base),
            targetTime: 12
        });
    }

    if (operator === "addition" || operator === "subtraction") {
        const change = round(base * percent / 100, 3);
        const answer = operator === "addition" ? round(base + change, 3) : round(base - change, 3);
        const word = operator === "addition" ? "Increase" : "Decrease";
        return baseQuestion({
            type: "percentage", operator, difficulty: d, operands: [base, percent], answer,
            prompt: `${word} ${base} by ${percent}%`, structuralType: operator === "addition" ? "percentage_increase" : "percentage_decrease",
            strategies: ["percentage_decomposition", "anchor_percentages"],
            hint: `Calculate the ${percent}% change first, then ${operator === "addition" ? "add" : "subtract"} it.`,
            explanation: [`${percent}% of ${base} = ${displayNumber(change)}.`, `${base} ${SYMBOLS[operator]} ${displayNumber(change)} = ${displayNumber(answer)}.`],
            scaffold: [{ prompt: `${percent}% of ${base} = ?`, answer: change }, { prompt: `${base} ${SYMBOLS[operator]} ${displayNumber(change)} = ?`, answer }],
            targetTime: 11
        });
    }

    const answer = round(base * percent / 100, 3);
    const parts = percent === 17 ? [[10, 5, 2]] : percent === 7.5 ? [[5, 2.5]] : [[10, percent - 10].filter(v => v > 0)];
    const tens = Math.floor(percent / 10);
    const remainderPercent = round(percent - tens * 10, 2);
    return baseQuestion({
        type: "percentage", operator: "multiplication", difficulty: d, operands: [percent, base], answer,
        prompt: `${percent}% of ${base}`, structuralType: "percentage_of",
        strategies: ["percentage_decomposition", "anchor_percentages"],
        hint: `Build ${percent}% from 50%, 25%, 10%, 5%, or 1% anchors.`,
        explanation: [`10% of ${base} = ${displayNumber(base / 10)}.`, `Decompose ${percent}% as ${parts[0].join("% + ")}%.`, `Combine the pieces: ${displayNumber(answer)}.`],
        scaffold: [{ prompt: `10% of ${base} = ?`, answer: base / 10 }, { prompt: `1% of ${base} = ?`, answer: base / 100 }, { prompt: `${tens} × ${displayNumber(base / 10)} + ${remainderPercent} × ${displayNumber(base / 100)} = ?`, answer }],
        targetTime: d <= 2 ? 6 : 10
    });
}

function gapQuestion(difficulty) {
    const d = clamp(difficulty, 1, 6);
    const kind = pick(["multiply", "divide", "add", "subtract", "percent"]);
    if (kind === "percent") {
        const base = pick([40, 60, 70, 80, 120, 140, 160, 200, 240]);
        const percent = pick([5, 10, 12.5, 15, 20, 25, 30, 40, 50]);
        const part = round(base * percent / 100, 3);
        if (Math.random() < .5) return baseQuestion({
            type: "percentage", operator: "division", difficulty: d, operands: [part, base], answer: percent,
            prompt: `${displayNumber(part)} is ?% of ${base}`, structuralType: "missing_percentage", gap: true, skillKey: "gap:mixed",
            strategies: ["percentage_decomposition", "ratio_simplification"],
            hint: `Build the share of ${base} from 10%, 5%, 25%, and 50% anchors.`,
            explanation: [`${displayNumber(part)} ÷ ${base} × 100 = ${percent}%.`],
            scaffold: [{ prompt: `10% of ${base} = ?`, answer: base / 10 }, { prompt: `Now identify the percentage that gives ${displayNumber(part)}.`, answer: percent }],
            targetTime: 9
        });
        return baseQuestion({
            type: "percentage", operator: "division", difficulty: d, operands: [percent, part], answer: base,
            prompt: `${percent}% of ? = ${displayNumber(part)}`, structuralType: "missing_base", gap: true, skillKey: "gap:mixed",
            strategies: ["percentage_decomposition", "multiplication_inverse"],
            hint: `Anchor ${displayNumber(part)} to a familiar percentage, then scale the whole inversely.`,
            explanation: [`Scale the whole in the opposite direction from the percentage.`, `${percent}% of ${base} = ${displayNumber(part)}.`],
            scaffold: percentageReverseScaffold(part, percent, base),
            targetTime: 10
        });
    }
    if (kind === "multiply") {
        const missing = int(4, d >= 4 ? 36 : 18);
        const factor = int(4, d >= 4 ? 28 : 15);
        return baseQuestion({ type: "mixed", operator: "multiplication", difficulty: d, operands: [missing, factor], answer: missing, prompt: `? × ${factor} = ${missing * factor}`, structuralType: "missing_number", gap: true, skillKey: "gap:mixed", strategies: ["multiplication_inverse"], hint: "Reverse multiplication with division.", explanation: [`${missing * factor} ÷ ${factor} = ${missing}.`], scaffold: [{ prompt: `${missing * factor} ÷ ${factor} = ?`, answer: missing }], targetTime: 7 });
    }
    if (kind === "divide") {
        const divisor = int(3, 14), result = int(3, 18), dividend = divisor * result;
        return baseQuestion({ type: "mixed", operator: "division", difficulty: d, operands: [dividend, divisor], answer: divisor, prompt: `${dividend} ÷ ? = ${result}`, structuralType: "missing_number", gap: true, skillKey: "gap:mixed", strategies: ["multiplication_inverse"], hint: `Ask what times ${result} equals ${dividend}.`, explanation: [`${result} × ${divisor} = ${dividend}.`], scaffold: [{ prompt: `${result} × ? = ${dividend}`, answer: divisor }], targetTime: 7 });
    }
    const a = int(20, d >= 4 ? 180 : 90), missing = int(8, d >= 4 ? 85 : 45);
    if (kind === "add") return baseQuestion({ type: "mixed", operator: "addition", difficulty: d, operands: [a, missing], answer: missing, prompt: `${a} + ? = ${a + missing}`, structuralType: "missing_number", gap: true, skillKey: "gap:mixed", strategies: ["complement"], hint: "Find the distance between the known value and the total.", explanation: [`${a + missing} − ${a} = ${missing}.`], scaffold: [{ prompt: `${a + missing} − ${a} = ?`, answer: missing }], targetTime: 6 });
    return baseQuestion({ type: "mixed", operator: "subtraction", difficulty: d, operands: [a + missing, missing], answer: missing, prompt: `${a + missing} − ? = ${a}`, structuralType: "missing_number", gap: true, skillKey: "gap:mixed", strategies: ["complement"], hint: "Find the distance between the result and the starting value.", explanation: [`${a + missing} − ${a} = ${missing}.`], scaffold: [{ prompt: `${a + missing} − ${a} = ?`, answer: missing }], targetTime: 6 });
}

export function generateSquareQuestion(base) {
    const n = base || int(11, 25);
    return baseQuestion({ type: "integer", operator: "multiplication", difficulty: Math.ceil(n / 5), operands: [n, n], answer: n * n, prompt: `${n}²`, skillKey: "integer:multiplication", structuralType: "fact_recall", strategies: ["powers_squares_recall"], hint: `Retrieve ${n}² directly; use a nearby product only for correction.`, explanation: [`${n}² = ${n * n}. This value belongs in automatic recall.`], scaffold: [{ prompt: `${n} × ${n - 1} = ?`, answer: n * (n - 1) }, { prompt: `${n * (n - 1)} + ${n} = ?`, answer: n * n }], targetTime: 4, reinforcement: `${n}²`, factKeys: [`square:${n}`] });
}

export function multiplicationFactKey(a, b) {
    return `times:${Math.min(a, b)}x${Math.max(a, b)}`;
}

export function generateTimesTableQuestion(a, b) {
    const left = a || int(2, 12);
    const right = b || int(2, 12);
    return baseQuestion({
        type: "integer", operator: "multiplication", difficulty: Math.max(1, Math.ceil(Math.max(left, right) / 2)),
        operands: [left, right], answer: left * right, prompt: `${left} × ${right}`, skillKey: "integer:multiplication",
        structuralType: "fact_recall", strategies: ["multiplication_table_recall"],
        hint: "This is a core multiplication fact to retrieve directly.",
        explanation: [`${left} × ${right} = ${left * right}. This fact will return later.`],
        scaffold: [{ prompt: `${left} groups of ${right} = ?`, answer: left * right }],
        targetTime: 3, reinforcement: `${left}×${right}`, factKeys: [multiplicationFactKey(left, right)]
    });
}

export function generateQuestion({ skillKey, difficulty = 3, previousType, reinforcement } = {}) {
    if (reinforcement && /^(\d+)²$/.test(reinforcement)) return generateSquareQuestion(Number(reinforcement.match(/\d+/)[0]));
    const chosen = skillKey || pick(SKILL_KEYS.filter(key => !previousType || !key.startsWith(previousType)));
    if (chosen === "gap:mixed") return gapQuestion(difficulty);
    const [type, operator] = chosen.split(":");
    if (type === "integer") return integerQuestion(operator, difficulty);
    if (type === "decimal") return decimalQuestion(operator, difficulty);
    if (type === "fraction") return fractionQuestion(operator, difficulty);
    if (type === "percentage") return percentageQuestion(operator, difficulty);
    return integerQuestion("multiplication", difficulty);
}

export function parseAnswer(input) {
    if (typeof input === "number") return input;
    const cleaned = String(input).trim().replace(/,/g, "").replace(/[−–—]/g, "-").replace(/%$/, "");
    if (!cleaned) return NaN;
    if (/^-?\d+\s*\/\s*-?\d+$/.test(cleaned)) {
        const [n, d] = cleaned.split("/").map(Number);
        return d === 0 ? NaN : n / d;
    }
    return Number(cleaned);
}

export function validateAnswer(question, input) {
    const value = parseAnswer(input);
    if (!Number.isFinite(value)) return false;
    return Math.abs(value - question.answer) <= question.tolerance;
}

export function makeChoices(question) {
    const answer = question.answer;
    const items = new Set([question.answerDisplay]);
    const candidates = [
        answer * 10,
        answer / 10,
        answer + (Math.abs(answer) < 10 ? 1 : Math.max(2, Math.round(Math.abs(answer) * .05))),
        answer - (Math.abs(answer) < 10 ? 1 : Math.max(2, Math.round(Math.abs(answer) * .05))),
        answer * .9,
        answer * 1.1
    ];
    for (const value of candidates) {
        if (items.size >= 4 || !Number.isFinite(value) || value === answer) continue;
        items.add(displayNumber(round(value, Math.abs(value) < 10 ? 3 : 2)));
    }
    while (items.size < 4) items.add(displayNumber(round(answer + int(2, 9) * (Math.random() < .5 ? -1 : 1), 2)));
    return [...items].sort(() => Math.random() - .5);
}

export const internals = { gcd, lcm, fraction, round, clamp };
