import cx from "classnames"
import { ModalOverlay, Modal, Dialog } from "react-aria-components"
import type { QueryStatus } from "@tanstack/react-query"
import { CloseButton, LoadingIndicator } from "@ourworldindata/components"
import { ArchivalDateString, ArchiveVersions } from "@ourworldindata/types"
import { parseArchivalDate } from "@ourworldindata/utils"
import { ARCHIVE_BASE_URL, IS_ARCHIVE } from "../../settings/clientSettings.js"
import { DATE_FORMAT, TIME_FORMAT } from "./ArchiveNavigation.js"

const BASE_URL = IS_ARCHIVE ? "" : ARCHIVE_BASE_URL

export type ArchiveVersionEntry = ArchiveVersions["versions"][number]

function formatVersionDateTime(archivalDate: ArchivalDateString) {
    const versionDate = parseArchivalDate(archivalDate)
    return `${versionDate.format(DATE_FORMAT)} at ${versionDate.format(TIME_FORMAT)} UTC`
}

function getCurrentVersionEntry(
    archivalDate?: ArchivalDateString,
    archiveUrl?: string
): ArchiveVersionEntry | undefined {
    if (!archivalDate || typeof window === "undefined") return undefined
    const url = archiveUrl
        ? new URL(archiveUrl).pathname
        : window.location.pathname
    if (!url) return undefined
    const slug = url.split("/").filter(Boolean).pop()
    if (!slug) return undefined
    return { archivalDate, slug, url }
}

function VersionItem({
    variant,
    href,
    title,
    description,
    isSelected,
    isLive,
}: {
    variant: "small" | "large"
    href: string
    title: string
    description?: string
    isSelected?: boolean
    isLive?: boolean
}) {
    return (
        <li
            className={cx("versions-drawer-timeline__item", {
                "versions-drawer-timeline__item--small": variant === "small",
                "versions-drawer-timeline__item--large": variant === "large",
                "versions-drawer-timeline__item--selected": isSelected,
            })}
        >
            <div className="versions-drawer-timeline__dot" aria-hidden />
            <a
                className="versions-drawer-timeline__link"
                href={href}
                aria-current={isSelected ? "page" : undefined}
                data-track-note="archive-timeline-version-link"
            >
                <div
                    className={
                        // We need separate classes instead of default +
                        // override because the font mixins don't define the
                        // same properties.
                        isLive
                            ? "versions-drawer-timeline__title--live"
                            : "versions-drawer-timeline__title--archived"
                    }
                >
                    {title}
                </div>
                {description && (
                    <div className="versions-drawer-timeline__description">
                        {description}
                    </div>
                )}
            </a>
        </li>
    )
}

function VersionsTimeline({
    versions,
    queryString,
    isLive,
    isError,
    liveUrl,
    currentArchivalDate,
}: {
    versions: ArchiveVersionEntry[]
    queryString: string
    isLive?: boolean
    isError?: boolean
    liveUrl?: string
    currentArchivalDate?: ArchivalDateString
}) {
    return (
        <ol className="versions-drawer-timeline" aria-label="Archived versions">
            {liveUrl && (
                <VersionItem
                    variant="large"
                    href={liveUrl}
                    title="Live version"
                    isLive
                    isSelected={isLive}
                />
            )}
            {versions.toReversed().map((version, index) => {
                const formattedDisplay = formatVersionDateTime(
                    version.archivalDate
                )
                const isFirstVersion = index === versions.length - 1
                const isSelected =
                    !isLive && version.archivalDate === currentArchivalDate
                return (
                    <VersionItem
                        key={version.archivalDate}
                        variant={isFirstVersion ? "large" : "small"}
                        href={`${BASE_URL}${version.url}${queryString}`}
                        title={formattedDisplay}
                        isSelected={isSelected}
                        description={
                            isFirstVersion && !isError
                                ? "First available archived version of this article"
                                : undefined
                        }
                    />
                )
            })}
        </ol>
    )
}

export function VersionsDrawer({
    isOpen,
    onOpenChange,
    versions,
    status,
    queryString,
    isLive,
    liveUrl,
    currentArchivalDate,
    archiveUrl,
}: {
    isOpen: boolean
    onOpenChange: (isOpen: boolean) => void
    versions: ArchiveVersionEntry[]
    status: QueryStatus
    queryString: string
    isLive?: boolean
    liveUrl?: string
    currentArchivalDate?: ArchivalDateString
    archiveUrl?: string
}) {
    const currentVersionEntry = getCurrentVersionEntry(
        currentArchivalDate,
        archiveUrl
    )
    const versionsForTimeline =
        status === "error" && currentVersionEntry
            ? [currentVersionEntry]
            : versions
    const showTimeline = versionsForTimeline.length > 0
    let content
    if (status === "pending") {
        content = <LoadingIndicator />
    } else if (status === "error") {
        content = (
            <>
                {showTimeline ? (
                    <>
                        <VersionsTimeline
                            versions={versionsForTimeline}
                            queryString={queryString}
                            isLive={isLive}
                            isError={status === "error"}
                            liveUrl={liveUrl}
                            currentArchivalDate={currentArchivalDate}
                        />
                        <div
                            className="versions-drawer__status versions-drawer__status--error"
                            role="alert"
                        >
                            Unable to load more versions.
                        </div>
                    </>
                ) : (
                    <div className="versions-drawer__status" role="status">
                        No archived versions available.
                    </div>
                )}
            </>
        )
    } else if (!showTimeline) {
        content = (
            <div className="versions-drawer__status" role="status">
                No archived versions available.
            </div>
        )
    } else {
        content = (
            <VersionsTimeline
                versions={versionsForTimeline}
                queryString={queryString}
                isLive={isLive}
                liveUrl={liveUrl}
                currentArchivalDate={currentArchivalDate}
            />
        )
    }
    return (
        <ModalOverlay
            className="versions-drawer-overlay"
            isOpen={isOpen}
            onOpenChange={onOpenChange}
            isDismissable
        >
            <Modal className="versions-drawer-modal">
                <Dialog
                    aria-label="Version history"
                    className="versions-drawer-dialog"
                >
                    {({ close }) => (
                        <div className="versions-drawer-dialog__container">
                            <div className="versions-drawer-dialog__header">
                                <h2 className="versions-drawer-dialog__title">
                                    Version history
                                </h2>
                                <CloseButton
                                    className="versions-drawer-dialog__close-button"
                                    onClick={() => close()}
                                />
                            </div>
                            <div className="versions-drawer-dialog__content">
                                {content}
                            </div>
                        </div>
                    )}
                </Dialog>
            </Modal>
        </ModalOverlay>
    )
}
