import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import { faChevronLeft } from "@fortawesome/free-solid-svg-icons"
import { SubNavId } from "@ourworldindata/types"
import { subnavs } from "./SiteConstants.js"

export const SiteSubnavigation = ({
    subnavId,
    subnavCurrentId,
}: {
    subnavId: SubNavId
    subnavCurrentId?: string
}) => {
    const subnavLinks = subnavs[subnavId]
    return subnavLinks ? (
        <div className="offset-subnavigation">
            <div className="site-subnavigation">
                <div className="site-subnavigation-scroll">
                    <ul className="site-subnavigation-links">
                        {subnavLinks.map(
                            ({ href, label, id, highlight }, idx) => {
                                const classes: string[] = []
                                const dataTrackNote = [
                                    subnavId,
                                    "subnav",
                                    id,
                                ].join("_")
                                if (id === subnavCurrentId)
                                    classes.push("current")
                                if (highlight) classes.push("highlight")
                                return (
                                    <li
                                        className={
                                            (classes.length &&
                                                classes.join(" ")) ||
                                            ""
                                        }
                                        key={href}
                                    >
                                        <a
                                            href={href}
                                            data-track-note={dataTrackNote}
                                        >
                                            {label}
                                            {idx === 0 && (
                                                <FontAwesomeIcon
                                                    icon={faChevronLeft}
                                                />
                                            )}
                                        </a>
                                    </li>
                                )
                            }
                        )}
                    </ul>
                </div>
            </div>
        </div>
    ) : null
}
