import { Button } from "@ourworldindata/components"
import { SiteLogos } from "../SiteLogos.js"
import {
    faArrowLeft,
    faArrowRight,
    faInfoCircle,
} from "@fortawesome/free-solid-svg-icons"
import {
    dayjs,
    formatAsArchivalDate,
    parseArchivalDate,
    Tippy,
} from "@ourworldindata/utils"
import {
    ArchivalDateString,
    type ArchiveSiteNavigationInfo,
    ArchiveVersions,
} from "@ourworldindata/types"
import { PROD_URL } from "../SiteConstants.js"
import { useMemo, useState } from "react"
import * as R from "remeda"
import { useWindowQueryParams } from "../hooks.js"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { useVersionsQuery } from "./queries.js"
import { VersionsDrawer } from "./VersionsDrawer.js"
import { useArchiveVersions } from "./versions.js"

export const DATE_FORMAT = "MMMM D, YYYY"
export const TIME_FORMAT = "HH:mm"

export interface ArchiveNavigationProps
    extends Omit<ArchiveSiteNavigationInfo, "contentType"> {
    archivalDate: ArchivalDateString
}

type ArchiveArticleNavigationProps = Omit<
    ArchiveNavigationProps,
    "previousVersion" | "nextVersion"
>

function ArchiveText({ tooltipContent }: { tooltipContent: string }) {
    return (
        <div className="archive-navigation-bar__archive_text">
            Archive
            <Tippy
                content={tooltipContent}
                theme="owid-footnote"
                placement="right"
                appendTo={() => document.body}
                trigger="mouseenter focus click"
                interactive
                interactiveDebounce={50}
            >
                <span className="archive-navigation-bar__archive_text--tooltip">
                    <FontAwesomeIcon icon={faInfoCircle} />
                </span>
            </Tippy>
        </div>
    )
}

function ArchiveDate({ dayjsDate }: { dayjsDate: dayjs.Dayjs }) {
    return (
        <div className="archive-navigation-bar__date">
            <span className="archive-navigation-bar__date-value">
                {dayjsDate.format(DATE_FORMAT)}
            </span>
            &nbsp;
            <span className="archive-navigation-bar__time-value">
                at {dayjsDate.format(TIME_FORMAT)} UTC
            </span>
        </div>
    )
}

export function ArchiveChartNavigation(props: ArchiveNavigationProps) {
    return (
        <div className="archive-site-navigation">
            <ArchiveHeaderLogoBar />
            <ArchiveChartNavigationBar {...props} />
        </div>
    )
}

function ArchiveHeaderLogoBar() {
    return (
        <div className="archive-header-logo-bar">
            <div className="wrapper">
                <SiteLogos homeUrl={PROD_URL} />
            </div>
        </div>
    )
}

