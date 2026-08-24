import * as React from "react"
import { Layout, Menu, MenuProps } from "antd"
import { useHistory, useLocation } from "react-router-dom"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import type { IconDefinition } from "@fortawesome/fontawesome-common-types"
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
} from "@fortawesome/free-solid-svg-icons"

import { Link } from "./Link.js"
import { ETL_WIZARD_URL } from "../settings/clientSettings.js"

/**
 * One entry of the sidebar. `to` doubles as the antd `Menu` item key: for
 * internal entries it is the router path the entry links to (and the prefix
 * the current-page highlight is matched against), for external ones the full
 * URL.
 */
interface AdminSidebarEntry {
    to: string
    icon: IconDefinition
    label: string
    /** Opens in a new tab and links out of the SPA. */
    external?: boolean
    title?: string
}

interface AdminSidebarSection {
    key: string
    label: string
    entries: AdminSidebarEntry[]
}

const SIDEBAR_SECTIONS: AdminSidebarSection[] = [
    {
        key: "site",
        label: "SITE",
        entries: [
            { to: "/charts", icon: faChartBar, label: "Charts" },
            {
                to: "/narrative-charts",
                icon: faPanorama,
                label: "Narrative charts",
            },
            { to: "/multi-dims", icon: faChartLine, label: "Multi-dims" },
            {
                to: "/featured-metrics",
                icon: faStar,
                label: "Featured Metrics",
            },
            { to: "/data-insights", icon: faLightbulb, label: "Data insights" },
            { to: "/gdocs", icon: faFile, label: "Google Docs" },
            {
                to: "/orphaned-articles",
                icon: faLinkSlash,
                label: "Orphaned articles",
            },
            { to: "/dods", icon: faCircleInfo, label: "DoDs" },
            { to: "/images", icon: faImage, label: "Images" },
            { to: "/static-viz", icon: faMonument, label: "Static Viz" },
            { to: "/slideshows", icon: faDisplay, label: "Slideshows" },
            { to: "/explorers", icon: faCoffee, label: "Explorers" },
            { to: "/explorer-tags", icon: faTag, label: "Explorer Tags" },
            { to: "/files", icon: faFolder, label: "Files" },
        ],
    },
    {
        key: "data",
        label: "DATA",
        entries: [
            {
                to: ETL_WIZARD_URL,
                icon: faHatWizard,
                label: "Wizard",
                external: true,
                title: "Tailscale required",
            },
            { to: "/datasets", icon: faTable, label: "Datasets" },
            { to: "/variables", icon: faDatabase, label: "Indicators" },
            {
                to: "/bulk-grapher-config-editor",
                icon: faSkullCrossbones,
                label: "Bulk chart editor",
            },
            { to: "/tags", icon: faTag, label: "Tags" },
            { to: "/tag-graph", icon: faSitemap, label: "Tag Graph" },
        ],
    },
    {
        key: "settings",
        label: "SETTINGS",
        entries: [
            { to: "/users", icon: faUser, label: "Users" },
            {
                to: "/redirects",
                icon: faArrowRight,
                label: "Chart Redirects",
            },
            {
                to: "/multi-dim-redirects",
                icon: faArrowRight,
                label: "Multi-dim redirects",
            },
            {
                to: "/site-redirects",
                icon: faArrowRight,
                label: "Site Redirects",
            },
        ],
    },
    {
        key: "utilities",
        label: "UTILITIES",
        entries: [
            { to: "/deploys", icon: faSatelliteDish, label: "Deploy status" },
            { to: "/svgtester", icon: faCodeCompare, label: "SVG tester" },
            { to: "/test", icon: faEye, label: "Chart previews" },
            {
                to: "/callout-functions",
                icon: faCircleInfo,
                label: "Callout functions",
            },
        ],
    },
]

const INTERNAL_PATHS = SIDEBAR_SECTIONS.flatMap((section) =>
    section.entries.filter((entry) => !entry.external).map((entry) => entry.to)
)

// The entries render a real `<a>` (via `Link`) rather than relying on the menu
// item's own click handler, so that cmd-click and middle-click keep opening a
// new tab.
const MENU_ITEMS: MenuProps["items"] = SIDEBAR_SECTIONS.map((section) => ({
    key: section.key,
    type: "group",
    label: section.label,
    children: section.entries.map((entry) => ({
        key: entry.to,
        icon: <FontAwesomeIcon icon={entry.icon} className="fa-fw" />,
        label: entry.external ? (
            <a
                href={entry.to}
                target="_blank"
                rel="noopener"
                title={entry.title}
            >
                {entry.label}
            </a>
        ) : (
            <Link to={entry.to} title={entry.title}>
                {entry.label}
            </Link>
        ),
    })),
}))

/** The longest sidebar path that is a prefix of the current location. */
function getSelectedKeys(pathname: string): string[] {
    const matches = INTERNAL_PATHS.filter(
        (path) => pathname === path || pathname.startsWith(path + "/")
    )
    if (matches.length === 0) return []
    return [matches.reduce((a, b) => (b.length > a.length ? b : a))]
}

export const AdminSidebar = ({
    collapsed,
}: {
    collapsed: boolean
}): React.ReactElement => {
    const history = useHistory()
    const { pathname } = useLocation()

    // Clicking the icon or the row padding — anywhere that isn't the entry's
    // own `<a>` — should navigate too, the way the full-width anchors of the
    // old sidebar did. Clicks that did land on the anchor are left alone, so
    // that React Router doesn't get the same navigation twice.
    const onClick: MenuProps["onClick"] = ({ key, domEvent }) => {
        if ((domEvent.target as HTMLElement).closest("a")) return
        if (key.startsWith("http")) window.open(key, "_blank", "noopener")
        else history.push(key)
    }

    return (
        <Layout.Sider
            className="AdminSidebar"
            theme="dark"
            width={200}
            collapsible
            collapsed={collapsed}
            collapsedWidth={0}
            trigger={null}
        >
            <Menu
                className="AdminSidebar__menu"
                theme="dark"
                mode="inline"
                items={MENU_ITEMS}
                selectedKeys={getSelectedKeys(pathname)}
                onClick={onClick}
            />
        </Layout.Sider>
    )
}
