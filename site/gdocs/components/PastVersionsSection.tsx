import { useState } from "react"
import { faClockRotateLeft } from "@fortawesome/free-solid-svg-icons"
import { PAST_VERSIONS_ID } from "@ourworldindata/utils"
import { Button } from "@ourworldindata/components"
import { VersionsDrawer } from "../../archive/VersionsDrawer.js"
import { useArchiveVersions } from "../../archive/versions.js"
import { useWindowQueryParams } from "../../hooks.js"
import { useDocumentContext, useVersionsFileUrl } from "../DocumentContext.js"

/** The "Past versions" section at the foot of an article */
export function PastVersionsSection() {
    const { archiveContext } = useDocumentContext()
    const isOnArchivePage = archiveContext?.type === "archive-page"
    const versionsFileUrl = useVersionsFileUrl()
    const [isDrawerOpen, setIsDrawerOpen] = useState(false)
    const [hasRequestedVersions, setHasRequestedVersions] = useState(false)
    const { data: versions, status } = useArchiveVersions(versionsFileUrl, {
        enabled: hasRequestedVersions,
    })
    const queryStr = useWindowQueryParams()
    let liveUrl: string | undefined
    if (isOnArchivePage) {
        liveUrl = archiveContext?.archiveNavigation.liveUrl + queryStr
    } else {
        liveUrl =
            typeof window !== "undefined" ? window.location.href : undefined
    }

    function handleDrawerOpenChange(isOpen: boolean) {
        setIsDrawerOpen(isOpen)
        if (isOpen) setHasRequestedVersions(true)
    }

    if (!versionsFileUrl) return null

    return (
        <section
            id={PAST_VERSIONS_ID}
            className="past-versions-section grid grid-cols-12-full-width col-start-1 col-end-limit"
        >
            <div className="past-versions-section__content col-start-4 span-cols-8 col-md-start-3 span-md-cols-10 col-sm-start-2 span-sm-cols-12">
                <div className="past-versions-section__copy">
                    <h3>Past versions</h3>
                    <p>
                        We are a live site and we keep our work maintained. So
                        our articles are often changed, including the data. You
                        can browse previous versions of this work here.
                    </p>
                </div>
                <Button
                    className="past-versions-section__browse-button"
                    theme="outline-dark-blue"
                    text="Browse past versions"
                    icon={faClockRotateLeft}
                    iconPosition="left"
                    onClick={() => handleDrawerOpenChange(true)}
                    dataTrackNote="gdoc-header-browse-versions"
                />
            </div>
            {/* NOTE: On archived pages, the archive navigation bar renders a
            second versions drawer. It is hydrated separately from the gdoc
            body, so the two can't share one drawer. Data fetching is
            deduplicated because they share the query client. */}
            <VersionsDrawer
                isOpen={isDrawerOpen}
                onOpenChange={handleDrawerOpenChange}
                versions={versions}
                status={status}
                queryString={queryStr}
                isLive={!isOnArchivePage}
                liveUrl={liveUrl}
                currentArchivalDate={archiveContext?.archivalDate}
                archiveUrl={archiveContext?.archiveUrl}
            />
        </section>
    )
}
