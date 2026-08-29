export const STRATEGIES = [
    {
        id: "compensation",
        group: "Multiplication",
        title: "Compensation",
        summary: "Move to a round factor, then correct the small difference.",
        example: ["49 × 18", "50 × 18 − 18", "900 − 18 = 882"],
        cue: "One factor is 1–2 away from a round number."
    },
    {
        id: "difference_of_squares",
        group: "Multiplication",
        title: "Difference of squares",
        summary: "Symmetric factors around the same anchor collapse to a² − b².",
        example: ["19 × 21", "(20 − 1)(20 + 1)", "400 − 1 = 399"],
        cue: "The two factors are equally spaced around an easy center."
    },
    {
        id: "doubling_halving",
        group: "Multiplication",
        title: "Doubling & halving",
        summary: "Preserve the product while moving one factor toward a power of ten.",
        example: ["25 × 48", "50 × 24", "100 × 12 = 1,200"],
        cue: "One factor is even and the other becomes round when doubled."
    },
    {
        id: "foil",
        group: "Multiplication",
        title: "Near-base decomposition",
        summary: "Keep the base product visible and add only the correction terms.",
        example: ["17.9 × 18.3", "(18 − .1)(18 + .3)", "324 + 3.6 − .03 = 327.57"],
        cue: "Both values cluster around the same convenient anchor."
    },
    {
        id: "splitting",
        group: "Division",
        title: "Split the dividend",
        summary: "Break the dividend into pieces that divide cleanly.",
        example: ["672 ÷ 16", "640 ÷ 16 + 32 ÷ 16", "40 + 2 = 42"],
        cue: "A large dividend is close to an obvious multiple of the divisor."
    },
    {
        id: "fraction_cancellation",
        group: "Fractions",
        title: "Cancel before multiplying",
        summary: "Remove common factors diagonally before the numbers grow.",
        example: ["7/8 × 12/21", "1/2 × 3/3", "1/2"],
        cue: "A numerator and the opposite denominator share a factor."
    },
    {
        id: "percentage_decomposition",
        group: "Percentages",
        title: "Anchor percentages",
        summary: "Build unfamiliar percentages from 50%, 25%, 20%, 10%, 5%, and 1%.",
        example: ["17% of 240", "10% + 5% + 2%", "24 + 12 + 4.8 = 40.8"],
        cue: "The requested percentage can be composed from fast anchors."
    },
    {
        id: "powers_squares_recall",
        group: "Retrieval",
        title: "Squares 1–30",
        summary: "Automatic square recall frees working memory for correction terms.",
        example: ["18²", "324", "Use inside 17.9 × 18.3"],
        cue: "A problem is built around a repeated or near-repeated factor."
    }
];

export const FACTS = {
    squares: Array.from({ length: 25 }, (_, index) => ({ left: `${index + 1}²`, right: (index + 1) ** 2 })),
    powers: Array.from({ length: 11 }, (_, index) => ({ left: `2^${index}`, right: 2 ** index })),
    fractions: [
        ["1/2", ".5"], ["1/3", ".333"], ["1/4", ".25"], ["1/5", ".2"],
        ["1/6", ".167"], ["1/8", ".125"], ["1/10", ".1"], ["1/16", ".0625"]
    ].map(([left, right]) => ({ left, right }))
};

export function formatStrategyName(value = "standard") {
    return value.split("_").map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
}
