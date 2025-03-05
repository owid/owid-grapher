import * as cheerio from "cheerio"
import ReactDOMServer from "react-dom/server.js"
import {
    FormattedPost,
    TocHeading,
    WP_BlockClass,
    WP_ColumnStyle,
    WP_PostType,
    formatDate,
} from "@ourworldindata/utils"
import { BAKED_BASE_URL } from "../settings/serverSettings.js"
import { bakeGlobalEntitySelector } from "./bakeGlobalEntitySelector.js"
import { PROMINENT_LINK_CLASSNAME } from "./blocks/ProminentLink.js"
import { Byline } from "./Byline.js"
import { SectionHeading } from "./SectionHeading.js"
import { FormattingOptions, GRAPHER_PREVIEW_CLASS } from "@ourworldindata/types"

export const RESEARCH_AND_WRITING_CLASSNAME = "wp-block-research-and-writing"

export const formatUrls = (html: string) => {
    const formatted = html
        .replace(new RegExp("https?://owid.cloud", "g"), BAKED_BASE_URL)
        .replace(new RegExp("https?://ourworldindata.org", "g"), BAKED_BASE_URL)

    return formatted
}

export const splitContentIntoSectionsAndColumns = (
    cheerioEl: CheerioStatic
) => {
    interface Columns {
        wrapper: Cheerio
        first: Cheerio
        last: Cheerio
    }

    const getColumns = (
        style: WP_ColumnStyle = WP_ColumnStyle.StickyRight
    ): Columns => {
        const emptyColumns = `<div class="wp-block-columns is-style-${style}"><div class="wp-block-column"></div><div class="wp-block-column"></div></div>`
        const cheerioEl = cheerio.load(emptyColumns)
        const $columns = cheerioEl("body").children().first()

        let first = $columns.children().first()
        let last = $columns.children().last()

        // due to how CSS grid's implicit row height works, we need a div inside the sticky column that can move within it
        const container = `<div class="wp-sticky-container"></div>`
        if (style === WP_ColumnStyle.StickyLeft) {
            first.append(container)
            first = first.children().first()
        }
        if (style === WP_ColumnStyle.StickyRight) {
            last.append(container)
            last = last.children().first()
        }

        return {
            wrapper: $columns,
            first,
            last,
        }
    }

    const hasColumnsStyle = (
        columns: Columns,
        style: WP_ColumnStyle
    ): boolean => {
        return columns.wrapper.hasClass(`is-style-${style}`)
    }

    const isColumnsEmpty = (columns: Columns) => {
        return columns.first.children().length === 0 &&
            columns.last.children().length === 0
            ? true
            : false
    }

    const isElementFlushingColumns = (el: CheerioElement): boolean => {
        return (
            !el ||
            FullWidthHandler.isElementFullWidth(el) ||
            H4Handler.isElementH4(el)
        )
    }

    const flushAndResetColumns = (context: ColumnsContext): void => {
        if (isColumnsEmpty(context.columns)) return

        context.$section.append(context.columns.wrapper)
        context.columns = getColumns()
    }

    interface ColumnsContext {
        columns: Columns
        $section: Cheerio
    }

    interface Handler {
        setNext: (handler: Handler) => Handler
        handle: (el: CheerioElement, context: ColumnsContext) => Columns | null
    }

    abstract class AbstractHandler implements Handler {
        #nextHandler: Handler | null = null

        setNext(handler: Handler) {
            this.#nextHandler = handler
            return handler
        }

        handle(el: CheerioElement, context: ColumnsContext) {
            if (this.#nextHandler) return this.#nextHandler.handle(el, context)
            return null
        }
    }

    class FullWidthHandler extends AbstractHandler {
        static isElementFullWidth(el: CheerioElement) {
            const $el = cheerioEl(el)
            return (
                el.name === "h2" ||
                el.name === "h3" ||
                $el.hasClass("wp-block-columns") ||
                $el.hasClass("wp-block-owid-grid") ||
                $el.hasClass(RESEARCH_AND_WRITING_CLASSNAME) ||
                $el.hasClass(WP_BlockClass.FullContentWidth)
            )
        }

        handle(el: CheerioElement, context: ColumnsContext) {
            const $el = cheerioEl(el)
            if (FullWidthHandler.isElementFullWidth(el)) {
                flushAndResetColumns(context)
                context.$section.append($el)
                return null
            }
            return super.handle(el, context)
        }
    }

    class H4Handler extends AbstractHandler {
        static isElementH4 = (el: CheerioElement): boolean => {
            return el.name === "h4"
        }

        handle(el: CheerioElement, context: ColumnsContext) {
            const $el = cheerioEl(el)
            if (H4Handler.isElementH4(el)) {
                flushAndResetColumns(context)
                context.columns.first.append($el)
                flushAndResetColumns(context)
                return null
            }
            return super.handle(el, context)
        }
    }

    class SideBySideHandler extends AbstractHandler {
        handle(el: CheerioElement, context: ColumnsContext) {
            const $el = cheerioEl(el)

            if (
                el.name === "figure" &&
                $el.hasClass(GRAPHER_PREVIEW_CLASS) &&
                hasColumnsStyle(context.columns, WP_ColumnStyle.SideBySide)
            ) {
                context.columns.last.append($el)
                flushAndResetColumns(context)
                return null
            }

            if (
                el.name === "figure" &&
                $el.hasClass(GRAPHER_PREVIEW_CLASS) &&
                el.nextSibling?.attribs?.class === GRAPHER_PREVIEW_CLASS
            ) {
                flushAndResetColumns(context)
                context.columns = getColumns(WP_ColumnStyle.SideBySide)
                context.columns.first.append($el)
                return null
            }

            return super.handle(el, context)
        }
    }

    class StandaloneFigureHandler extends AbstractHandler {
        handle(el: CheerioElement, context: ColumnsContext) {
            const $el = cheerioEl(el)
            if (
                FigureHandler.isFigure(el) &&
                isElementFlushingColumns(el.nextSibling) &&
                isColumnsEmpty(context.columns)
            ) {
                context.columns = getColumns(WP_ColumnStyle.StickyLeft)
                context.columns.first.append($el)
                flushAndResetColumns(context) // not strictly necessary since we know the next element flushes but keeps the abstraction clean
                return null
            }
            return super.handle(el, context)
        }
    }

    class FigureHandler extends AbstractHandler {
        static isFigure(el: CheerioElement) {
            const $el = cheerioEl(el)
            return (
                el.name === "figure" ||
                el.name === "iframe" ||
                // Temporary support for old chart iframes
                el.name === "address" ||
                $el.hasClass("wp-block-image") ||
                $el.hasClass("tableContainer") ||
                // Temporary support for non-Gutenberg iframes wrapped in wpautop's <p>
                // Also catches older iframes (e.g. https://ourworldindata.org/food-per-person#world-map-of-minimum-and-average-dietary-energy-requirement-mder-and-ader)
                $el.find("iframe").length !== 0 ||
                // TODO: remove temporary support for pre-Gutenberg images and associated captions
                el.name === "h6" ||
                ($el.find("img").length !== 0 &&
                    !$el.hasClass(PROMINENT_LINK_CLASSNAME) &&
                    !$el.find(
                        ".wp-block-owid-additional-information[data-variation='merge-left']"
                    ))
            )
        }

        handle(el: CheerioElement, context: ColumnsContext) {
            const $el = cheerioEl(el)
            if (FigureHandler.isFigure(el)) {
                context.columns.last.append($el)
                return null
            }
            return super.handle(el, context)
        }
    }

    class DefaultHandler extends AbstractHandler {
        handle(el: CheerioElement, context: ColumnsContext) {
            const $el = cheerioEl(el)
            // Move non-heading, non-image content to the left column
            context.columns.first.append($el)
            return null
        }
    }

    const fullWidthHandler = new FullWidthHandler()

    // Set up chain of responsibility pattern. Elements are being passed
    // through the chain until a handler can process them.
    // - For each element in a section, handlers are executed one by one in order.
    // - It's the responsibility of the handler to figure out whether to 1) apply some transformation, or 2) do nothing, pass responsibility onto the next handler in the chain.
    // - A handler should never do both 1) and 2) – both apply a transformation and additionally let other handlers apply transformations.
    // see https://github.com/owid/owid-grapher/pull/1220#discussion_r816126831
    fullWidthHandler
        .setNext(new H4Handler())
        .setNext(new SideBySideHandler())
        .setNext(new StandaloneFigureHandler())
        .setNext(new FigureHandler())
        .setNext(new DefaultHandler())

    // Wrap content demarcated by headings into section blocks
    // and automatically divide content into columns
    const sectionStarts = [cheerioEl("body").children().get(0)].concat(
        cheerioEl("body > h2").toArray()
    )

    for (const start of sectionStarts) {
        const $start = cheerioEl(start)
        const $section = cheerioEl("<section>")
        const context = { columns: getColumns(), $section }
        const $tempWrapper = cheerioEl("<div>")
        const $contents = $tempWrapper
            .append($start.clone(), $start.nextUntil(cheerioEl("h2")))
            .contents()

        $contents.each((i, el) => {
            fullWidthHandler.handle(el, context)
        })
        // Flushes the last set of columns at the end each section (since
        // columns are only flushed when a flushing element is encountered).
        flushAndResetColumns(context)
        $start.replaceWith($section)
    }
}

export const getBodyHtml = (cheerioEl: CheerioStatic): string => {
    return cheerioEl("body").html() || ""
}

const addTocToSections = (
    cheerioEl: CheerioStatic,
    tocHeadings: TocHeading[]
) => {
    cheerioEl("h2")
        .toArray()
        .map((el) => cheerioEl(el))
        .filter(($el) => {
            return (
                $el.closest(`.${RESEARCH_AND_WRITING_CLASSNAME}`).length === 0
            )
        })
        .forEach(($el) => {
            $el.replaceWith(
                ReactDOMServer.renderToStaticMarkup(
                    <SectionHeading
                        title={$el.text()}
                        tocHeadings={tocHeadings}
                    >
                        <div
                            dangerouslySetInnerHTML={{
                                __html: cheerioEl.html($el),
                            }}
                        />
                    </SectionHeading>
                )
            )
        })
}

const addPostHeader = (cheerioEl: CheerioStatic, post: FormattedPost) => {
    const publishedDate = formatDate(post.date)
    // const modifiedDate = formatDate(post.modifiedDate)

    cheerioEl("body").prepend(
        ReactDOMServer.renderToStaticMarkup(
            <div className="article-meta">
                {post.excerpt && <div className="excerpt">{post.excerpt}</div>}
                <Byline authors={post.authors} override={post.byline} />

                <div className="published-updated">
                    <time>{publishedDate}</time>
                    {/* See https://www.notion.so/owid/Revert-last-updated-mention-in-articles-a917e8cf6ad846138bd650bfc1b7395b */}
                    {/* {modifiedDate !== publishedDate && (
                        <>
                            <span> - Last updated on </span>
                            <time>{modifiedDate}</time>
                        </>
                    )} */}
                </div>
            </div>
        )
    )
}

export const addContentFeatures = ({
    post,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    formattingOptions,
}: {
    post: FormattedPost
    formattingOptions: FormattingOptions
}): string => {
    const cheerioEl = cheerio.load(post.html)

    if (post.type === WP_PostType.Post) addPostHeader(cheerioEl, post)
    splitContentIntoSectionsAndColumns(cheerioEl)
    bakeGlobalEntitySelector(cheerioEl)
    addTocToSections(cheerioEl, post.tocHeadings)

    return getBodyHtml(cheerioEl)
}
