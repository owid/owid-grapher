import { Button } from "@ourworldindata/components"
import { SiteLogos } from "../SiteLogos.js"
import { faArrowLeft, faArrowRight } from "@fortawesome/free-solid-svg-icons"
import { formatAsArchivalDate, parseArchivalDate } from "@ourworldindata/utils"
import {
    ArchiveSiteNavigationInfo,
    ArchiveVersions,
} from "@ourworldindata/types"
import { PROD_URL } from "../SiteConstants.js"
import { useEffect, useMemo, useState } from "react"
import * as R from "remeda"

export interface ArchiveSiteNavigationProps extends ArchiveSiteNavigationInfo {
    archivalDate: Date | string
}

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
            <SiteLogos homeUrl={PROD_URL} />
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
    const dayjsDate = useMemo(
        () => parseArchivalDate(props.archivalDate),
        [props.archivalDate]
    )
    const pageArchivalDate = useMemo(
        () => formatAsArchivalDate(dayjsDate),
        [dayjsDate]
    )

    const [versions, setVersions] = useState<ArchiveVersions | undefined>()
    useEffect(() => {
        if (props.versionsFileUrl) {
            fetch(props.versionsFileUrl)
                .then((response) => {
                    if (!response.ok) {
                        throw new Error(
                            `Failed to fetch versions file: ${response.statusText}`
                        )
                    }
                    return response.json()
                })
                .then(setVersions)
                .catch((error) => {
                    // Handle the error
                    console.error("Error fetching versions file:", error)
                })
        }
    }, [props.versionsFileUrl])

    const nextVersion = useMemo(() => {
        if (!versions) return props.nextVersion

        const currentVersionIdx = R.sortedIndexWith(
            versions.versions,
            (item) => item.archivalDate < pageArchivalDate
        )
        return versions.versions.at(currentVersionIdx + 1)
    }, [versions, props.nextVersion, pageArchivalDate])

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
                        {nextVersion && (
                            <Button
                                className="archive-navigation-bar__button archive-navigation-bar__button-right"
                                href={nextVersion.url}
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
