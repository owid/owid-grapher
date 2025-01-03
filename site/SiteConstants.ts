import { faRss } from "@fortawesome/free-solid-svg-icons"
import {
    faXTwitter,
    faFacebookSquare,
    faInstagram,
    faThreads,
    faLinkedin,
    faBluesky,
} from "@fortawesome/free-brands-svg-icons"
import { CategoryWithEntries, SubNavId } from "@ourworldindata/types"

// See https://cdnjs.cloudflare.com/polyfill/ for a list of all supported features
const polyfillFeatures = [
    "es2021", // String.replaceAll, Promise.any, ...
    "es2022", // Array.at, String.at, ...
    "es2023", // Array.findLast, Array.toReversed, Array.toSorted, Array.with, ...
    "IntersectionObserver",
    "IntersectionObserverEntry",
]
const POLYFILL_VERSION = "4.8.0"
export const POLYFILL_URL: string = `https://cdnjs.cloudflare.com/polyfill/v3/polyfill.min.js?version=${POLYFILL_VERSION}&features=${polyfillFeatures.join(
    ","
)}`

export const DEFAULT_LOCAL_BAKE_DIR = "localBake"

export const GRAPHER_PREVIEW_CLASS = "grapherPreview"

export const SMALL_BREAKPOINT_MEDIA_QUERY = "(max-width: 768px)"

export const TOUCH_DEVICE_MEDIA_QUERY =
    "(hover: none), (pointer: coarse), (pointer: none)"

export const DATA_INSIGHTS_ATOM_FEED_NAME = "atom-data-insights.xml"

export const DATA_INSIGHT_ATOM_FEED_PROPS = {
    title: "Atom feed for Daily Data Insights",
    href: `https://ourworldindata.org/${DATA_INSIGHTS_ATOM_FEED_NAME}`,
}

export const DEFAULT_TOMBSTONE_REASON =
    "Our World in Data is designed to be an evergreen publication. This " +
    "means that when a page cannot be updated due to outdated data or " +
    "missing information, we prefer to remove it rather than present " +
    "incomplete or inaccurate research and data to our readers."

export const SOCIALS = [
    {
        title: "X",
        url: "https://x.com/ourworldindata",
        icon: faXTwitter,
    },
    {
        title: "Instagram",
        url: "https://www.instagram.com/ourworldindata/",
        icon: faInstagram,
    },
    {
        title: "Threads",
        url: "https://www.threads.net/@ourworldindata",
        icon: faThreads,
    },
    {
        title: "Facebook",
        url: "https://facebook.com/ourworldindata",
        icon: faFacebookSquare,
    },
    {
        title: "LinkedIn",
        url: "https://www.linkedin.com/company/ourworldindata",
        icon: faLinkedin,
    },
    {
        title: "Bluesky",
        url: "https://bsky.app/profile/ourworldindata.org",
        icon: faBluesky,
    },
]

export const RSS_FEEDS = [
    {
        title: "Research & Writing RSS Feed",
        url: "/atom.xml",
        icon: faRss,
    },
    {
        title: "Daily Data Insights RSS Feed",
        url: `/${DATA_INSIGHTS_ATOM_FEED_NAME}`,
        icon: faRss,
    },
]

export enum Menu {
    Topics = "topics",
    Resources = "resources",
    About = "about",
    Subscribe = "subscribe",
    Search = "search",
}

export const ABOUT_LINKS = [
    { title: "About Us", url: "/about" },
    { title: "Organization", url: "/organization" },
    { title: "Funding", url: "/funding" },
    { title: "Team", url: "/team" },
    { title: "Jobs", url: "/jobs" },
    { title: "FAQs", url: "/faqs" },
]

