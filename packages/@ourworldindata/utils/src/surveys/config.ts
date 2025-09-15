import { Survey } from "./Survey.js"

export const surveys = [
    new Survey({
        id: "survey-1",
        title: "Help us improve this page",
        description: "",
        paths: ["/grapher/life-expectancy"],
        expires: "2025-09-30T00:00:00.000Z",
        questions: [
            {
                type: "multiple-choice",
                id: "nps",
                text: "How likely are you to recommend Our World in Data to a friend or colleague?",
                options: Array.from({ length: 11 }, (_, i) => i.toString()),
                required: false,
            },
            {
                type: "multiple-choice",
                id: "satisfaction",
                text: "How satisfied are you with this page?",
                options: [
                    "Very dissatisfied",
                    "Dissatisfied",
                    "Neutral",
                    "Satisfied",
                    "Very satisfied",
                ],
                required: false,
            },
            {
                type: "multi-select",
                id: "features",
                text: "Which of the following would you like to see on this page?",
                options: [
                    "Insights about the data",
                    "Links to related charts",
                    "Details about data sources",
                ],
                required: false,
            },
            {
                type: "open-ended",
                id: "feedback",
                text: "Is there anything else you'd like to tell us about your experience?",
                placeholder: "Your feedback helps us improve...",
                required: false,
            },
            {
                type: "link",
                id: "interview",
                text: "Would you be willing to participate in a user interview?",
                url: "https://ourworldindata.org",
                linkText: "Sign up",
            },
        ],
    }),
]
