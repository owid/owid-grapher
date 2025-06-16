import cx from "classnames"
import {
    EnrichedBlockResourcePanel,
    ResourcePanelIcon as TResourcePanelIcon,
} from "@ourworldindata/types"
import { useContext } from "react"
import { AttachmentsContext } from "../AttachmentsContext"
import { BAKED_BASE_URL } from "../../../settings/clientSettings"
import { HybridLinkList } from "./HybridLinkList"
import { Button } from "@ourworldindata/components"

function DataCatalogButton({ buttonText }: { buttonText?: string }) {
    const { tags } = useContext(AttachmentsContext)
    const firstTagName = tags[0]?.name
    if (!buttonText || !firstTagName) return null

    const dataCatalogUrl = `${BAKED_BASE_URL}/data?topics=${firstTagName}`
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

    const iconMap: Record<TResourcePanelIcon, JSX.Element> = {
        chart: (
            // Different from the FontAwesome linechart that we have
            <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 32 32"
            >
                <g clipPath="url(#a)">
                    <path
                        fill="#CE261E"
                        d="m5.10019 27.5455 6.15761-11.5637 7.0346 6.254c.2202.1957.4825.3383.7664.4168.284.0785.5822.0909.8718.0361.2921-.0547.5676-.1762.805-.3551.2374-.1789.4302-.4102.5633-.676l5.3193-10.5903-1.7538-.8673-5.2904 10.6-7.0345-6.254c-.2147-.1997-.4721-.3477-.7527-.4329-.2805-.0851-.5768-.1052-.8662-.0586-.2859.0475-.5574.1587-.7943.3256-.2369.1668-.43314.3849-.57411.6381l-5.09763 9.6363V2.49091H2.52728V27.5455c0 .5111.20305 1.0013.56449 1.3627.36143.3615.85164.5645 1.36279.5645H29.5091v-1.9272H5.10019Z"
                    />
                </g>
                <defs>
                    <clipPath id="a">
                        <path
                            fill="#fff"
                            d="M.600037.563599h30.8364v30.8364H.600037z"
                        />
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
