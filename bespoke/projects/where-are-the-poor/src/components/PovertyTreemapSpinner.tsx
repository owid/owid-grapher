import cx from "classnames"

import { faCircleNotch } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"

export function PovertyTreemapSpinner({ inline }: { inline?: boolean }) {
    return (
        <div
            className={cx("where-are-the-poor-spinner", {
                "where-are-the-poor-spinner--inline": inline,
                "where-are-the-poor-spinner--standalone": !inline,
            })}
        >
            <FontAwesomeIcon
                icon={faCircleNotch}
                spin
                size={!inline ? "2x" : undefined}
            />
        </div>
    )
}
