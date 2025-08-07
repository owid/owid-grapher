import { observer } from "mobx-react"
import * as React from "react"
import { computed, action, makeObservable } from "mobx"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import {
    faCode,
    faShareAlt,
    faLink,
    faEdit,
    faPanorama,
} from "@fortawesome/free-solid-svg-icons"
import { canWriteToClipboard, isAndroid, isIOS } from "@ourworldindata/utils"
import { GrapherModal } from "../core/GrapherConstants"

export interface ShareMenuManager {
    slug?: string
    currentTitle?: string
    canonicalUrl?: string
    editUrl?: string
    createNarrativeChartUrl?: string
    activeModal?: GrapherModal
}

interface ShareMenuProps {
    manager: ShareMenuManager
    onDismiss?: () => void
    right?: number
}

interface ShareMenuState {
    canWriteToClipboard: boolean
    copied: boolean
}

type ShareApiManager = Pick<ShareMenuManager, "canonicalUrl" | "currentTitle">

const getShareData = (manager: ShareApiManager): ShareData | undefined => {
    if (!manager.canonicalUrl) return undefined

    return {
        title: manager.currentTitle ?? "",
        url: manager.canonicalUrl,
    }
}

const canUseShareApi = (manager: ShareApiManager): boolean => {
    const shareData = getShareData(manager)
    if (!shareData) return false

    return (
        "share" in navigator &&
        "canShare" in navigator &&
        navigator.canShare(shareData)
    )
}

// On mobile OSs, the system-level share API does a way better job of providing
// relevant options to the user than our own <ShareMenu> does - for example,
// quick access to messaging apps, the user's frequent contacts, etc.
// So, on Android and iOS, we want to just show the system-level share dialog
// immediately when the user clicks the share button, rather than showing our
// own menu.
// See https://github.com/owid/owid-grapher/issues/3446
// -@marcelgerber, 2024-04-24
export const shouldShareUsingShareApi = (manager: ShareApiManager): boolean =>
    (isAndroid() || isIOS()) && canUseShareApi(manager)

export const shareUsingShareApi = async (
    manager: ShareApiManager
): Promise<void> => {
    if (!navigator.share) return

    const shareData = getShareData(manager)
    if (!shareData) return

    try {
        await navigator.share(shareData)
    } catch (err) {
        console.error("couldn't share using navigator.share", err)
    }
}

@observer
export class ShareMenu extends React.Component<ShareMenuProps, ShareMenuState> {
    dismissable = true

    constructor(props: ShareMenuProps) {
        super(props)

        makeObservable(this)

        this.state = {
            canWriteToClipboard: false,
            copied: false,
        }
    }

    static shouldShow(manager: ShareMenuManager): boolean {
        const test = new ShareMenu({ manager })
        return test.showShareMenu
    }

    @computed get manager(): ShareMenuManager {
        return this.props.manager
    }

    @computed get title(): string {
        return this.manager.currentTitle ?? ""
    }

    @computed get showShareMenu(): boolean {
        return !!this.canonicalUrl || !!this.manager.editUrl
    }

    @computed get canonicalUrl(): string | undefined {
        return this.manager.canonicalUrl
    }

    @action.bound dismiss(): void {
        this.props.onDismiss?.()
    }

    @action.bound onClickSomewhere(): void {
        if (this.dismissable) this.dismiss()
        else this.dismissable = true
    }

    override componentDidMount(): void {
        document.addEventListener("click", this.onClickSomewhere)
        void canWriteToClipboard().then((canWriteToClipboard) =>
            this.setState({ canWriteToClipboard })
        )
    }

    override componentWillUnmount(): void {
        document.removeEventListener("click", this.onClickSomewhere)
    }

    @action.bound onEmbed(e: React.MouseEvent): void {
        const { canonicalUrl, manager } = this
        if (!canonicalUrl) return
        manager.activeModal = GrapherModal.Embed
        this.dismiss()
        e.stopPropagation()
    }

    @action.bound async onNavigatorShare(): Promise<void> {
        await shareUsingShareApi(this.manager)
    }

    @action.bound async onCopyUrl(): Promise<void> {
        if (!this.canonicalUrl) return

        try {
            await navigator.clipboard.writeText(this.canonicalUrl)
            this.setState({ copied: true })
        } catch (err) {
            console.error(
                "couldn't copy to clipboard using navigator.clipboard",
                err
            )
        }
    }

    @computed get canUseShareApi(): boolean {
        return canUseShareApi(this.manager)
    }

    override render(): React.ReactElement {
        const { canUseShareApi, manager } = this
        const { editUrl, createNarrativeChartUrl } = manager

        const width = 200
        const right = this.props.right ?? 0
        const style: React.CSSProperties = {
            width,
            right: Math.max(-width * 0.5, -right),
        }

        return (
            <div
                className="ShareMenu"
                onClick={action(() => (this.dismissable = false))}
                style={style}
            >
                <h2>Share</h2>
                {this.canonicalUrl && (
                    <a
                        className="embed"
                        title="Embed this visualization in another HTML document"
                        data-track-note="chart_share_embed"
                        onClick={this.onEmbed}
                    >
                        <FontAwesomeIcon className="icon" icon={faCode} />
                        Embed
                    </a>
                )}
                {canUseShareApi && (
                    <a
                        title="Share this visualization with an app on your device"
                        data-track-note="chart_share_navigator"
                        onClick={this.onNavigatorShare}
                    >
                        <FontAwesomeIcon className="icon" icon={faShareAlt} />
                        Share via&hellip;
                    </a>
                )}
                {this.state.canWriteToClipboard && this.canonicalUrl && (
                    <a
                        title="Copy link to clipboard"
                        data-track-note="chart_share_copylink"
                        onClick={this.onCopyUrl}
                    >
                        <FontAwesomeIcon className="icon" icon={faLink} />
                        {this.state.copied ? "Copied!" : "Copy link"}
                    </a>
                )}
                {editUrl && (
                    <a
                        target="_blank"
                        title="Edit chart"
                        href={editUrl}
                        rel="noopener"
                    >
                        <FontAwesomeIcon className="icon" icon={faEdit} />
                        Edit
                    </a>
                )}
                {createNarrativeChartUrl && (
                    <a
                        target="_blank"
                        title="Create a narrative chart"
                        href={createNarrativeChartUrl}
                        rel="noopener"
                    >
                        <FontAwesomeIcon className="icon" icon={faPanorama} />
                        Create narrative chart
                    </a>
                )}
            </div>
        )
    }
}
