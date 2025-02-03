import { faRss } from "@fortawesome/free-solid-svg-icons"
import {
    faXTwitter,
    faFacebookSquare,
    faInstagram,
    faThreads,
    faLinkedin,
    faBluesky,
} from "@fortawesome/free-brands-svg-icons"
import { SubNavId } from "@ourworldindata/types"

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
