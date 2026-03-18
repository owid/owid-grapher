import cx from "classnames"

import { faCircleNotch } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"

export function LoadingSpinner({ inline }: { inline?: boolean }) {
    return (
        <div
            className={cx("causes-of-death-spinner", {
                "causes-of-death-spinner--inline": inline,
                "causes-of-death-spinner--standalone": !inline,
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
