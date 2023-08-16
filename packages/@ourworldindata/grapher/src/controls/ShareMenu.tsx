import { observer } from "mobx-react"
import React from "react"
import { computed, action } from "mobx"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import { faTwitter, faFacebook } from "@fortawesome/free-brands-svg-icons"
import {
    faCode,
    faShareAlt,
    faLink,
    faEdit,
    faCopy,
} from "@fortawesome/free-solid-svg-icons"
import { canWriteToClipboard } from "@ourworldindata/utils"
import { ModalContext } from "../modal/Modal"

export interface ShareMenuManager {
    slug?: string
    currentTitle?: string
    canonicalUrl?: string
    editUrl?: string
    isEmbedModalOpen?: boolean
}

interface ShareMenuProps {
    manager: ShareMenuManager
    onDismiss: () => void
}

interface ShareMenuState {
    canWriteToClipboard: boolean
    copied: boolean
}

@observer
export class ShareMenu extends React.Component<ShareMenuProps, ShareMenuState> {
    dismissable = true

    constructor(props: ShareMenuProps) {
        super(props)

        this.state = {
            canWriteToClipboard: false,
            copied: false,
        }
    }

    @computed get manager(): ShareMenuManager {
        return this.props.manager
    }

    @computed get title(): string {
        return this.manager.currentTitle ?? ""
    }

    @computed get isDisabled(): boolean {
        return !this.manager.slug
    }

    @computed get canonicalUrl(): string | undefined {
        return this.manager.canonicalUrl
    }

    @action.bound dismiss(): void {
        this.props.onDismiss()
    }

    @action.bound onClickSomewhere(): void {
        if (this.dismissable) this.dismiss()
        else this.dismissable = true
    }

    componentDidMount(): void {
        document.addEventListener("click", this.onClickSomewhere)
        canWriteToClipboard().then((canWriteToClipboard) =>
            this.setState({ canWriteToClipboard })
        )
    }

    componentWillUnmount(): void {
        document.removeEventListener("click", this.onClickSomewhere)
    }

    @action.bound onEmbed(): void {
        const { canonicalUrl, manager } = this
        if (!canonicalUrl) return
        manager.isEmbedModalOpen = true
        this.dismiss()
    }

    @action.bound async onNavigatorShare(): Promise<void> {
        if (!this.canonicalUrl || !navigator.share) return

        const shareData = {
            title: this.title,
            url: this.canonicalUrl,
        }

        try {
            await navigator.share(shareData)
        } catch (err) {
            console.error("couldn't share using navigator.share", err)
        }
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

    @computed get twitterHref(): string {
        let href =
            "https://twitter.com/intent/tweet/?text=" +
            encodeURIComponent(this.title)
        if (this.canonicalUrl)
            href += "&url=" + encodeURIComponent(this.canonicalUrl)
        return href
    }

    @computed get facebookHref(): string {
        let href =
            "https://www.facebook.com/dialog/share?app_id=1149943818390250&display=page"
        if (this.canonicalUrl)
            href += "&href=" + encodeURIComponent(this.canonicalUrl)
        return href
    }

    render(): JSX.Element {
        const { twitterHref, facebookHref, isDisabled, manager } = this
        const { editUrl } = manager

        return (
            <div
                className={"ShareMenu" + (isDisabled ? " disabled" : "")}
                onClick={action(() => (this.dismissable = false))}
            >
                <h2>Share</h2>
                <a
                    className="btn"
                    target="_blank"
                    title="Tweet a link"
                    data-track-note="chart_share_twitter"
                    href={twitterHref}
                    rel="noopener"
                >
                    <FontAwesomeIcon icon={faTwitter} /> Twitter
                </a>
                <a
                    className="btn"
                    target="_blank"
                    title="Share on Facebook"
                    data-track-note="chart_share_facebook"
                    href={facebookHref}
                    rel="noopener"
                >
                    <FontAwesomeIcon icon={faFacebook} /> Facebook
                </a>
                <a
                    className="btn btn-embed"
                    title="Embed this visualization in another HTML document"
                    data-track-note="chart_share_embed"
                    onClick={this.onEmbed}
                >
                    <FontAwesomeIcon icon={faCode} /> Embed
                </a>
                {"share" in navigator && (
                    <a
                        className="btn"
                        title="Share this visualization with an app on your device"
                        data-track-note="chart_share_navigator"
                        onClick={this.onNavigatorShare}
                    >
                        <FontAwesomeIcon icon={faShareAlt} /> Share via&hellip;
                    </a>
                )}
                {this.state.canWriteToClipboard && (
                    <a
                        className="btn"
                        title="Copy link to clipboard"
                        data-track-note="chart_share_copylink"
                        onClick={this.onCopyUrl}
                    >
                        <FontAwesomeIcon icon={faLink} />
                        {this.state.copied ? "Copied!" : "Copy link"}
                    </a>
                )}
                {editUrl && (
                    <a
                        className="btn"
                        target="_blank"
                        title="Edit chart"
                        href={editUrl}
                        rel="noopener"
                    >
                        <FontAwesomeIcon icon={faEdit} /> Edit
                    </a>
                )}
            </div>
        )
    }
}

export interface EmbedMenuManager {
    canonicalUrl?: string
    embedUrl?: string
    embedDialogAdditionalElements?: React.ReactElement
}

interface EmbedMenuProps {
    manager: EmbedMenuManager
}

interface EmbedMenuState {
    canWriteToClipboard: boolean
}

@observer
export class EmbedMenu extends React.Component<EmbedMenuProps, EmbedMenuState> {
    static contextType = ModalContext
    dismissable = true

    constructor(props: EmbedMenuProps) {
        super(props)

        this.state = {
            canWriteToClipboard: false,
        }
    }

    @computed private get codeSnippet(): string {
        const url = this.manager.embedUrl ?? this.manager.canonicalUrl
        return `<iframe src="${url}" loading="lazy" style="width: 100%; height: 600px; border: 0px none;"></iframe>`
    }

    @action.bound onClickSomewhere(): void {
        if (this.dismissable) this.context.onDismiss()
        else this.dismissable = true
    }

    @computed get manager(): EmbedMenuManager {
        return this.props.manager
    }

    @action.bound onClick(): void {
        this.dismissable = false
    }

    componentDidMount(): void {
        document.addEventListener("click", this.onClickSomewhere)
        canWriteToClipboard().then((canWriteToClipboard) =>
            this.setState({ canWriteToClipboard })
        )
    }

    componentWillUnmount(): void {
        document.removeEventListener("click", this.onClickSomewhere)
    }

    @action.bound async onCopyCodeSnippet(): Promise<void> {
        try {
            await navigator.clipboard.writeText(this.codeSnippet)
        } catch (err) {
            console.error(
                "couldn't copy to clipboard using navigator.clipboard",
                err
            )
        }
    }

    render(): JSX.Element {
        return (
            <div className="embedMenu" onClick={this.onClick}>
                <p>Paste this into any HTML page:</p>
                <div className="embedCode">
                    <textarea
                        readOnly={true}
                        onFocus={(evt): void => evt.currentTarget.select()}
                        value={this.codeSnippet}
                    />
                    {this.state.canWriteToClipboard && (
                        <button onClick={this.onCopyCodeSnippet}>
                            <FontAwesomeIcon icon={faCopy} />
                        </button>
                    )}
                </div>
                {this.manager.embedDialogAdditionalElements}
            </div>
        )
    }
}
