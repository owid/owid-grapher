import cx from "classnames"

import { faCircleNotch } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"

export function ProjectionsSpinner({ inline }: { inline?: boolean }) {
    return (
        <div
            className={cx("poverty-projections-spinner", {
                "poverty-projections-spinner--inline": inline,
                "poverty-projections-spinner--standalone": !inline,
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