function ArchiveChartNavigationBar({
    liveUrl,
    previousVersion: propsPreviousVersion,
    nextVersion: propsNextVersion,
    archivalDate,
    versionsFileUrl,
}: ArchiveNavigationProps) {
    const hasButtons = !!(liveUrl || propsPreviousVersion || propsNextVersion)
    const dayjsDate = parseArchivalDate(archivalDate)
    const pageArchivalDate = formatAsArchivalDate(dayjsDate)
    const { data: versions } = useVersionsQuery(versionsFileUrl)
    const queryStr = useWindowQueryParams()

    const { previousVersion, nextVersion } = useMemo(() => {
        const versionsObj = versions as unknown
        if (
            !R.isPlainObject(versionsObj) ||
            !("versions" in versionsObj) ||
            !Array.isArray(versionsObj.versions)
        )
            return {
                previousVersion: propsPreviousVersion,
                nextVersion: propsNextVersion,
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
    }, [versions, propsPreviousVersion, propsNextVersion, pageArchivalDate])

    return (
        <nav className="archive-navigation-bar grid grid-cols-12-full-width">
            <div className="archive-navigation-bar__wrapper col-start-2 span-cols-12">
                <ArchiveText tooltipContent="We update our data regularly. To aid transparency and reproducibility, we archive versions of the data when an update is made. This allows users to cite a specific version of the data that does not change." />
                <ArchiveDate dayjsDate={dayjsDate} />
                {hasButtons && (
                    <div className="archive-chart-navigation-bar__buttons">
                        <Button
                            className="archive-chart-navigation-bar__button archive-chart-navigation-bar__button-left"
                            style={{
                                visibility: previousVersion
                                    ? "visible"
                                    : "hidden",
                            }}
                            href={
                                previousVersion
                                    ? previousVersion.url + queryStr
                                    : undefined
                            }
                            theme="outline-white"
                            icon={faArrowLeft}
                            iconPosition="left"
                            text="Go to the previous version"
                            dataTrackNote="archive-header-go-to-previous"
                        />
                        {liveUrl && (
                            <Button
                                className="archive-chart-navigation-bar__button"
                                href={liveUrl + queryStr}
                                theme="solid-dark-blue"
                                icon={null}
                                text="Go to the live version"
                                dataTrackNote="archive-header-go-to-live"
                            />
                        )}
                        <Button
                            className="archive-chart-navigation-bar__button archive-chart-navigation-bar__button-right"
                            style={{
                                visibility: nextVersion ? "visible" : "hidden",
                            }}
                            href={
                                nextVersion
                                    ? nextVersion.url + queryStr
                                    : undefined
                            }
                            theme="outline-white"
                            icon={faArrowRight}
                            iconPosition="right"
                            text="Go to the next version"
                            dataTrackNote="archive-header-go-to-next"
                        />
                    </div>
                )}
            </div>
        </nav>
    )
}

export function ArchiveArticleNavigation(props: ArchiveArticleNavigationProps) {
    return (
        <div className="archive-site-navigation">
            <ArchiveHeaderLogoBar />
            <ArchiveArticleNavigationBar {...props} />
        </div>
    )
}

function ArchiveArticleNavigationBar({
    versionsFileUrl,
    liveUrl,
    archivalDate,
}: ArchiveArticleNavigationProps) {
    const hasButtons = Boolean(versionsFileUrl || liveUrl)
    const dayjsDate = parseArchivalDate(archivalDate)
    const pageArchivalDate = formatAsArchivalDate(dayjsDate)
    const versions = useArchiveVersions(versionsFileUrl)
    const queryStr = useWindowQueryParams()
    const [isDrawerOpen, setIsDrawerOpen] = useState(false)
    const liveVersionHref = liveUrl ? liveUrl + queryStr : undefined
    return (
        <>
            <nav className="archive-navigation-bar grid grid-cols-12-full-width">
                <div className="archive-navigation-bar__wrapper col-start-2 span-cols-12">
                    <ArchiveText tooltipContent="We update our data and writing regularly. To aid transparency and reproducibility, we archive articles when either their content or related data changes. This allows you to cite a specific version of an article that remains the same across time." />
                    <ArchiveDate dayjsDate={dayjsDate} />
                    {hasButtons && (
                        <div className="archive-article-navigation-bar__buttons">
                            {versionsFileUrl && (
                                <Button
                                    theme="outline-white"
                                    icon={null}
                                    text="Browse all versions"
                                    dataTrackNote="archive-header-browse-versions"
                                    onClick={() => setIsDrawerOpen(true)}
                                />
                            )}
                            {liveVersionHref && (
                                <Button
                                    href={liveVersionHref}
                                    theme="solid-dark-blue"
                                    icon={null}
                                    text="Go to the live version"
                                    dataTrackNote="archive-header-go-to-live"
                                />
                            )}
                        </div>
                    )}
                </div>
            </nav>
            {/* NOTE: We should render the versions drawer only once per page,
            but since the header and the gdoc body are hydrated separately, they
            don't have a common parent where we could share the drawer state and
            render it only once. Data fetching is deduplicated because they
            share the query client. */}
            {versions.length > 0 && (
                <VersionsDrawer
                    isOpen={isDrawerOpen}
                    onOpenChange={setIsDrawerOpen}
                    versions={versions}
                    queryString={queryStr}
                    liveUrl={liveVersionHref}
                    currentArchivalDate={pageArchivalDate}
                />
            )}
        </>
    )
}