export const SiteNavigationStatic: { categories: CategoryWithEntries[] } = {
    categories: [
        {
            name: "Population and Demographic Change",
            slug: "population",
            entries: [],
            subcategories: [
                {
                    name: "Population Change",
                    slug: "population-change",
                    entries: [
                        {
                            slug: "population-growth",
                            title: "Population Growth",
                        },
                        {
                            slug: "age-structure",
                            title: "Age Structure",
                        },
                        {
                            slug: "gender-ratio",
                            title: "Gender Ratio",
                        },
                    ],
                },
                {
                    name: "Births and Deaths",
                    slug: "births-and-deaths",
                    entries: [
                        {
                            slug: "life-expectancy",
                            title: "Life Expectancy",
                        },
                        {
                            slug: "fertility-rate",
                            title: "Fertility Rate",
                        },
                        {
                            slug: "child-mortality",
                            title: "Child and Infant Mortality",
                        },
                    ],
                },
                {
                    name: "Geography of the World Population",
                    slug: "distribution-of-the-world-population",
                    entries: [
                        {
                            slug: "urbanization",
                            title: "Urbanization",
                        },
                        {
                            slug: "migration",
                            title: "Migration",
                        },
                    ],
                },
            ],
        },
        {
            name: "Health",
            slug: "health",
            entries: [],
            subcategories: [
                {
                    name: "Life and Death",
                    slug: "life-and-death",
                    entries: [
                        {
                            slug: "health-meta",
                            title: "Global Health",
                        },
                        {
                            slug: "causes-of-death",
                            title: "Causes of Death",
                        },
                        {
                            slug: "child-mortality",
                            title: "Child and Infant Mortality",
                        },
                        {
                            slug: "burden-of-disease",
                            title: "Burden of Disease",
                        },
                        {
                            slug: "life-expectancy",
                            title: "Life Expectancy",
                        },
                        {
                            slug: "mental-health",
                            title: "Mental Health",
                        },
                        {
                            slug: "suicide",
                            title: "Suicides",
                        },
                        {
                            slug: "cardiovascular-diseases",
                            title: "Cardiovascular Diseases",
                        },
                        {
                            slug: "cancer",
                            title: "Cancer",
                        },
                        {
                            slug: "maternal-mortality",
                            title: "Maternal Mortality",
                        },
                    ],
                },
                {
                    name: "Health Risks",
                    slug: "health-risks",
                    entries: [
                        {
                            slug: "air-pollution",
                            title: "Air Pollution",
                        },
                        {
                            slug: "outdoor-air-pollution",
                            title: "Outdoor Air Pollution",
                        },
                        {
                            slug: "indoor-air-pollution",
                            title: "Indoor Air Pollution",
                        },
                        {
                            slug: "lead-pollution",
                            title: "Lead Pollution",
                        },
                        {
                            slug: "alcohol-consumption",
                            title: "Alcohol Consumption",
                        },
                        {
                            slug: "illicit-drug-use",
                            title: "Opioids, Cocaine, Cannabis, and Other Illicit Drugs",
                        },

                        {
                            slug: "obesity",
                            title: "Obesity",
                        },
                        {
                            slug: "smoking",
                            title: "Smoking",
                        },
                    ],
                },
                {
                    name: "Infectious Diseases",
                    slug: "infectious-diseases",
                    entries: [
                        {
                            slug: "pandemics",
                            title: "Pandemics",
                        },
                        {
                            slug: "coronavirus",
                            title: "Coronavirus Pandemic (COVID-19)",
                        },
                        {
                            slug: "malaria",
                            title: "Malaria",
                        },
                        {
                            slug: "hiv-aids",
                            title: "HIV/AIDS",
                        },
                        {
                            slug: "diarrheal-diseases",
                            title: "Diarrheal Diseases",
                        },
                        {
                            slug: "tuberculosis",
                            title: "Tuberculosis",
                        },
                        {
                            slug: "polio",
                            title: "Polio",
                        },
                        {
                            slug: "neglected-tropical-diseases",
                            title: "Neglected Tropical Diseases",
                        },
                        {
                            slug: "influenza",
                            title: "Influenza",
                        },
                        {
                            slug: "pneumonia",
                            title: "Pneumonia",
                        },
                        {
                            slug: "tetanus",
                            title: "Tetanus",
                        },
                        {
                            slug: "monkeypox",
                            title: "Mpox",
                        },
                        {
                            slug: "smallpox",
                            title: "Smallpox",
                        },
                    ],
                },
                {
                    name: "Health Institutions and Interventions",
                    slug: "health-institutions-and-interventions",
                    entries: [
                        {
                            slug: "eradication-of-diseases",
                            title: "Eradication of Diseases",
                        },
                        {
                            slug: "vaccination",
                            title: "Vaccination",
                        },
                        {
                            slug: "antibiotics",
                            title: "Antibiotics and Antibiotic Resistance",
                        },
                        {
                            slug: "financing-healthcare",
                            title: "Healthcare Spending",
                        },
                    ],
                },
            ],
        },
        {
            name: "Energy and Environment",
            slug: "environment",
            entries: [],
            subcategories: [
                {
                    name: "Climate and Air",
                    slug: "climate-and-air",
                    entries: [
                        {
                            slug: "climate-change",
                            title: "Climate Change",
                        },
                        {
                            slug: "co2-and-greenhouse-gas-emissions",
                            title: "CO₂ and Greenhouse Gas Emissions",
                        },
                        {
                            slug: "air-pollution",
                            title: "Air Pollution",
                        },
                        {
                            slug: "outdoor-air-pollution",
                            title: "Outdoor Air Pollution",
                        },
                        {
                            slug: "indoor-air-pollution",
                            title: "Indoor Air Pollution",
                        },
                        {
                            slug: "ozone-layer",
                            title: "Ozone Layer",
                        },
                    ],
                },
                {
                    name: "Energy Systems",
                    slug: "energy-systems",
                    entries: [
                        {
                            slug: "energy",
                            title: "Energy",
                        },
                        {
                            slug: "energy-access",
                            title: "Access to Energy",
                        },
                        {
                            slug: "fossil-fuels",
                            title: "Fossil Fuels",
                        },
                        {
                            slug: "renewable-energy",
                            title: "Renewable Energy",
                        },

                        {
                            slug: "nuclear-energy",
                            title: "Nuclear Energy",
                        },
                        {
                            slug: "metals-minerals",
                            title: "Metals and Minerals",
                        },
                    ],
                },
                {
                    name: "Environment and Ecosystems",
                    slug: "land-and-ecosystems",
                    entries: [
                        {
                            slug: "natural-disasters",
                            title: "Natural Disasters",
                        },
                        {
                            slug: "biodiversity",
                            title: "Biodiversity",
                        },
                        {
                            slug: "environmental-impacts-of-food",
                            title: "Environmental Impacts of Food Production",
                        },
                        {
                            slug: "fish-and-overfishing",
                            title: "Fish and Overfishing",
                        },
                        {
                            slug: "land-use",
                            title: "Land Use",
                        },
                        {
                            slug: "water-use-stress",
                            title: "Water Use and Stress",
                        },
                        {
                            slug: "forests-and-deforestation",
                            title: "Forests and Deforestation",
                        },
                        {
                            slug: "wildfires",
                            title: "Wildfires",
                        },
                        {
                            slug: "animal-welfare",
                            title: "Animal Welfare",
                        },
                    ],
                },
                {
                    name: "Waste and Pollution",
                    slug: "waste-and-pollution",
                    entries: [
                        {
                            slug: "plastic-pollution",
                            title: "Plastic Pollution",
                        },
                        {
                            slug: "oil-spills",
                            title: "Oil Spills",
                        },
                        {
                            slug: "lead-pollution",
                            title: "Lead Pollution",
                        },
                    ],
                },
            ],
        },
        {
            name: "Food and Agriculture",
            slug: "food",
            entries: [],
            subcategories: [
                {
                    name: "Food Production",
                    slug: "food-production",
                    entries: [
                        {
                            slug: "agricultural-production",
                            title: "Agricultural Production",
                        },
                        {
                            slug: "meat-production",
                            title: "Meat and Dairy Production",
                        },
                        {
                            slug: "fish-and-overfishing",
                            title: "Fish and Overfishing",
                        },
                        {
                            slug: "crop-yields",
                            title: "Crop Yields",
                        },
                        {
                            slug: "animal-welfare",
                            title: "Animal Welfare",
                        },
                        {
                            slug: "environmental-impacts-of-food",
                            title: "Environmental Impacts of Food Production",
                        },
                        {
                            slug: "farm-size",
                            title: "Farm Size and Productivity",
                        },
                    ],
                },
                {
                    name: "Agricultural Inputs",
                    slug: "agricultural-inputs",
                    entries: [
                        {
                            slug: "land-use",
                            title: "Land Use",
                        },
                        {
                            slug: "fertilizers",
                            title: "Fertilizers",
                        },
                        {
                            slug: "pesticides",
                            title: "Pesticides",
                        },
                        {
                            slug: "employment-in-agriculture",
                            title: "Employment in Agriculture",
                        },
                    ],
                },
                {
                    name: "Nutrition",
                    slug: "nutrition",
                    entries: [
                        {
                            slug: "hunger-and-undernourishment",
                            title: "Hunger and Undernourishment",
                        },
                        {
                            slug: "food-supply",
                            title: "Food Supply",
                        },
                        {
                            slug: "food-prices",
                            title: "Food Prices",
                        },

                        {
                            slug: "obesity",
                            title: "Obesity",
                        },
                        {
                            slug: "famines",
                            title: "Famines",
                        },
                        {
                            slug: "diet-compositions",
                            title: "Diet Compositions",
                        },
                        {
                            slug: "micronutrient-deficiency",
                            title: "Micronutrient Deficiency",
                        },
                        {
                            slug: "human-height",
                            title: "Human Height",
                        },
                    ],
                },
            ],
        },
        {
            name: "Poverty and Economic Development",
            slug: "growth-inequality",
            entries: [],
            subcategories: [
                {
                    name: "Poverty and Prosperity",
                    slug: "poverty-and-prosperity",
                    entries: [
                        {
                            slug: "poverty",
                            title: "Poverty",
                        },
                        {
                            slug: "economic-growth",
                            title: "Economic Growth",
                        },
                        {
                            slug: "economic-inequality",
                            title: "Economic Inequality",
                        },
                        {
                            slug: "foreign-aid",
                            title: "Foreign Aid",
                        },
                        {
                            slug: "economic-inequality-by-gender",
                            title: "Economic Inequality by Gender",
                        },
                    ],
                },
                {
                    name: "Public Sector",
                    slug: "public-sector",
                    entries: [
                        {
                            slug: "government-spending",
                            title: "Government Spending",
                        },
                        {
                            slug: "state-capacity",
                            title: "State Capacity",
                        },
                        {
                            slug: "taxation",
                            title: "Taxation",
                        },
                        {
                            slug: "corruption",
                            title: "Corruption",
                        },
                        {
                            slug: "financing-healthcare",
                            title: "Healthcare Spending",
                        },
                        {
                            slug: "financing-education",
                            title: "Education Spending",
                        },
                        {
                            slug: "military-personnel-spending",
                            title: "Military Personnel and Spending",
                        },
                    ],
                },

                {
                    name: "Labor",
                    slug: "labor",
                    entries: [
                        {
                            slug: "female-labor-supply",
                            title: "Women’s Employment",
                        },
                        {
                            slug: "child-labor",
                            title: "Child Labor",
                        },
                        {
                            slug: "working-hours",
                            title: "Working Hours",
                        },
                    ],
                },
                {
                    name: "Global Connections",
                    slug: "trade-migration",
                    entries: [
                        {
                            slug: "trade-and-globalization",
                            title: "Trade and Globalization",
                        },
                        {
                            slug: "migration",
                            title: "Migration",
                        },
                        {
                            slug: "tourism",
                            title: "Tourism",
                        },
                    ],
                },
                {
                    name: "Water",
                    slug: "water",
                    entries: [
                        {
                            slug: "clean-water-sanitation",
                            title: "Clean Water and Sanitation",
                        },
                        {
                            slug: "water-access",
                            title: "Clean Water",
                        },
                        {
                            slug: "sanitation",
                            title: "Sanitation",
                        },
                    ],
                },
            ],
        },
        {
            name: "Education and Knowledge",
            slug: "education",
            entries: [],
            subcategories: [
                {
                    name: "Education",
                    slug: "educational-outcomes",
                    entries: [
                        {
                            slug: "global-education",
                            title: "Global Education",
                        },
                        {
                            slug: "literacy",
                            title: "Literacy",
                        },
                        {
                            slug: "financing-education",
                            title: "Education Spending",
                        },
                    ],
                },
                {
                    name: "Knowledge",
                    slug: "inputs-to-education",
                    entries: [
                        {
                            slug: "research-and-development",
                            title: "Research and Development",
                        },
                        {
                            slug: "internet",
                            title: "Internet",
                        },
                        {
                            slug: "books",
                            title: "Books",
                        },
                    ],
                },
            ],
        },
        {
            name: "Innovation and Technological Change",
            slug: "technology",
            entries: [
                {
                    slug: "technological-change",
                    title: "Technological Change",
                },
                {
                    slug: "research-and-development",
                    title: "Research and Development",
                },
                {
                    slug: "artificial-intelligence",
                    title: "Artificial Intelligence",
                },
                {
                    slug: "internet",
                    title: "Internet",
                },
                {
                    slug: "space-exploration-satellites",
                    title: "Space Exploration and Satellites",
                },
                {
                    slug: "transport",
                    title: "Transport",
                },
            ],
            subcategories: [],
        },
        {
            name: "Living Conditions, Community, and Wellbeing",
            slug: "work-life",
            entries: [],
            subcategories: [
                {
                    name: "Housing and Infrastructure",
                    slug: "housing-and-infrastructure",
                    entries: [
                        {
                            slug: "homelessness",
                            title: "Homelessness",
                        },
                        {
                            slug: "energy-access",
                            title: "Access to Energy",
                        },
                        {
                            slug: "indoor-air-pollution",
                            title: "Indoor Air Pollution",
                        },

                        {
                            slug: "clean-water-sanitation",
                            title: "Clean Water and Sanitation",
                        },
                        {
                            slug: "water-access",
                            title: "Clean Water",
                        },
                        {
                            slug: "sanitation",
                            title: "Sanitation",
                        },
                        {
                            slug: "light-at-night",
                            title: "Light at Night",
                        },
                    ],
                },
                {
                    name: "Time Use",
                    slug: "time-use",
                    entries: [
                        {
                            slug: "time-use",
                            title: "Time Use",
                        },
                        {
                            slug: "working-hours",
                            title: "Working Hours",
                        },
                    ],
                },
                {
                    name: "Relationships",
                    slug: "relationships",
                    entries: [
                        {
                            slug: "marriages-and-divorces",
                            title: "Marriages and Divorces",
                        },
                        {
                            slug: "social-connections-and-loneliness",
                            title: "Loneliness and Social Connections",
                        },
                        {
                            slug: "trust",
                            title: "Trust",
                        },
                    ],
                },
                {
                    name: "Happiness and Wellbeing",
                    slug: "happiness-wellbeing",
                    entries: [
                        {
                            slug: "happiness-and-life-satisfaction",
                            title: "Happiness and Life Satisfaction",
                        },
                        {
                            slug: "human-development-index",
                            title: "Human Development Index (HDI)",
                        },
                    ],
                },
            ],
        },
        {
            name: "Human Rights and Democracy",
            slug: "politics",
            entries: [
                {
                    slug: "human-rights",
                    title: "Human Rights",
                },
                {
                    slug: "democracy",
                    title: "Democracy",
                },
                {
                    slug: "state-capacity",
                    title: "State Capacity",
                },
                {
                    slug: "women-rights",
                    title: "Women’s Rights",
                },
                {
                    slug: "lgbt-rights",
                    title: "LGBT+ Rights",
                },
                {
                    slug: "corruption",
                    title: "Corruption",
                },
                {
                    slug: "economic-inequality-by-gender",
                    title: "Economic Inequality by Gender",
                },
                {
                    slug: "child-labor",
                    title: "Child Labor",
                },
                {
                    slug: "violence-against-rights-for-children",
                    title: "Violence Against Children and Children’s Rights",
                },
            ],
            subcategories: [],
        },
        {
            name: "Violence and War",
            slug: "violence-rights",
            entries: [
                {
                    slug: "war-and-peace",
                    title: "War and Peace",
                },
                {
                    slug: "nuclear-weapons",
                    title: "Nuclear Weapons",
                },
                {
                    slug: "homicides",
                    title: "Homicides",
                },
                {
                    slug: "terrorism",
                    title: "Terrorism",
                },
                {
                    slug: "state-capacity",
                    title: "State Capacity",
                },
                {
                    slug: "military-personnel-spending",
                    title: "Military Personnel and Spending",
                },
                {
                    slug: "violence-against-rights-for-children",
                    title: "Violence Against Children and Children’s Rights",
                },
            ],
            subcategories: [],
        },
    ],
}

