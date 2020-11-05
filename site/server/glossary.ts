import { memoize } from "grapher/utils/Util"
export interface GlossaryItem {
    term: string
    slug: string
    excerpt: string
}

export interface GlossaryGroup {
    slug: string
    excerpt: string
    terms: string[]
}

export const getMutableGlossary = (glossary: GlossaryGroup[]) => {
    const preparedGlossary = prepareGlossary(glossary)
    // Individual glossary items won't mutated, only deleted so we don't need to
    // deep clone the array.
    return [...preparedGlossary]
}

export const prepareGlossary = memoize(
    (glossary: GlossaryGroup[]): GlossaryItem[] => {
        return sortGlossary(flattenGlossary(glossary))
    }
)

const flattenGlossary = (glossary: GlossaryGroup[]): GlossaryItem[] => {
    return glossary.flatMap(({ slug, excerpt, terms }) =>
        terms.map((term) => {
            return { slug, excerpt, term }
        })
    )
}

/*
 * Sort the glossary * in place *, in descending order of term lengths so that longer terms
 * match and are linked instead of shorter ones, which might be included in
 * them. E.g. favour "population growth" over "population"
 */
export const sortGlossary = (glossary: GlossaryItem[]) => {
    return glossary.sort((a, b) => b.term.length - a.term.length)
}

