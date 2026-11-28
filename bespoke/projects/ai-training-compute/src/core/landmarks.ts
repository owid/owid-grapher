/**
 * Short names and descriptions for the models labeled on the chart, keyed
 * by their name in Epoch's data. Which ones get labeled, and in what
 * priority, is the `labeledModels` config.
 */
export interface Landmark {
    /** Shorter name for the label, when Epoch's is unwieldy */
    displayName?: string
    description: string
}

export const LANDMARKS: Record<string, Landmark> = {
    "GPT-6 Astra": {
        description:
            "OpenAI's flagship model of September 2026, trained on more than 100,000 GPUs.",
    },
    AlexNet: {
        description:
            "Its leap in recognizing objects in photos kicked off the deep learning era.",
    },
    "GPT-3 175B (davinci)": {
        displayName: "GPT-3",
        description:
            "Wrote text that readers often couldn't tell apart from human writing.",
    },
    "AlphaGo Lee": {
        displayName: "AlphaGo",
        description:
            "Beat Lee Sedol, one of the world's best Go players, in 2016.",
    },
    Theseus: {
        description:
            "Claude Shannon's robotic mouse that learned its way through a maze.",
    },
    "Perceptron Mark I": {
        description:
            "An early neural network that learned to recognize images.",
    },
    "TD-Gammon": {
        description:
            "Taught itself backgammon to nearly the level of the best human players.",
    },
    "AlphaFold 2": {
        description:
            "Predicted the 3D shapes of proteins, a major advance in biology.",
    },
    "GPT-4 (Mar 2023)": {
        displayName: "GPT-4",
        description: "The model behind ChatGPT's upgrade in March 2023.",
    },
    "NetTalk (transcription)": {
        displayName: "NetTalk",
        description: "Learned to pronounce written English text.",
    },
    Neocognitron: {
        description:
            "Read handwritten characters; a forerunner of today's image models.",
    },
    ADALINE: {
        description:
            "An early neural network that learned to sort simple patterns into categories.",
    },
    GraphCast: {
        description: "Matched the best supercomputer-based weather forecasts.",
    },
}