export interface SubnavItem {
    label: string
    href: string
    id: string
    highlight?: boolean
    parentId?: string
}

export const landingPageSlugs: {
    [key in SubNavId]: string
} = {
    about: "about",
    coronavirus: "coronavirus",
    co2: "co2-and-greenhouse-gas-emissions",
    energy: "energy",
    forests: "forests-and-deforestation",
    biodiversity: "biodiversity",
    water: "clean-water-sanitation",
    explorers: "food-explorers",
}

export const subnavs: {
    [key in SubNavId]: SubnavItem[]
} = {
    about: [
        // `label` is shown in the UI, `id` is specified as a formatting option
        // on a page (the top html comment in WordPress)
        { label: "About", href: `/${landingPageSlugs.about}`, id: "about" },
        { label: "Team", href: "/team", id: "team" },
        { label: "Organization", href: "/organization", id: "organization" },
        { label: "Funding", href: "/funding", id: "supporters" },
        { label: "FAQs", href: "/faqs", id: "faqs" },
        { label: "Audience & Coverage", href: "/coverage", id: "coverage" },
        {
            label: "History",
            href: "/history-of-our-world-in-data",
            id: "history",
        },
        { label: "Grapher", href: "/owid-grapher", id: "grapher" },
        { label: "Jobs", href: "/jobs", id: "jobs" },
        { label: "Contact", href: "/about#contact", id: "contact" },
    ],
    coronavirus: [
        {
            label: "Coronavirus",
            href: `/${landingPageSlugs.coronavirus}`,
            id: "coronavirus",
        },
        {
            label: "By country",
            href: "/coronavirus#coronavirus-country-profiles",
            id: "by-country",
            highlight: true,
        },
        {
            label: "Data explorer",
            href: "/explorers/coronavirus-data-explorer",
            id: "data-explorer",
            highlight: true,
        },
        { label: "Deaths", href: "/covid-deaths", id: "deaths" },
        { label: "Cases", href: "/covid-cases", id: "cases" },
        { label: "Tests", href: "/coronavirus-testing", id: "testing" },
        {
            label: "Hospitalizations",
            href: "/covid-hospitalizations",
            id: "hospitalizations",
        },
        {
            label: "Vaccinations",
            href: "/covid-vaccinations",
            id: "vaccinations",
        },
        {
            label: "Mortality risk",
            href: "/mortality-risk-covid",
            id: "mortality-risk",
        },
        {
            label: "Excess mortality",
            href: "/excess-mortality-covid",
            id: "excess-mortality",
        },
        {
            label: "Policy responses",
            href: "/policy-responses-covid",
            id: "policy-responses",
        },
    ],
    co2: [
        {
            label: "CO₂ and GHG Emissions",
            href: `/${landingPageSlugs.co2}`,
            id: "co2-and-ghg-emissions",
            highlight: true,
        },
        {
            label: "By country",
            href: "/co2-and-greenhouse-gas-emissions#co2-and-greenhouse-gas-emissions-country-profiles",
            id: "by-country",
        },
        {
            label: "Data explorer",
            href: "/explorers/co2",
            id: "co2-data-explorer",
        },
        { label: "CO₂ emissions", href: "/co2-emissions", id: "co2-emissions" },
        { label: "CO₂ by fuel", href: "/emissions-by-fuel", id: "by-fuel" },
        {
            label: "GHG emissions",
            href: "/greenhouse-gas-emissions",
            id: "ghg-emissions",
        },
        { label: "By sector", href: "/emissions-by-sector", id: "by-sector" },
        {
            label: "Atmospheric concentrations",
            href: "/atmospheric-concentrations",
            id: "atm-concentrations",
        },
        {
            label: "Climate impacts",
            href: "/explorers/climate-change",
            id: "climate-impacts",
        },
    ],
    energy: [
        {
            label: "Energy",
            href: `/${landingPageSlugs.energy}`,
            id: "energy",
            highlight: true,
        },
        {
            label: "By country",
            href: "/energy#country-profiles",
            id: "by-country",
        },
        {
            label: "Data explorer",
            href: "/explorers/energy",
            id: "energy-data-explorer",
        },
        { label: "Energy access", href: "/energy-access", id: "energy-access" },
        {
            label: "Production & Consumption",
            href: "/energy-production-consumption",
            id: "production-consumption",
        },
        { label: "Energy mix", href: "/energy-mix", id: "energy-mix" },
        {
            label: "Electricity mix",
            href: "/electricity-mix",
            id: "electricity-mix",
        },
        { label: "Fossil fuels", href: "/fossil-fuels", id: "fossil-fuels" },
        {
            label: "Renewables",
            href: "/renewable-energy",
            id: "renewable-energy",
        },
        { label: "Nuclear", href: "/nuclear-energy", id: "nuclear-energy" },
        { label: "Transport", href: "/transport", id: "transport" },
    ],
    forests: [
        {
            label: "Forests",
            href: `/${landingPageSlugs.forests}`,
            id: "forests",
        },
        {
            label: "Forest area",
            href: "/forest-area",
            id: "forest-area",
        },
        {
            label: "Deforestation",
            href: "/deforestation",
            id: "deforestation",
        },
        {
            label: "Afforestation",
            href: "/afforestation",
            id: "afforestation",
        },
        {
            label: "Drivers of Deforestation",
            href: "/drivers-of-deforestation",
            id: "drivers-of-deforestation",
        },
        {
            label: "Palm oil",
            href: "/palm-oil",
            id: "palm-oil",
        },
        {
            label: "Soy",
            href: "/soy",
            id: "soy",
        },
    ],
    biodiversity: [
        {
            label: "Biodiversity",
            href: `/${landingPageSlugs.biodiversity}`,
            id: "biodiversity",
            highlight: true,
        },
        {
            label: "Biodiversity and Wildlife",
            href: "/biodiversity-and-wildlife",
            id: "biodiversity-and-wildlife",
        },
        {
            label: "Mammals",
            href: "/mammals",
            id: "mammals",
        },
        {
            label: "Birds",
            href: "/birds",
            id: "birds",
        },
        {
            label: "Fish and Overfishing",
            href: "/fish-and-overfishing",
            id: "fish",
        },
        {
            label: "Coral reefs",
            href: "/coral-reefs",
            id: "coral-reefs",
        },
        {
            label: "Living Planet Index",
            href: "/living-planet-index",
            id: "living-planet-index",
        },
        {
            label: "Extinctions",
            href: "/extinctions",
            id: "extinctions",
        },
        {
            label: "Threats to Wildlife",
            href: "/threats-to-wildlife",
            id: "threats-to-wildlife",
        },
        {
            label: "Poaching",
            href: "/poaching-and-wildlife-trade",
            id: "poaching-and-wildlife-trade",
        },
        {
            label: "Habitat Loss",
            href: "/habitat-loss",
            id: "habitat-loss",
        },
        {
            label: "Protected areas and conservation",
            href: "/protected-areas-and-conservation",
            id: "protected-areas-and-conservation",
        },
    ],
    water: [
        {
            label: "Clean Water and Sanitation",
            href: `/${landingPageSlugs.water}`,
            id: "wash",
        },
        {
            label: "Data explorer",
            href: "/explorers/water-and-sanitation",
            id: "wash-data-explorer",
        },
        {
            label: "Drinking water",
            href: "/water-access",
            id: "drinking-water",
        },
        {
            label: "Sanitation",
            href: "/sanitation",
            id: "sanitation",
        },
        {
            label: "Handwashing",
            href: "/hygiene",
            id: "hygiene",
        },
    ],
    explorers: [
        {
            label: "Data Explorers",
            href: `/${landingPageSlugs.explorers}`,
            id: "food-explorers",
            highlight: true,
        },
        {
            label: "Global Food",
            href: "/explorers/global-food",
            id: "global-food",
        },
        {
            label: "Environmental Impacts of Food",
            href: "/explorers/food-footprints",
            id: "food-footprints",
        },
        {
            label: "Crop Yields",
            href: "/explorers/crop-yields",
            id: "crop-yields",
        },
        {
            label: "Fertilizers",
            href: "/explorers/fertilizers",
            id: "fertilizers",
        },
        {
            label: "Habitat Loss",
            href: "/explorers/habitat-loss",
            id: "habitat-loss",
        },
        {
            label: "Food Prices",
            href: "/explorers/food-prices",
            id: "food-prices",
        },
    ],
}

export enum GalleryArrowDirection {
    prev = "prev",
    next = "next",
}

export const MOST_RECENT_DATA_INSIGHT = "most-recent-data-insight"
export const SECOND_MOST_RECENT_INSIGHT = "second-most-recent-data-insight"
export const THIRD_MOST_RECENT_INSIGHT = "third-most-recent-data-insight"
export const FOURTH_MOST_RECENT_INSIGHT = "fourth-most-recent-data-insight"
export const FIFTH_MOST_RECENT_INSIGHT = "fifth-most-recent-data-insight"
export const SIXTH_MOST_RECENT_INSIGHT = "sixth-most-recent-data-insight"
export const SEVENTH_MOST_RECENT_INSIGHT = "seventh-most-recent-data-insight"

export const dataInsightIndexToIdMap: Record<number, string> = {
    0: MOST_RECENT_DATA_INSIGHT,
    1: SECOND_MOST_RECENT_INSIGHT,
    2: THIRD_MOST_RECENT_INSIGHT,
    3: FOURTH_MOST_RECENT_INSIGHT,
    4: FIFTH_MOST_RECENT_INSIGHT,
    5: SIXTH_MOST_RECENT_INSIGHT,
    6: SEVENTH_MOST_RECENT_INSIGHT,
}
