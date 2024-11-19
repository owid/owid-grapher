import { faRss } from "@fortawesome/free-solid-svg-icons"
import {
    faXTwitter,
    faFacebookSquare,
    faInstagram,
    faThreads,
    faLinkedin,
    faBluesky,
} from "@fortawesome/free-brands-svg-icons"

// See https://cdnjs.cloudflare.com/polyfill/ for a list of all supported features
const polyfillFeatures = [
    "es2019", // Array.flat, Array.flatMap, Object.fromEntries, ...
    "es2020", // String.matchAll, Promise.allSettled, ...
    "es2021", // String.replaceAll, Promise.any, ...
    "es2022", // Array.at, String.at, ...
    "es2023", // Array.findLast, Array.toReversed, Array.toSorted, Array.with, ...
    "IntersectionObserver",
    "IntersectionObserverEntry",
    "ResizeObserver",
    "globalThis", // some dependencies use this
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
