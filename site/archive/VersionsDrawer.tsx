import cx from "classnames"
import { ModalOverlay, Modal, Dialog } from "react-aria-components"
import { CloseButton } from "@ourworldindata/components"
import { ArchivalDateString, ArchiveVersions } from "@ourworldindata/types"
import { parseArchivalDate } from "@ourworldindata/utils"
import { ARCHIVE_BASE_URL } from "../../settings/clientSettings.js"
import { DATE_FORMAT, TIME_FORMAT } from "./ArchiveNavigation.js"

export type ArchiveVersionEntry = ArchiveVersions["versions"][number]

function formatVersionDateTime(archivalDate: ArchivalDateString) {
    const versionDate = parseArchivalDate(archivalDate)
    return `${versionDate.format(DATE_FORMAT)} at ${versionDate.format(TIME_FORMAT)} UTC`
}

function VersionItem({
    variant,
    href,
    title,
    descriptor,
    isSelected,
    isLive,
}: {
    variant: "small" | "large"
    href: string
    title: string
    descriptor?: string
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
                {descriptor && (
                    <div className="versions-drawer-timeline__descriptor">
                        {descriptor}
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
    liveUrl,
    currentArchivalDate,
}: {
    versions: ArchiveVersionEntry[]
    queryString: string
    isLive?: boolean
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
            {versions.map((version, index) => {
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
                        href={`${ARCHIVE_BASE_URL}${version.url}${queryString}`}
                        title={formattedDisplay}
                        isSelected={isSelected}
                        descriptor={
                            isFirstVersion
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
    queryString,
    isLive,
    liveUrl,
    currentArchivalDate,
}: {
    isOpen: boolean
    onOpenChange: (isOpen: boolean) => void
    versions: ArchiveVersionEntry[]
    queryString: string
    isLive?: boolean
    liveUrl?: string
    currentArchivalDate?: ArchivalDateString
}) {
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
                                <VersionsTimeline
                                    versions={versions}
                                    queryString={queryString}
                                    isLive={isLive}
                                    liveUrl={liveUrl}
                                    currentArchivalDate={currentArchivalDate}
                                />
                            </div>
                        </div>
                    )}
                </Dialog>
            </Modal>
        </ModalOverlay>
    )
}
