import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faWandMagicSparkles } from "@fortawesome/free-solid-svg-icons"
import { Byline } from "./Byline.js"
import { useDocumentContext } from "../DocumentContext.js"

/**
 * v2 of the bespoke-viz chrome: instead of a full-width header band above the
 * two columns, the article metadata (title/subtitle/byline) is rendered at the
 * TOP of the sticky-left RIGHT column, above the authored commentary, in a
 * /latest-feed style. The metadata comes from the gdoc front-matter via
 * DocumentContext (bespokeVizMeta), NOT from the article body.
 *
 * Rendered by ArticleBlock's sticky-left arm (prepended to the right column)
 * when the article uses `layout: bespoke-viz`.
 */
export function BespokeVizMetadata() {
    const { bespokeVizMeta } = useDocumentContext()
    if (!bespokeVizMeta) return null

    const { title, subtitle, authors, authorRoles, dateline } = bespokeVizMeta

    return (
        <div className="bespoke-viz-meta">
            {/* Placeholder eyebrow + icon — clearly swappable. */}
            <p className="bespoke-viz-meta__eyebrow">
                <FontAwesomeIcon
                    className="bespoke-viz-meta__eyebrow-icon"
                    icon={faWandMagicSparkles}
                />
                Featured Visualization
            </p>
            {title && <h1 className="bespoke-viz-meta__title">{title}</h1>}
            {subtitle && (
                <p className="bespoke-viz-meta__subtitle">{subtitle}</p>
            )}
            {authors && authors.length > 0 && (
                <p className="bespoke-viz-meta__byline">
                    <Byline names={authors} authorRoles={authorRoles} />
                </p>
            )}
            {/* Standard OWID dateline (resolved in OwidGdoc: explicit dateline
                field, else the formatted publication date). */}
            {dateline && (
                <p
                    className="bespoke-viz-meta__dateline"
                    suppressHydrationWarning={true}
                >
                    {dateline}
                </p>
            )}
        </div>
    )
}