export const glossary: GlossaryGroup[] = [
    {
        slug: "what-is-correlation",
        excerpt:
            "Correlation is a relationship between two variables. For example, the weight of human individuals is correlated with their height: a tall person usually, but not always, weighs more than a short person. The term correlation usually refers to a single number that reflects the strength of association between two numerical variables (e.g. human height and human weight, which can each be measured on a continuous numerical scale).",
        terms: [
            "Correlation",
            "Linear correlation",
            "Correlation Coefficient",
            "Pearson Correlation Coefficient",
        ],
    },
    {
        slug: "what-s-the-difference-between-correlation-and-causation",
        excerpt:
            " A causal relationship is a specific type of directed cause-and-effect association between two variables. Correlation doesn’t imply causation, nor does causation imply correlation.",
        terms: ["Causality"],
    },
    {
        slug: "what-is-a-linear-regression",
        excerpt:
            "In statistics, a regression is an approach for modeling the relationship between two or more variables. In its simplest form, regressing two variables requires finding a line of best fit to describe the relationship between them.",
        terms: ["Regression analysis", "Regression coefficient"],
    },
    {
        slug: "what-is-a-confidence-interval",
        excerpt:
            "When we want to understand the relationship between variables, we typically attempt to estimate it using data from a sample. A ‘confidence interval’ is a statistical method that gives us an indication of just how accurate our sample estimate is.",
        terms: ["Confidence interval", "Selection bias"],
    },
    {
        slug: "what-is-a-statistical-significance-test",
        excerpt:
            "We are often interested in knowing whether there is clear evidence of a particular relationship between two variables. For example, how strong is the evidence against the hypothesis that two variables are uncorrelated? We can ask this question by performing a ‘significance test’. When we perform such a test, a statistical metric called the ‘p-value’ helps us interpret the result.",
        terms: [
            "Statistical significance test",
            "Statistical hypothesis testing",
            "p-value",
        ],
    },
    {
        slug: "what-is-the-poverty-headcount-ratio",
        excerpt:
            "The poverty headcount ratio is an indicator of the incidence of poverty. It is calculated by counting the number of people in a country living with incomes or consumption levels below a given poverty line, and dividing this number of poor people by the entire population in the country.",
        terms: ["Poverty Headcount Ratio"],
    },
    {
        slug: "what-is-the-international-poverty-line",
        excerpt:
            "The International Poverty Line is the threshold used measure extreme poverty.",
        terms: ["International Poverty Line"],
    },
    {
        slug: "what-are-ppp-conversion-rates",
        excerpt:
            "Purchasing power parity rates (PPP rates), are conversion rates used to adjust for cross-country differences in price levels. PPP rates allow translating monetary values in local currencies into ‘international dollars’ (noted int-$).",
        terms: ["PPP conversion rates", "PPP adjustments", "PPP rates"],
    },
    {
        slug: "what-are-international-dollars",
        excerpt:
            "International dollars are a hypothetical currency used as common unit of measure for making cross-country comparisons of monetary indicators of standards of living.",
        terms: ["International Dollars"],
    },
    {
        slug: "what-is-the-poverty-gap-index",
        excerpt:
            "The poverty gap index is an indicator of the intensity of poverty in a population. It is defined as the mean shortfall of the total population from the poverty line (counting the non-poor as having zero shortfall), expressed as a percentage of the poverty line.",
        terms: ["Poverty Gap Index"],
    },
    {
        slug: "what-are-poverty-traps",
        excerpt:
            "Economists use the term ‘poverty trap’ to denote a situation in which individuals are stuck in deprivation over long periods of time, and there is nothing they can do by themselves to escape such situation. The term captures a situation in which poverty today causes poverty in the future, so households that start poor, remain poor.",
        terms: ["Poverty Traps"],
    },
    {
        slug: "what-is-relative-poverty",
        excerpt:
            "People are considered to live in ‘relative poverty’ if their living conditions are below those of a particular group of people at a particular point in time. In most cases, relative poverty is measured with respect to a poverty line that is defined relative to the median income in the corresponding country.",
        terms: ["Relative Poverty"],
    },
    {
        slug: "what-is-absolute-poverty",
        excerpt:
            "People are considered to live in ‘absolute poverty’ if their living conditions are below a fixed minimum standard of living.",
        terms: ["Absolute Poverty"],
    },
    {
        slug: "what-are-randomized-control-trials",
        excerpt:
            "A Randomised Control Trial (RCT) is a technique used to evaluate the causal effect of an intervention, such as a medical treatment or a public policy.",
        terms: ["Randomized Control Trials", "RCT"],
    },
    {
        slug: "what-is-the-gini-coefficient",
        excerpt:
            "The Gini coefficient – or Gini index – is a measure of the degree of inequality in the distribution of incomes in a population.",
        terms: ["Gini Coefficient", "Gini index"],
    },
    {
        slug: "what-are-carbon-dioxide-equivalents-co2eq",
        excerpt:
            "To capture all GHG emissions, researchers therefore express them in ‘carbon dioxide-equivalents’ (CO2eq). This metric takes account not just CO2 but all greenhouse gases.",
        terms: ["Carbon dioxide-equivalents", "CO2eq"],
    },
    {
        slug: "what-is-global-warming-potential",
        excerpt:
            "GWP measures the relative warming impact of one molecule or unit mass of a greenhouse gas relative to carbon dioxide over a given timescale – usually over 100 years.",
        terms: ["Global Warming Potential", "GWP"],
    },
    {
        slug: "what-are-food-miles",
        excerpt:
            "Food miles are measured in tonne-kilometers which represents the transport of one tonne of goods by a given transport mode (road, rail, air, sea, inland waterways, pipeline etc.) over a distance of one kilometre.",
        terms: ["Food Miles"],
    },
    {
        slug: "what-is-a-carbon-budget",
        excerpt:
            "‘Carbon budget’ is a concept used to define the quantity of greenhouse gases we can emit over a given period of time before average warming would exceed a given level – for example, 2°C higher than pre-industrial temperatures.",
        terms: ["Carbon Budget"],
    },
    {
        slug: "what-is-radiative-forcing",
        excerpt:
            "Radiative forcing measures the difference between incoming energy and the energy radiated back to space. If more energy is absorbed than radiated, the atmosphere becomes warmer.",
        terms: ["Effective radiative forcing", "Radiative forcing", "RF"],
    },
    {
        slug: "what-is-child-mortality",
        excerpt:
            "Child mortality measures the share of newborns who die before reaching the age of five.",
        terms: ["Child mortality rate", "Child mortality"],
    },
    {
        slug: "what-is-infant-mortality",
        excerpt:
            "Infant mortality measures the share of newborns who die before reaching one year of age.",
        terms: ["Infant mortality rate", "Infant mortality"],
    },
    {
        slug: "what-is-neonatal-mortality",
        excerpt:
            "Neonatal mortality measures the share of newborns who die before reaching 28 days of age.",
        terms: ["Neonatal mortality rate", "Neonatal mortality"],
    },
    {
        slug: "what-is-maternal-mortality",
        excerpt:
            "The maternal mortality ratio measures the number of women who die from pregnancy-related causes per 100,000 live births.",
        terms: [
            "Maternal mortality ratio",
            "Maternal mortality rate",
            "Maternal mortality",
        ],
    },
    {
        slug: "what-is-a-maternal-death",
        excerpt:
            "A maternal death refers to the death of a woman while pregnant or within 42 days of termination of pregnancy. Included are deaths from any cause related to or aggravated by the pregnancy but not from accidental or incidental causes.",
        terms: ["Maternal deaths", "Maternal death"],
    },
    {
        slug: "what-is-fertility-rate",
        excerpt:
            "Children per woman is measured as the total fertility rate, which is the number of children that would be born to the average woman if she were to live to the end of her child-bearing years and give birth to children at the current age-specific fertility rates.",
        terms: ["Fertility rates", "Fertility rate"],
    },
]
