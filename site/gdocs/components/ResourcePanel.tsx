import cx from "clsx"
import {
    EnrichedBlockResourcePanel,
    ResourcePanelIcon as TResourcePanelIcon,
} from "@ourworldindata/types"
import { useContext } from "react"
import { AttachmentsContext } from "../AttachmentsContext"
import { BAKED_BASE_URL } from "../../../settings/clientSettings.mjs"
import { HybridLinkList } from "./HybridLinkList"
import { Button } from "@ourworldindata/components"
import { queryParamsToStr } from "@ourworldindata/utils"

function DataCatalogButton({ buttonText }: { buttonText?: string }) {
    const { tags } = useContext(AttachmentsContext)
    const firstTagName = tags[0]?.name
    if (!buttonText || !firstTagName) return null

    const dataCatalogUrl =
        `${BAKED_BASE_URL}/data` +
        queryParamsToStr({
            topics: firstTagName,
        })
    return (
        <Button
            href={dataCatalogUrl}
            text={buttonText}
            theme={"solid-vermillion"}
        />
    )
}

function ResourcePanelIcon({
    className,
    icon,
}: {
    className: string
    icon?: TResourcePanelIcon
}) {
    if (!icon) return null

    const iconMap: Record<TResourcePanelIcon, React.ReactElement> = {
        chart: (
            // Different from the FontAwesome linechart that we have
            <svg fill="none" viewBox="0 0 32 32">
                <g clipPath="url(#a)">
                    <path
                        fill="#ce261e"
                        d="m5.1 27.546 6.158-11.564 7.034 6.254a1.93 1.93 0 0 0 2.444.098c.237-.18.43-.41.563-.676l5.32-10.59-1.755-.868-5.29 10.6-7.034-6.254a1.93 1.93 0 0 0-1.62-.492 1.93 1.93 0 0 0-1.368.964l-5.097 9.636V2.491H2.527v25.055a1.927 1.927 0 0 0 1.928 1.927h25.054v-1.927z"
                    />
                </g>
                <defs>
                    <clipPath id="a">
                        <path fill="#fff" d="M.6.564h30.836V31.4H.6z" />
                    </clipPath>
                </defs>
            </svg>
        ),
    }

    return <div className={className}>{iconMap[icon]}</div>
}

export function ResourcePanel({
    icon,
    className,
    title,
    kicker,
    buttonText,
    links,
}: EnrichedBlockResourcePanel & {
    className?: string
}) {
    return (
        <div className={cx(className, "resource-panel")}>
            <ResourcePanelIcon className="resource-panel__icon" icon={icon} />
            {kicker && (
                <span className="body-3-bold resource-panel__kicker">
                    {kicker}
                </span>
            )}
            {title && (
                <h3 className="h3-bold resource-panel__title">{title}</h3>
            )}
            <HybridLinkList links={links} />
            <DataCatalogButton buttonText={buttonText} />
        </div>
    )
}
