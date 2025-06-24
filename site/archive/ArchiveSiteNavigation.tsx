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
import { useWindowQueryParams } from "../hooks.js"

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

    const queryStr = useWindowQueryParams() ?? ""

    const { previousVersion, nextVersion } = useMemo(() => {
        const versionsObj = versions as unknown
        if (
            !R.isPlainObject(versionsObj) ||
            !("versions" in versionsObj) ||
            !Array.isArray(versionsObj.versions)
        )
            return {
                previousVersion: props.previousVersion,
                nextVersion: props.nextVersion,
            }

        const versionsArr = versionsObj.versions as ArchiveVersions["versions"]

        // Find the index of the current version in the sorted list
        const currentVersionIdx = R.sortedIndexWith(
            versionsArr,
            (item) => item.archivalDate < pageArchivalDate
        )
        if (versionsArr[currentVersionIdx]?.archivalDate === pageArchivalDate) {
            return {
                previousVersion: versionsArr[currentVersionIdx - 1],
                nextVersion: versionsArr[currentVersionIdx + 1],
            }
        } else {
            // This case is rare but could in theory happen: The current version could not be found in the array.
            // In this case, we have versionsArr[currentVersionIdx] > pageArchivalDate,
            // so we need a slightly different logic to find the previous and next versions.
            return {
                previousVersion: versionsArr[currentVersionIdx - 1],
                nextVersion: versionsArr[currentVersionIdx],
            }
        }
    }, [versions, props.previousVersion, props.nextVersion, pageArchivalDate])

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
                        {previousVersion && (
                            <Button
                                className="archive-navigation-bar__button archive-navigation-bar__button-left"
                                href={previousVersion.url + queryStr}
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
                                href={props.liveUrl + queryStr}
                                theme="solid-dark-blue"
                                icon={null}
                                text="Go to the live version"
                                dataTrackNote="archive-header-go-to-live"
                            />
                        )}
                        {nextVersion && (
                            <Button
                                className="archive-navigation-bar__button archive-navigation-bar__button-right"
                                href={nextVersion.url + queryStr}
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
