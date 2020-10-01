import { Grapher } from "grapher/core/Grapher"
import { observer } from "mobx-react"
import React from "react"
import { computed, action } from "mobx"
import Cookies from "js-cookie"
import copy from "copy-to-clipboard"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faTwitter } from "@fortawesome/free-brands-svg-icons/faTwitter"
import { faFacebook } from "@fortawesome/free-brands-svg-icons/faFacebook"
import { faCode } from "@fortawesome/free-solid-svg-icons/faCode"
import { faShareAlt } from "@fortawesome/free-solid-svg-icons/faShareAlt"
import { faCopy } from "@fortawesome/free-solid-svg-icons/faCopy"
import { faEdit } from "@fortawesome/free-solid-svg-icons/faEdit"
import { GrapherView } from "grapher/core/GrapherView"
import { CookieKeys } from "grapher/core/GrapherConstants"

@observer
class EmbedMenu extends React.Component<{
    grapherView: GrapherView
}> {
    dismissable = true

    @action.bound onClickSomewhere() {
        if (this.dismissable) {
            this.props.grapherView.removePopup(EmbedMenu)
        } else {
            this.dismissable = true
        }
    }

    @action.bound onClick() {
        this.dismissable = false
    }

    componentDidMount() {
        document.addEventListener("click", this.onClickSomewhere)
    }

    componentWillUnmount() {
        document.removeEventListener("click", this.onClickSomewhere)
    }

    render() {
        const url = this.props.grapherView.grapher.url.canonicalUrl
        return (
            <div className="embedMenu" onClick={this.onClick}>
                <h2>Embed</h2>
                <p>Paste this into any HTML page:</p>
                <textarea
                    readOnly={true}
                    onFocus={(evt) => evt.currentTarget.select()}
                    value={`<iframe src="${url}" loading="lazy" style="width: 100%; height: 600px; border: 0px none;"></iframe>`}
                />
                {this.props.grapherView.grapher.embedExplorerCheckbox}
            </div>
        )
    }
}

interface ShareMenuProps {
    grapher: Grapher
    grapherView: any
    onDismiss: () => void
}

interface ShareMenuState {
    copied: boolean
}

@observer
export class ShareMenu extends React.Component<ShareMenuProps, ShareMenuState> {
    dismissable = true

    constructor(props: ShareMenuProps) {
        super(props)

        this.state = {
            copied: false,
        }
    }

    @computed get title(): string {
        return this.props.grapher.currentTitle
    }

    @computed get isDisabled(): boolean {
        return !this.props.grapher.slug
    }

    @computed get editUrl(): string | undefined {
        const { grapher } = this.props
        return Cookies.get(CookieKeys.isAdmin) || grapher.isDev
            ? `${grapher.adminBaseUrl}/admin/charts/${grapher.id}/edit`
            : undefined
    }

    @computed get canonicalUrl(): string | undefined {
        return this.props.grapher.url.canonicalUrl
    }

    @action.bound dismiss() {
        this.props.onDismiss()
    }

    @action.bound onClickSomewhere() {
        if (this.dismissable) {
            this.dismiss()
        } else {
            this.dismissable = true
        }
    }

    componentDidMount() {
        document.addEventListener("click", this.onClickSomewhere)
    }

    componentWillUnmount() {
        document.removeEventListener("click", this.onClickSomewhere)
    }

    @action.bound onEmbed() {
        if (this.canonicalUrl) {
            this.props.grapherView.addPopup(
                <EmbedMenu
                    key="EmbedMenu"
                    grapherView={this.props.grapherView}
                />
            )
            this.dismiss()
        }
    }

    @action.bound async onNavigatorShare() {
        if (this.canonicalUrl && navigator.share) {
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
    }

    @action.bound onCopy() {
        if (this.canonicalUrl) {
            if (copy(this.canonicalUrl)) this.setState({ copied: true })
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

    render() {
        const { editUrl, twitterHref, facebookHref, isDisabled } = this

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
                <a
                    className="btn"
                    title="Copy link to clipboard"
                    data-track-note="chart-share-copylink"
                    onClick={this.onCopy}
                >
                    <FontAwesomeIcon icon={faCopy} />
                    {this.state.copied ? "Copied!" : "Copy link"}
                </a>
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
