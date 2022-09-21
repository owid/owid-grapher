import { observer } from "mobx-react"
import React from "react"
import { computed, action, makeObservable } from "mobx";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import { faTwitter } from "@fortawesome/free-brands-svg-icons/faTwitter"
import { faFacebook } from "@fortawesome/free-brands-svg-icons/faFacebook"
import { faCode } from "@fortawesome/free-solid-svg-icons/faCode"
import { faShareAlt } from "@fortawesome/free-solid-svg-icons/faShareAlt"
import { faCopy } from "@fortawesome/free-solid-svg-icons/faCopy"
import { faEdit } from "@fortawesome/free-solid-svg-icons/faEdit"

export interface ShareMenuManager {
    slug?: string
    currentTitle?: string
    canonicalUrl?: string
    embedUrl?: string
    embedDialogAdditionalElements?: React.ReactElement
    editUrl?: string
    addPopup: (popup: any) => void
    removePopup: (popup: any) => void
}

interface ShareMenuProps {
    manager: ShareMenuManager
    onDismiss: () => void
}

interface ShareMenuState {
    copied: boolean
}

export const ShareMenu = observer(class ShareMenu extends React.Component<ShareMenuProps, ShareMenuState> {
    dismissable = true

    constructor(props: ShareMenuProps) {
        super(props)

        makeObservable(this, {
            manager: computed,
            title: computed,
            isDisabled: computed,
            canonicalUrl: computed,
            dismiss: action.bound,
            onClickSomewhere: action.bound,
            onEmbed: action.bound,
            onNavigatorShare: action.bound,
            onCopyUrl: action.bound,
            twitterHref: computed,
            facebookHref: computed
        });

        this.state = {
            copied: false,
        }
    }

    get manager(): ShareMenuManager {
        return this.props.manager
    }

    get title(): string {
        return this.manager.currentTitle ?? ""
    }

    get isDisabled(): boolean {
        return !this.manager.slug
    }

    get canonicalUrl(): string | undefined {
        return this.manager.canonicalUrl
    }

    dismiss(): void {
        this.props.onDismiss()
    }

    onClickSomewhere(): void {
        if (this.dismissable) this.dismiss()
        else this.dismissable = true
    }

    componentDidMount(): void {
        document.addEventListener("click", this.onClickSomewhere)
    }

    componentWillUnmount(): void {
        document.removeEventListener("click", this.onClickSomewhere)
    }

    onEmbed(): void {
        if (!this.canonicalUrl) return

        this.manager.addPopup(
            <EmbedMenu key="EmbedMenu" manager={this.manager} />
        )
        this.dismiss()
    }

    async onNavigatorShare(): Promise<void> {
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

    onCopyUrl(): void {
        if (!this.canonicalUrl) return

        try {
            navigator.clipboard.writeText(this.canonicalUrl)
            this.setState({ copied: true })
        } catch (err) {
            console.error(
                "couldn't copy to clipboard using navigator.clipboard",
                err
            )
        }
    }

    get twitterHref(): string {
        let href =
            "https://twitter.com/intent/tweet/?text=" +
            encodeURIComponent(this.title)
        if (this.canonicalUrl)
            href += "&url=" + encodeURIComponent(this.canonicalUrl)
        return href
    }

    get facebookHref(): string {
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
                    data-track-note="chart-share-twitter"
                    href={twitterHref}
                    rel="noopener"
                >
                    <FontAwesomeIcon icon={faTwitter} /> Twitter
                </a>
                <a
                    className="btn"
                    target="_blank"
                    title="Share on Facebook"
                    data-track-note="chart-share-facebook"
                    href={facebookHref}
                    rel="noopener"
                >
                    <FontAwesomeIcon icon={faFacebook} /> Facebook
                </a>
                <a
                    className="btn"
                    title="Embed this visualization in another HTML document"
                    data-track-note="chart-share-embed"
                    onClick={this.onEmbed}
                >
                    <FontAwesomeIcon icon={faCode} /> Embed
                </a>
                {"share" in navigator && (
                    <a
                        className="btn"
                        title="Share this visualization with an app on your device"
                        data-track-note="chart-share-navigator"
                        onClick={this.onNavigatorShare}
                    >
                        <FontAwesomeIcon icon={faShareAlt} /> Share via&hellip;
                    </a>
                )}
                {"clipboard" in navigator && (
                    <a
                        className="btn"
                        title="Copy link to clipboard"
                        data-track-note="chart-share-copylink"
                        onClick={this.onCopyUrl}
                    >
                        <FontAwesomeIcon icon={faCopy} />
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
});

const EmbedMenu = observer(class EmbedMenu extends React.Component<{
    manager: ShareMenuManager
}> {
    dismissable = true

    constructor(
        props: {
            manager: ShareMenuManager
        }
    ) {
        super(props);

        makeObservable(this, {
            onClickSomewhere: action.bound,
            manager: computed,
            onClick: action.bound
        });
    }

    onClickSomewhere(): void {
        if (this.dismissable) this.manager.removePopup(EmbedMenu)
        else this.dismissable = true
    }

    get manager(): ShareMenuManager {
        return this.props.manager
    }

    onClick(): void {
        this.dismissable = false
    }

    componentDidMount(): void {
        document.addEventListener("click", this.onClickSomewhere)
    }

    componentWillUnmount(): void {
        document.removeEventListener("click", this.onClickSomewhere)
    }

    render(): JSX.Element {
        const url = this.manager.embedUrl ?? this.manager.canonicalUrl
        return (
            <div className="embedMenu" onClick={this.onClick}>
                <h2>Embed</h2>
                <p>Paste this into any HTML page:</p>
                <textarea
                    readOnly={true}
                    onFocus={(evt): void => evt.currentTarget.select()}
                    value={`<iframe src="${url}" loading="lazy" style="width: 100%; height: 600px; border: 0px none;"></iframe>`}
                />
                {this.manager.embedDialogAdditionalElements}
            </div>
        )
    }
});
