/**
 * "Up next" articles — prototype fixtures, keyed by data page slug, in the
 * order they're offered.
 *
 * Snapshotted on 2026-09-24 from each article's live page (its embedded gdoc
 * content): the title, byline, publish date and opening paragraphs, with
 * footnote reference numbers removed.
 */
export interface UpNextArticle {
    url: string
    title: string
    authors: string[]
    /** YYYY-MM-DD */
    publishedAt: string
    /** The article's opening paragraphs, as plain text. */
    paragraphs: string[]
}

export const UP_NEXT_ARTICLES: Record<string, UpNextArticle[]> = {
    "prevalence-of-undernourishment": [
        {
            url: "https://ourworldindata.org/yields-vs-land-use-how-has-the-world-produced-enough-food-for-a-growing-population",
            title: "Yields vs. land use: how the Green Revolution enabled us to feed a growing population",
            authors: ["Hannah Ritchie"],
            publishedAt: "2017-08-22",
            paragraphs: [
                "Over the last 50 years, the global population has more than doubled. This factor has inevitably reduced the land available per person to live and grow food. How have we managed to feed a rapidly growing population with ever-shrinking land resources?",
                "There are two key variables we can change to produce more food crops. We can opt for:",
            ],
        },
        {
            url: "https://ourworldindata.org/diet-affordability",
            title: "Almost three billion people cannot afford a healthy diet",
            authors: ["Hannah Ritchie", "Pablo Rosado"],
            publishedAt: "2021-07-12",
            paragraphs: [
                "A healthy diet is about much more than calories: we need a wide range of nutrient-dense foods to get all of the vitamins and minerals that are essential for good health. In this post I look at the costs of diets around the world. Healthy diets are expensive; more than four times the cost of a basic, calorie-sufficient one. This is true in every country in the world. As a result, three billion people cannot afford a healthy diet, even if they spend most of their income on food.",
                "Being able to eat a healthy, nutritious diet is one of our most basic human needs. Yet billions of people go without; they suffer from ‘hidden hunger’, micronutrient deficiencies such as too little iron, calcium, vitamin-A or iodine.",
                "There are many reasons why someone might not eat a nutritious diet. Often it’s because people cannot afford to.",
                "To understand the affordability of food across the world a team of researchers looked at the lowest-cost options to meet basic nutritional requirements. As part of this study for the FAO’s The State of Food Security and Nutrition in the World report, Anna Herforth and colleagues asked the question: “what is the cheapest way to meet dietary requirements in each country?”.",
            ],
        },
        {
            url: "https://ourworldindata.org/undernourishment-definition",
            title: "What is undernourishment and how is it measured?",
            authors: ["Hannah Ritchie"],
            publishedAt: "2022-02-04",
            paragraphs: [
                "‘Undernourishment’ is the main indicator used by the Food and Agriculture Organization of the United Nations to measure the extent of food supplies and nutrition. It is often used interchangeably with the term ‘hunger’.",
                "Undernourishment is solely determined by the sufficiency of energy (calorie) intake. It does not consider the quality or diversity of someone’s diet. That means it is only one component of malnutrition: a broader term that also captures other types of nutrient deficiencies, such as micronutrients.",
                "The prevalence of undernourishment in any given country or region measures the share of the population that has a daily food intake that is insufficient to provide, on average, the amount of dietary energy required to maintain a normal, active and healthy life. That is, the share of people who do not get enough calories to live a healthy life.",
            ],
        },
        {
            url: "https://ourworldindata.org/half-child-deaths-linked-malnutrition",
            title: "Half of all child deaths are linked to malnutrition",
            authors: ["Hannah Ritchie"],
            publishedAt: "2024-09-09",
            paragraphs: [
                "In 2021, 4.7 million children under the age of five died; 2.4 million of those were attributed to child and maternal malnutrition. That means around half of child deaths were linked to nutritional deficiencies.",
                "When you think about these deaths, you might imagine a very acute form of hunger: a starving child. While this can happen during famines or in areas with very low levels of food availability, it’s only a small fraction of the total deaths linked to malnutrition.",
                "In most cases, children don’t die of malnutrition. They die from conditions that are exacerbated or are triggered by it. In most cases, it’s a risk factor for premature death. Take the example of the risk factor of smoking. People die from lung cancer, but their risk of developing it is significantly increased if they’ve been a smoker.",
                "In the chart below, we can see how many child deaths are attributed to different nutritional risk factors.",
            ],
        },
        {
            url: "https://ourworldindata.org/agricultural-productivity-crucial",
            title: "Why is improving agricultural productivity crucial to ending global hunger and protecting the world’s wildlife?",
            authors: ["Max Roser"],
            publishedAt: "2024-03-04",
            paragraphs: [
                "The use of land for agriculture has been the main driver of the destruction of the world's biodiversity for a very long time. A look at our history makes clear why.",
                "Our planet has a land surface of about 150 million square kilometers. Almost a third of it is free of vegetation. It is covered by rocks, deserts, and glaciers — especially the large glaciers in Antarctica.",
                "The remaining 71% of the planet’s land surface was once covered by wilderness: large forests, shrubs, and grasslands.",
                "The world’s land surface 10,000 years ago:",
                "How have things changed since the agricultural revolution 10,000 years ago?",
                "The 10.6 billion hectares that were once covered by wilderness are called the world’s “habitable land”. The following chart shows how this land is used today. Almost half is used for agriculture.",
                "The global land area used for agriculture today measures 48 million square kilometers. For comparison, that’s an area around five times the size of the United States.",
            ],
        },
    ],
}
