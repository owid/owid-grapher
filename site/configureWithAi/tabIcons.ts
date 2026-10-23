import {
    faChartColumn,
    faChartLine,
    faEarthAmericas,
    faTable,
    type IconDefinition,
} from "@fortawesome/free-solid-svg-icons"

const BAR_TABS = [
    "discrete-bar",
    "stacked-discrete-bar",
    "stacked-bar",
    "marimekko",
]

/** The icon for a Grapher tab, given as its query param */
export const iconForTab = (tab: string): IconDefinition =>
    tab === "table"
        ? faTable
        : tab === "map"
          ? faEarthAmericas
          : BAR_TABS.includes(tab)
            ? faChartColumn
            : faChartLine
