import { faRss } from "@fortawesome/free-solid-svg-icons"
import {
    faXTwitter,
    faInstagram,
    faThreads,
    faLinkedin,
    faGithub,
    faBluesky,
    faFacebook,
} from "@fortawesome/free-brands-svg-icons"

// See https://cdnjs.cloudflare.com/polyfill/ for a list of all supported features
const polyfillFeatures = [
    "es2022", // Array.at, String.at, ...
    "es2023", // Array.findLast, Array.toReversed, Array.toSorted, Array.with, ...
]
const POLYFILL_VERSION = "4.8.0"
export const POLYFILL_URL: string = `https://cdnjs.cloudflare.com/polyfill/v3/polyfill.min.js?version=${POLYFILL_VERSION}&features=${polyfillFeatures.join(
    ","
)}`

export const PROD_URL = "https://ourworldindata.org"

export const DEFAULT_LOCAL_BAKE_DIR = "localBake"

export const SMALL_BREAKPOINT_MEDIA_QUERY = "(max-width: 768px)"
export const MEDIUM_BREAKPOINT_MEDIA_QUERY = "(max-width: 960px)"

export const TOUCH_DEVICE_MEDIA_QUERY =
    "(hover: none), (pointer: coarse), (pointer: none)"

export const DATA_INSIGHTS_ATOM_FEED_NAME = "atom-data-insights.xml"

export const DATA_INSIGHT_ATOM_FEED_PROPS = {
    title: "Atom feed for Data Insights",
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
        icon: faFacebook,
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
    {
        title: "GitHub",
        url: "https://github.com/owid",
        icon: faGithub,
    },
]

export const RSS_FEEDS = [
    {
        title: "Research & Writing",
        url: "/atom.xml",
        icon: faRss,
    },
    {
        title: "Data Insights",
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
