import LinkedA from "./LinkedA.js"
import cx from "classnames"
import { SpanLink } from "@ourworldindata/types"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faArrowRight } from "@fortawesome/free-solid-svg-icons"

export function Cta(props: { url: string; text: string; className?: string }) {
    // Transforming into the span shape because LinkedA takes care of resolving all attachments already
    const asSpan: SpanLink = {
        url: props.url,
        children: [{ spanType: "span-simple-text", text: props.text }],
        spanType: "span-link",
    }
    return (
        <div className={cx(props.className, "cta")}>
            <LinkedA span={asSpan} />
            <FontAwesomeIcon icon={faArrowRight} />
        </div>
    )
}
