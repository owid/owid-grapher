import { Span } from "@ourworldindata/utils"
import SpanElements from "./SpanElements.js"
import { faArrowRight } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"

// A little wrapper to nest the SVG inside the <a> tag.
// We do this so that :visited styles apply,
// because a:visited + svg { fill: $purple-60 } doesn't work
// due to security countermeasures: https://hacks.mozilla.org/2010/03/privacy-related-changes-coming-to-css-vistited/
function AdditionalChartsLink({ item }: { item: Span[] }) {
    if (item.length === 1 && item[0].spanType === "span-link") {
        return (
            <a href={item[0].url}>
                <SpanElements spans={item[0].children} />{" "}
                <FontAwesomeIcon icon={faArrowRight} />
            </a>
        )
    }
    return null
}

export const AdditionalCharts = ({
    items,
    className,
}: {
    items: Span[][]
    className?: string
}) => {
    return (
        <div className={className}>
            <h4>Additional charts</h4>
            <ul>
                {items.map((item, i) => (
                    <li key={i}>
                        <AdditionalChartsLink item={item} />
                    </li>
                ))}
            </ul>
        </div>
    )
}
