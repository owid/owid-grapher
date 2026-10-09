/**
 * "Up next" articles — prototype fixtures, keyed by data page slug, in the
 * order they're offered.
 *
 * Snapshotted on 2026-09-24 from each article's live page (its embedded gdoc
 * content): the title, byline, publish date and the opening of the article —
 * paragraphs, section headings and bullet lists, in order, charts skipped —
 * with footnote reference numbers removed. Deliberately more than fits: the
 * card fades it out, and the depth is what gets a reader invested.
 */
export type UpNextBlock =
    | { kind: "paragraph"; text: string }
    | { kind: "heading"; text: string }
    | { kind: "list"; items: string[] }

export interface UpNextArticle {
    url: string
    title: string
    authors: string[]
    /** YYYY-MM-DD */
    publishedAt: string
    /** The opening of the article, as plain-text blocks. */
    excerpt: UpNextBlock[]
}

export const UP_NEXT_ARTICLES: Record<string, UpNextArticle[]> = {
    "prevalence-of-undernourishment": [
        {
            url: "https://ourworldindata.org/yields-vs-land-use-how-has-the-world-produced-enough-food-for-a-growing-population",
            title: "Yields vs. land use: how the Green Revolution enabled us to feed a growing population",
            authors: ["Hannah Ritchie"],
            publishedAt: "2017-08-22",
            excerpt: [
                {
                    kind: "paragraph",
                    text: "Over the last 50 years, the global population has more than doubled. This factor has inevitably reduced the land available per person to live and grow food. How have we managed to feed a rapidly growing population with ever-shrinking land resources?",
                },
                {
                    kind: "paragraph",
                    text: "There are two key variables we can change to produce more food crops. We can opt for:",
                },
                {
                    kind: "list",
                    items: [
                        "Expansion: increase the area of land we grow our food over",
                        "Intensification: increase the yield output (i.e. kilograms of crop produced per unit area of land). This is typically achieved through a combination of chemical inputs (such as fertilizer, pesticides and herbicides); improved water use (e.g. irrigation); mechanization and improved farming practices; and the use of higher-yielding crop strains or seeds",
                    ],
                },
                {
                    kind: "heading",
                    text: "Global cereal production",
                },
                {
                    kind: "paragraph",
                    text: "At the global level, how has crop production changed over the last fifty years? Here, we focus on cereal production: cereals form the base component of energy intake in most diets, comprising more than half of total caloric intake in many countries, and also dominate global arable land use by area.",
                },
                {
                    kind: "paragraph",
                    text: "In the chart below we have mapped four variables: total cereal production; average cereal yield; land area used for cereal production; and total population. These are measured as an index relative to their respective values in 1961 (i.e. 1961 is equal to 0).",
                },
                {
                    kind: "paragraph",
                    text: "We see that global cereal production has grown at a much faster rate than the population. That means that cereal production per person has increased despite a growing population.",
                },
                {
                    kind: "paragraph",
                    text: "Have we achieved this through land expansion or improved yields? As we can see in the chart, expansion played a very small role: over the last few decades land use for cereal production has increased only marginally. Overall, this means we use less land per person than we did fifty years ago.",
                },
                {
                    kind: "paragraph",
                    text: "Most of our improvements in cereal production have arisen from improvements in yield. Today, the world can produce almost three times as much cereal from a given area of land than it did in 1961. As we will explain below, this increase has been even more dramatic in particular regions.",
                },
            ],
        },
        {
            url: "https://ourworldindata.org/diet-affordability",
            title: "Almost three billion people cannot afford a healthy diet",
            authors: ["Hannah Ritchie", "Pablo Rosado"],
            publishedAt: "2021-07-12",
            excerpt: [
                {
                    kind: "paragraph",
                    text: "A healthy diet is about much more than calories: we need a wide range of nutrient-dense foods to get all of the vitamins and minerals that are essential for good health. In this post I look at the costs of diets around the world. Healthy diets are expensive; more than four times the cost of a basic, calorie-sufficient one. This is true in every country in the world. As a result, three billion people cannot afford a healthy diet, even if they spend most of their income on food.",
                },
                {
                    kind: "paragraph",
                    text: "Being able to eat a healthy, nutritious diet is one of our most basic human needs. Yet billions of people go without; they suffer from ‘hidden hunger’, micronutrient deficiencies such as too little iron, calcium, vitamin-A or iodine.",
                },
                {
                    kind: "paragraph",
                    text: "There are many reasons why someone might not eat a nutritious diet. Often it’s because people cannot afford to.",
                },
                {
                    kind: "paragraph",
                    text: "To understand the affordability of food across the world a team of researchers looked at the lowest-cost options to meet basic nutritional requirements. As part of this study for the FAO’s The State of Food Security and Nutrition in the World report, Anna Herforth and colleagues asked the question: “what is the cheapest way to meet dietary requirements in each country?”.",
                },
                {
                    kind: "paragraph",
                    text: "This data has since then been updated and maintained by the World Bank and the UN FAO.",
                },
                {
                    kind: "paragraph",
                    text: "They answered this question using data on prices for locally-available food items from the International Comparison Program (ICP) matched to other data on food composition and dietary requirements.",
                },
                {
                    kind: "paragraph",
                    text: "You find their full set of results in our Food Prices Data Explorer.",
                },
                {
                    kind: "heading",
                    text: "An energy sufficient diet: almost 900 million cannot comfortably afford one",
                },
                {
                    kind: "paragraph",
                    text: "Let’s start with the most basic requirement: getting enough calories. These calories could come in any form, but the cheapest option in most countries is starchy foods and cereals. Living on this ‘energy sufficient’ diet would mean eating only maize flour or rice for every meal, a diet that is severely lacking all other important nutrients. When you look at people’s diets you see that in poor countries, people get most of their calories from starchy foods.",
                },
            ],
        },
        {
            url: "https://ourworldindata.org/undernourishment-definition",
            title: "What is undernourishment and how is it measured?",
            authors: ["Hannah Ritchie"],
            publishedAt: "2022-02-04",
            excerpt: [
                {
                    kind: "paragraph",
                    text: "‘Undernourishment’ is the main indicator used by the Food and Agriculture Organization of the United Nations to measure the extent of food supplies and nutrition. It is often used interchangeably with the term ‘hunger’.",
                },
                {
                    kind: "paragraph",
                    text: "Undernourishment is solely determined by the sufficiency of energy (calorie) intake. It does not consider the quality or diversity of someone’s diet. That means it is only one component of malnutrition: a broader term that also captures other types of nutrient deficiencies, such as micronutrients.",
                },
                {
                    kind: "paragraph",
                    text: "The prevalence of undernourishment in any given country or region measures the share of the population that has a daily food intake that is insufficient to provide, on average, the amount of dietary energy required to maintain a normal, active and healthy life. That is, the share of people who do not get enough calories to live a healthy life.",
                },
                {
                    kind: "heading",
                    text: "How is undernourishment measured?",
                },
                {
                    kind: "paragraph",
                    text: "To judge whether someone was undernourished we would need to know two things:",
                },
                {
                    kind: "paragraph",
                    text: "This might be easy for a known individual, but measuring this across a whole population is more difficult.",
                },
                {
                    kind: "paragraph",
                    text: "The amount of calories that people need can be very different: factors such as someone’s height, weight, sex, age, and activity levels will mean that some people need more calories than others.",
                },
                {
                    kind: "paragraph",
                    text: "The amount of calories that people consume also varies widely – some people eat more than their requirements – which can lead to obesity – while others eat well below their requirements.",
                },
                {
                    kind: "paragraph",
                    text: "This means we cannot simply calculate undernourishment from an average of calorie consumption and requirements.",
                },
                {
                    kind: "paragraph",
                    text: "To take account of this, the UN FAO address inequalities using three factors: :",
                },
                {
                    kind: "paragraph",
                    text: "Using these three factors, they then calculate undernourishment using a ‘parametric probability density function’. This indicates the cumulative probability across a population that someone has a daily energy intake that is lower than the minimum requirements.",
                },
                {
                    kind: "paragraph",
                    text: "This undernourishment measure, therefore, does not tell us anything about what specific individuals are undernourished. But it gives us an estimate of what share of a population does not get enough calories to eat.",
                },
            ],
        },
        {
            url: "https://ourworldindata.org/half-child-deaths-linked-malnutrition",
            title: "Half of all child deaths are linked to malnutrition",
            authors: ["Hannah Ritchie"],
            publishedAt: "2024-09-09",
            excerpt: [
                {
                    kind: "paragraph",
                    text: "In 2021, 4.7 million children under the age of five died; 2.4 million of those were attributed to child and maternal malnutrition. That means around half of child deaths were linked to nutritional deficiencies.",
                },
                {
                    kind: "paragraph",
                    text: "When you think about these deaths, you might imagine a very acute form of hunger: a starving child. While this can happen during famines or in areas with very low levels of food availability, it’s only a small fraction of the total deaths linked to malnutrition.",
                },
                {
                    kind: "paragraph",
                    text: "In most cases, children don’t die of malnutrition. They die from conditions that are exacerbated or are triggered by it. In most cases, it’s a risk factor for premature death. Take the example of the risk factor of smoking. People die from lung cancer, but their risk of developing it is significantly increased if they’ve been a smoker.",
                },
                {
                    kind: "paragraph",
                    text: "In the chart below, we can see how many child deaths are attributed to different nutritional risk factors.",
                },
                {
                    kind: "paragraph",
                    text: "By far, the biggest is low birth weight, which often happens because the mother is malnourished or has experienced infectious diseases during pregnancy. Infants that are born with a low birth weight — which the World Health Organization defines as weighing less than 2,500 grams or 5.5 pounds — have a much higher risk of infant mortality and health complications.",
                },
                {
                    kind: "paragraph",
                    text: "After the first few weeks or months of life, children are also more vulnerable to infection and disease when they’re underweight or are malnourished and don’t develop at a healthy rate. Hundreds of thousands die as a result of “wasting”, which means their weight is too low for their height. Or “stunting”, meaning they are too short for their age.",
                },
                {
                    kind: "paragraph",
                    text: "This is not only about getting enough calories. Children are also malnourished when they don’t eat diverse foods, so they don’t get enough protein, vitamins, and micronutrients.",
                },
                {
                    kind: "paragraph",
                    text: "Death rates from malnutrition are much higher in low-income countries, where children often don’t get the diversity of nutrients they need and where infectious diseases are much more common.",
                },
                {
                    kind: "paragraph",
                    text: "You can see this in the scatterplot below, where malnutrition deaths are plotted on the vertical axis and gross domestic product (GDP) per person on the horizontal axis. In rich countries — on the right of the chart — rates are 20 to 50 times lower than in the poorest countries, on the left.",
                },
            ],
        },
        {
            url: "https://ourworldindata.org/agricultural-productivity-crucial",
            title: "Why is improving agricultural productivity crucial to ending global hunger and protecting the world’s wildlife?",
            authors: ["Max Roser"],
            publishedAt: "2024-03-04",
            excerpt: [
                {
                    kind: "paragraph",
                    text: "The use of land for agriculture has been the main driver of the destruction of the world's biodiversity for a very long time. A look at our history makes clear why.",
                },
                {
                    kind: "paragraph",
                    text: "Our planet has a land surface of about 150 million square kilometers. Almost a third of it is free of vegetation. It is covered by rocks, deserts, and glaciers — especially the large glaciers in Antarctica.",
                },
                {
                    kind: "paragraph",
                    text: "The remaining 71% of the planet’s land surface was once covered by wilderness: large forests, shrubs, and grasslands.",
                },
                {
                    kind: "paragraph",
                    text: "The world’s land surface 10,000 years ago:",
                },
                {
                    kind: "paragraph",
                    text: "How have things changed since the agricultural revolution 10,000 years ago?",
                },
                {
                    kind: "paragraph",
                    text: "The 10.6 billion hectares that were once covered by wilderness are called the world’s “habitable land”. The following chart shows how this land is used today. Almost half is used for agriculture.",
                },
                {
                    kind: "paragraph",
                    text: "The global land area used for agriculture today measures 48 million square kilometers. For comparison, that’s an area around five times the size of the United States.",
                },
                {
                    kind: "paragraph",
                    text: "The world’s habitable land today:",
                },
                {
                    kind: "paragraph",
                    text: "Considering this immense transformation, this article’s first sentence is not surprising: agricultural land use has been the main driver of the destruction of wildlife and nature over the last millennia.",
                },
                {
                    kind: "paragraph",
                    text: "This environmental problem — agricultural land use — does not get the attention it deserves. It’s mentioned far less than other environmental challenges like climate change or plastic pollution. But if we want a future in which we preserve the world’s wildlife, this is the key problem we must focus on.",
                },
                {
                    kind: "paragraph",
                    text: "We can't look at this problem in isolation. At the same time, as we protect the world’s environment, we also have to find ways to produce the food needed to end hunger and malnutrition. But — and this is the point of this article — these two goals are no longer at odds with one another.",
                },
                {
                    kind: "paragraph",
                    text: "For our ancestors they were at odds with one another: our ancestors had to take natural land and convert it into agricultural land if they wanted to produce more food. This is not the case for us today: we can produce more from less.",
                },
            ],
        },
    ],
}
