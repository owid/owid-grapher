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

export const PROD_URL = "https://ourworldindata.org"

export const DEFAULT_LOCAL_BAKE_DIR = "localBake"

export const SMALL_BREAKPOINT_MEDIA_QUERY = "(max-width: 768px)"
export const MEDIUM_BREAKPOINT_MEDIA_QUERY = "(max-width: 960px)"

export const TOUCH_DEVICE_MEDIA_QUERY =
    "(hover: none), (pointer: coarse), (pointer: none)"

export const DATA_INSIGHTS_ATOM_FEED_NAME = "atom-data-insights.xml"

export const DEFAULT_ATOM_FEED_PROPS = {
    title: "Atom feed for Our World in Data",
    href: "/atom.xml",
}

export const DATA_INSIGHT_ATOM_FEED_PROPS = {
    title: "Atom feed for Data Insights",
    href: `https://ourworldindata.org/${DATA_INSIGHTS_ATOM_FEED_NAME}`,
}

export const DISABLE_IFRAME_EMBED_PARAM = "disableIframeEmbed"

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
    { title: "About us", url: "/about" },
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
