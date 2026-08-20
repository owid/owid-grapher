import { IconDefinition } from "@fortawesome/fontawesome-svg-core"
import {
    faChartBar,
    faChartLine,
    faFile,
    faTable,
    faSkullCrossbones,
    faDatabase,
    faTag,
    faUser,
    faArrowRight,
    faEye,
    faCoffee,
    faSatelliteDish,
    faHatWizard,
    faSitemap,
    faPanorama,
    faImage,
    faLightbulb,
    faStar,
    faCircleInfo,
    faFolder,
    faMonument,
    faDisplay,
    faLinkSlash,
    faCodeCompare,
    faPlus,
} from "@fortawesome/free-solid-svg-icons"
import {
    DefaultNewExplorerSlug,
    EXPLORERS_ROUTE_FOLDER,
} from "@ourworldindata/explorer"

import { ETL_WIZARD_URL } from "../settings/clientSettings.mjs"

export interface AdminNavEntry {
    title: string
    icon: IconDefinition
    /** SPA route, navigated via react-router */
    to?: string
    /** Plain link, causes a full page load */
    href?: string
    /** Open href in a new tab */
    external?: boolean
    /** title attribute on the link */
    linkTitle?: string
    /** Render the label in smaller type so it fits the sidebar */
    smallText?: boolean
    children?: AdminNavEntry[]
}

export interface AdminNavSection {
    label: string
    entries: AdminNavEntry[]
}

export const ADMIN_NAV_SECTIONS: AdminNavSection[] = [
    {
        label: "SITE",
        entries: [
            { title: "Charts", icon: faChartBar, to: "/charts" },
            {
                title: "Narrative charts",
                icon: faPanorama,
                to: "/narrative-charts",
            },
            { title: "Multi-dims", icon: faChartLine, to: "/multi-dims" },
            {
                title: "Featured Metrics",
                icon: faStar,
                to: "/featured-metrics",
                smallText: true,
            },
            { title: "Data insights", icon: faLightbulb, to: "/data-insights" },
            { title: "Google Docs", icon: faFile, to: "/gdocs" },
            {
                title: "Orphaned articles",
                icon: faLinkSlash,
                to: "/orphaned-articles",
            },
            { title: "DoDs", icon: faCircleInfo, to: "/dods" },
            { title: "Images", icon: faImage, to: "/images" },
            { title: "Static Viz", icon: faMonument, to: "/static-viz" },
            { title: "Slideshows", icon: faDisplay, to: "/slideshows" },
            {
                title: "Explorers",
                icon: faCoffee,
                to: "/explorers",
                children: [
                    {
                        title: "Explorer Tags",
                        icon: faTag,
                        to: "/explorer-tags",
                    },
                ],
            },
            { title: "Files", icon: faFolder, to: "/files" },
        ],
    },
    {
        label: "DATA",
        entries: [
            {
                title: "Wizard",
                icon: faHatWizard,
                href: ETL_WIZARD_URL,
                external: true,
                linkTitle: "Tailscale required",
            },
            { title: "Datasets", icon: faTable, to: "/datasets" },
            { title: "Indicators", icon: faDatabase, to: "/variables" },
            {
                title: "Bulk chart editor",
                icon: faSkullCrossbones,
                to: "/bulk-grapher-config-editor",
            },
            { title: "Tags", icon: faTag, to: "/tags" },
            { title: "Tag Graph", icon: faSitemap, to: "/tag-graph" },
        ],
    },
    {
        label: "SETTINGS",
        entries: [
            { title: "Users", icon: faUser, to: "/users/" },
            { title: "Chart Redirects", icon: faArrowRight, to: "/redirects" },
            {
                title: "Multi-dim redirects",
                icon: faArrowRight,
                to: "/multi-dim-redirects",
                smallText: true,
            },
            {
                title: "Site Redirects",
                icon: faArrowRight,
                to: "/site-redirects",
            },
        ],
    },
    {
        label: "UTILITIES",
        entries: [
            {
                title: "Deploy status",
                icon: faSatelliteDish,
                to: "/deploys",
            },
            { title: "SVG tester", icon: faCodeCompare, to: "/svgtester" },
            { title: "Chart previews", icon: faEye, to: "/test" },
            {
                title: "Callout functions",
                icon: faCircleInfo,
                to: "/callout-functions",
            },
        ],
    },
]

export const ADMIN_CREATE_ACTIONS: AdminNavEntry[] = [
    { title: "New chart", icon: faPlus, to: "/charts/create" },
    {
        title: "New narrative chart",
        icon: faPlus,
        to: "/narrative-charts/create",
    },
    {
        title: "New explorer",
        icon: faPlus,
        href: `/admin/${EXPLORERS_ROUTE_FOLDER}/${DefaultNewExplorerSlug}`,
    },
    { title: "New slideshow", icon: faPlus, to: "/slideshows/create" },
]
