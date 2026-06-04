import cx from "classnames"

import { faCircleNotch } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"

export function Spinner({ inline }: { inline?: boolean }) {
    return (
        <div
            className={cx("spinner", {
                "spinner--inline": inline,
                "spinner--standalone": !inline,
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
