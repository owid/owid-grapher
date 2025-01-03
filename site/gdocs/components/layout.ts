import cx from "classnames"
import { get } from "lodash"

export type Container =
    | "default"
    | "sticky-right-left-column"
    | "sticky-right-left-heading-column"
    | "sticky-right-right-column"
    | "sticky-left-left-column"
    | "sticky-left-right-column"
    | "side-by-side"
    | "summary"
    | "datapage"
    | "key-insight"
    | "about-page"
    | "author-header"

// Each container must have a default layout, usually just full-width
type Layouts = { default: string; [key: string]: string }

// no line-wrapping for easier alphabetisation
// prettier-ignore
const layouts: { [key in Container]: Layouts} = {
    ["default"]: {
        ["align"]: "col-start-5 span-cols-6 col-md-start-3 span-md-cols-10 span-sm-cols-12 col-sm-start-2",
        ["all-charts"]: "col-start-2 span-cols-12",
        ["aside-left"]: "col-start-2 span-cols-3 span-md-cols-10 col-md-start-3",
        ["aside-right"]: "col-start-11 span-cols-3 span-md-cols-10 col-md-start-3",
        ["chart-story"]: "col-start-4 span-cols-8 col-md-start-3 span-md-cols-10 span-sm-cols-12 col-sm-start-2",
        ["chart"]: "col-start-4 span-cols-8 col-md-start-3 span-md-cols-10 span-sm-cols-12 col-sm-start-2",
        ["default"]: "col-start-5 span-cols-6 col-md-start-3 span-md-cols-10 span-sm-cols-12 col-sm-start-2",
        ["divider"]: "col-start-2 span-cols-12",
        ["explorer"]: "col-start-2 span-cols-12",
        ["explorer-tiles"]: "grid grid-cols-12 span-cols-12 col-start-2",
        ["gray-section"]: "span-cols-14 grid grid-cols-12-full-width",
        ["heading"]: "col-start-5 span-cols-6 col-md-start-3 span-md-cols-10 span-sm-cols-12 col-sm-start-2",
        ["homepage-search"]: "grid grid-cols-12-full-width span-cols-14",
        ["homepage-intro"]: "grid grid-cols-12-full-width span-cols-14",
        ["horizontal-rule"]: "col-start-5 span-cols-6 col-md-start-3 span-md-cols-10 span-sm-cols-12 col-sm-start-2",
        ["html"]: "col-start-5 span-cols-6 col-md-start-3 span-md-cols-10 span-sm-cols-12 col-sm-start-2",
        ["image--narrow"]: "col-start-5 span-cols-6 col-md-start-3 span-md-cols-10 col-sm-start-2 span-sm-cols-12",
        ["image--wide"]: "col-start-4 span-cols-8 col-md-start-2 span-md-cols-12",
        ["image--widest"]: "col-start-2 span-cols-12 col-md-start-2 span-md-cols-12",
        ["image-caption"]: "col-start-5 span-cols-6 col-md-start-3 span-md-cols-10 span-sm-cols-12 col-sm-start-2",
        ["key-indicator"]: "col-start-2 span-cols-12",
        ["key-indicator-collection"]: "grid col-start-2 span-cols-12",
        ["key-insights"]: "col-start-2 span-cols-12",
        ["latest-data-insights"]: "grid grid-cols-12-full-width span-cols-14",
        ["list"]: "col-start-5 span-cols-6 col-md-start-3 span-md-cols-10 span-sm-cols-12 col-sm-start-2",
        ["numbered-list"]: "col-start-5 span-cols-6 col-md-start-3 span-md-cols-10 span-sm-cols-12 col-sm-start-2",
        ["prominent-link"]: "grid grid-cols-6 span-cols-6 col-start-5 span-md-cols-10 col-md-start-3 grid-md-cols-10 span-sm-cols-12 col-sm-start-2 grid-sm-cols-12",
        ["pill-row"]: "grid span-cols-14 grid-cols-12-full-width",
        ["pull-quote"]: "col-start-5 span-cols-6 col-md-start-3 span-md-cols-10 span-sm-cols-12 col-sm-start-2",
        ["recirc"]: "col-start-11 span-cols-3 span-rows-3 col-md-start-3 span-md-cols-10 span-sm-cols-12 col-sm-start-2",
        ["research-and-writing"]: "col-start-2 span-cols-12",
        ["scroller"]: "grid span-cols-12 col-start-2",
        ["sdg-grid"]: "grid col-start-2 span-cols-12 col-lg-start-3 span-lg-cols-10 span-sm-cols-12 col-sm-start-2",
        ["side-by-side"]: "grid span-cols-12 col-start-2",
        ["sticky-left-left-column"]: "grid grid-cols-7 span-cols-7 span-md-cols-10 grid-md-cols-10",
        ["sticky-left-right-column"]: "grid grid-cols-5 span-cols-5 span-md-cols-10 grid-md-cols-10",
        ["sticky-left"]: "grid span-cols-12 col-start-2",
        ["sticky-right-left-column"]: "grid span-cols-5 grid grid-cols-5 span-md-cols-10 grid-md-cols-10 col-md-start-2 span-sm-cols-12 grid-sm-cols-12 col-sm-start-1",
        ["sticky-right-right-column"]: "span-cols-7 grid-cols-7 span-md-cols-10 grid-md-cols-10 col-md-start-2 span-sm-cols-12 grid-sm-cols-12 col-sm-start-1",
        ["sticky-right"]: "grid span-cols-12 col-start-2",
        ["table--narrow"]: "col-start-5 span-cols-6 col-md-start-3 span-md-cols-10 span-sm-cols-12 col-sm-start-2",
        ["table--wide"]: "col-start-2 span-cols-12",
        ["text"]: "col-start-5 span-cols-6 col-md-start-3 span-md-cols-10 span-sm-cols-12 col-sm-start-2",
        ["toc"]: "grid grid-cols-8 col-start-4 span-cols-8 grid-md-cols-10 col-md-start-3 span-md-cols-10 grid-sm-cols-12 span-sm-cols-12 col-sm-start-2",
        ["topic-page-intro"]: "grid col-start-2 span-cols-12",
        ["video"]: "col-start-4 span-cols-8 col-md-start-2 span-md-cols-12",
    },
    ["datapage"]: {
        ["default"]: "col-start-2 span-cols-6 col-lg-start-2 span-lg-cols-7 col-md-start-2 span-md-cols-10 col-sm-start-1 span-sm-cols-12",
        ["chart"]: "span-cols-8 span-lg-cols-9 span-md-cols-12",
    },
    ["about-page"]: {
        ["default"]: "grid col-start-2 span-cols-12",
        ["people"]: "col-start-2 span-cols-8 col-md-start-2 span-md-cols-12",
        ["donors"]: "grid grid-cols-12-full-width col-start-1 col-end-limit",
        ["sticky-left-left-column"]: "grid grid-cols-7 span-cols-7 span-md-cols-10 grid-md-cols-10",
        ["sticky-left-right-column"]: "grid grid-cols-5 span-cols-5 span-md-cols-10 grid-md-cols-10",
        ["sticky-left"]: "grid span-cols-12 col-start-2",
        ["sticky-right-left-column"]: "grid span-cols-5 grid grid-cols-5 span-md-cols-10 grid-md-cols-10 col-md-start-2 span-sm-cols-12 grid-sm-cols-12 col-sm-start-1",
        ["sticky-right-right-column"]: "span-cols-7 grid-cols-7 span-md-cols-10 grid-md-cols-10 col-md-start-2 span-sm-cols-12 grid-sm-cols-12 col-sm-start-1",
        ["sticky-right"]: "grid span-cols-12 col-start-2",
    },
    ["author-header"]: {
        ["default"]: "span-cols-8",
        ["image"]: "span-cols-2 span-md-cols-3",
        ["text"]: "span-cols-6 span-md-cols-8 col-sm-start-2 span-sm-cols-12",
        ["socials"]: "span-cols-3 col-sm-start-2 span-sm-cols-12",
    },
    ["sticky-right-left-column"]: {
        ["chart"]: "span-cols-5 col-start-1 span-md-cols-10 col-md-start-2 span-sm-cols-12 col-sm-start-1",
        ["explorer"]: "span-cols-5 col-start-1 span-md-cols-10 col-md-start-2 span-sm-cols-12 col-sm-start-1",
        ["default"]: "span-cols-5 col-start-1 span-md-cols-12",
        ["prominent-link"]: "grid grid-cols-5 span-cols-5 span-md-cols-10 grid-md-cols-10 span-sm-cols-12 grid-sm-cols-12",
    },
    ["sticky-right-left-heading-column"]: {
        ["default"]: "span-cols-5 span-md-cols-10 col-md-start-2 span-sm-cols-12 col-sm-start-1"
    },
    ["sticky-right-right-column"]: {
        ["chart"]: "span-cols-7 col-start-1 span-md-cols-10 col-md-start-2 span-sm-cols-12 col-sm-start-1",
        ["explorer"]: "span-cols-7 col-start-1 span-md-cols-10 col-md-start-2 span-sm-cols-12 col-sm-start-1",
        ["default"]: "span-cols-7 span-md-cols-10 span-md-cols-12",
        ["prominent-link"]: "grid grid-cols-6 span-cols-6 span-md-cols-12 grid-md-cols-12",
    },
    ["sticky-left-left-column"]: {
        ["chart"]: "span-cols-7 col-start-1 span-md-cols-10 col-md-start-2 span-sm-cols-12 col-sm-start-1",
        ["explorer"]: "span-cols-7 col-start-1 span-md-cols-10 col-md-start-2 span-sm-cols-12 col-sm-start-1",
        ["default"]: "span-cols-7 span-md-cols-12",
        ["prominent-link"]: "grid grid-cols-6 span-cols-6 span-md-cols-12 grid-md-cols-12",
    },
    ["sticky-left-right-column"]: {
        ["chart"]: "span-cols-5 col-start-1 span-md-cols-10 col-md-start-2 span-sm-cols-12 col-sm-start-1",
        ["explorer"]: "span-cols-5 col-start-1 span-md-cols-10 col-md-start-2 span-sm-cols-12 col-sm-start-1",
        ["default"]: "span-cols-5 span-md-cols-12",
        ["prominent-link"]: "grid grid-cols-5 span-cols-5 span-md-cols-10 grid-md-cols-10 span-sm-cols-12 grid-sm-cols-12",
    },
    ["side-by-side"]: {
        ["default"]: "span-cols-6 span-sm-cols-12",
        ["prominent-link"]: "grid grid-cols-6 span-cols-6 grid-sm-cols-12 span-sm-cols-12 ",
    },
    ["summary"]: {
        ["default"]: "col-start-5 span-cols-6 col-md-start-3 span-md-cols-10 span-sm-cols-12 col-sm-start-2",
    },
    ["key-insight"]: {
        ["default"]: "col-start-1 span-cols-5 col-md-start-1 span-md-cols-12",
        ["prominent-link"]: "grid grid-cols-6 span-cols-6 span-md-cols-12 grid-md-cols-12",
    },
}

export function getLayout(
    blockType: string = "default",
    containerType: Container = "default"
): string {
    const layout = get(
        layouts,
        [containerType, blockType],
        // fallback to the default for the container
        get(layouts, [containerType, "default"])
    )
    return cx(`article-block__${blockType}`, layout)
}
