import cx from "classnames"
import { EnrichedBlockRecirc } from "@ourworldindata/utils"
import { HybridLinkList } from "./HybridLinkList.js"

export default function Recirc({
    d,
    className = "",
}: {
    d: EnrichedBlockRecirc
    className?: string
}) {
    return (
        <div className={cx(className, "recirc", `recirc--${d.align}`)}>
            <span className="recirc__heading body-3-bold">{d.title}</span>
            <HybridLinkList links={d.links} />
        </div>
    )
}
