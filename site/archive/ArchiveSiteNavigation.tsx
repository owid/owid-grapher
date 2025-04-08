import { Button } from "@ourworldindata/components"
import { SiteLogos } from "../SiteLogos.js"
import { faArrowLeft, faArrowRight } from "@fortawesome/free-solid-svg-icons"
import { dayjs } from "@ourworldindata/utils"
import { ArchiveSiteNavigationProps } from "./archiveTypes.js"

export const ArchiveSiteNavigation = (props: ArchiveSiteNavigationProps) => {
    return (
        <div className="archive-site-navigation">
            <ArchiveHeaderLogoBar />
            <ArchiveNavigationBar {...props} />
        </div>
    )
}

const ArchiveHeaderLogoBar = () => (
    <div className="archive-header-logo-bar">
        <div className="wrapper">
            <SiteLogos homeUrl="https://ourworldindata.org" />
        </div>
    </div>
)

const DATE_FORMAT = "MMMM D, YYYY"
const ArchiveNavigationBar = (props: ArchiveSiteNavigationProps) => {
    const hasButtons = !!(
        props.liveUrl ||
        props.previousVersion ||
        props.nextVersion
    )

    return (
        <nav className="archive-navigation-bar">
            <div className="archive-navigation-bar__wrapper">
                <div className="archive-navigation-bar__archive_text">
                    Archive
                </div>
                <div className="archive-navigation-bar__date">
                    <span className="archive-navigation-bar__date-value">
                        {dayjs.utc(props.archiveDate).format(DATE_FORMAT)}
                    </span>
                </div>
                {hasButtons && (
                    <div className="archive-navigation-bar__buttons grid grid-cols-3 grid-sm-cols-1">
                        {props.previousVersion && (
                            <Button
                                className="archive-navigation-bar__button-left"
                                href={props.previousVersion.url}
                                theme="outline-white"
                                text="Go to the previous version"
                                icon={faArrowLeft}
                                iconPosition="left"
                            />
                        )}
                        {props.liveUrl && (
                            <Button
                                className="archive-navigation-bar__button-center"
                                href={props.liveUrl}
                                theme="solid-dark-blue"
                                icon={null}
                                text="Go to the latest version"
                                dataTrackNote="archive-header-back-to-homepage"
                            />
                        )}
                        {props.nextVersion && (
                            <Button
                                className="archive-navigation-bar__button-right"
                                href={props.nextVersion.url}
                                theme="outline-white"
                                text="Go to the next version"
                                icon={faArrowRight}
                                iconPosition="right"
                            />
                        )}
                    </div>
                )}
            </div>
        </nav>
    )
}
