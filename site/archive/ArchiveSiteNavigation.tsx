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
const TIME_FORMAT = "HH:mm"
const ArchiveNavigationBar = (props: ArchiveSiteNavigationProps) => {
    const hasButtons = !!(
        props.liveUrl ||
        props.previousVersion ||
        props.nextVersion
    )
    const dayjsDate = dayjs.utc(props.archiveDate)

    return (
        <nav className="archive-navigation-bar">
            <div className="archive-navigation-bar__wrapper">
                <div className="archive-navigation-bar__archive_text">
                    Archive
                </div>
                <div className="archive-navigation-bar__date">
                    <span className="archive-navigation-bar__date-value">
                        {dayjsDate.format(DATE_FORMAT)}
                    </span>
                    &nbsp;
                    <span className="archive-navigation-bar__time-value">
                        at {dayjsDate.format(TIME_FORMAT)} UTC
                    </span>
                </div>
                {hasButtons && (
                    <div className="archive-navigation-bar__buttons grid grid-cols-3">
                        {props.previousVersion && (
                            <Button
                                className="archive-navigation-bar__button archive-navigation-bar__button-left"
                                href={props.previousVersion.url}
                                theme="outline-white"
                                icon={faArrowLeft}
                                iconPosition="left"
                                text="Go to the previous version"
                                dataTrackNote="archive-header-go-to-previous"
                            />
                        )}
                        {props.liveUrl && (
                            <Button
                                className="archive-navigation-bar__button archive-navigation-bar__button-center"
                                href={props.liveUrl}
                                theme="solid-dark-blue"
                                icon={null}
                                text="Go to the live version"
                                dataTrackNote="archive-header-go-to-live"
                            />
                        )}
                        {props.nextVersion && (
                            <Button
                                className="archive-navigation-bar__button archive-navigation-bar__button-right"
                                href={props.nextVersion.url}
                                theme="outline-white"
                                icon={faArrowRight}
                                iconPosition="right"
                                text="Go to the next version"
                                dataTrackNote="archive-header-go-to-next"
                            />
                        )}
                    </div>
                )}
            </div>
        </nav>
    )
}
