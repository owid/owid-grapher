import { observer } from "mobx-react"
import * as React from "react"
import { computed, action, makeObservable } from "mobx"
import { Bounds, Url } from "@ourworldindata/utils"
import { Modal } from "./Modal"
import {
    Checkbox,
    CodeSnippet,
    OverlayHeader,
} from "@ourworldindata/components"
import { DEFAULT_GRAPHER_BOUNDS, GrapherModal } from "../core/GrapherConstants"

export interface EmbedModalManager {
    embedUrl?: string
    embedArchivedUrl?: string
    activeModal?: GrapherModal
    canHideExternalControlsInEmbed: boolean
    hideExternalControlsInEmbedUrl: boolean
    setHideExternalControlsInEmbedUrl: (value: boolean) => void
    frameBounds?: Bounds
}

interface EmbedModalProps {
    manager: EmbedModalManager
}

interface EmbedOptions {
    title: string
    description: React.ReactElement
    url: string
}

@observer
export class EmbedModal extends React.Component<EmbedModalProps> {
    constructor(props: EmbedModalProps) {
        super(props)
        makeObservable(this)
    }

    @computed get manager(): EmbedModalManager {
        return this.props.manager
    }

    @computed private get frameBounds(): Bounds {
        return this.manager.frameBounds ?? DEFAULT_GRAPHER_BOUNDS
    }

    @computed private get modalBounds(): Bounds {
        const maxWidth = 940
        const padWidth = Math.max(16, (this.frameBounds.width - maxWidth) / 2)
        return this.frameBounds.padHeight(16).padWidth(padWidth)
    }

    @computed private get embedOptions(): EmbedOptions[] {
        const { embedUrl, embedArchivedUrl } = this.manager

        const opts: EmbedOptions[] = []

        // We only check origins (domain + port) because:
        // - Query params are not relevant
        // - We use the /latest/ path prefix as an alias for the latest version
        //   of the chart, which is not the same as the canonical URL
        // - Archive and live versions live on a different domain
        const areEmbedAndArchivedOriginsSame =
            Url.fromURL(this.manager.embedUrl ?? "").origin ===
            Url.fromURL(this.manager.embedArchivedUrl ?? "").origin

        if (embedUrl && !areEmbedAndArchivedOriginsSame) {
            opts.push({
                title: "Chart with data updates",
                description: (
                    <span>
                        To embed a version of this chart that will{" "}
                        <strong>update</strong> when we update the data on our
                        site, paste this code into an HTML page:
                    </span>
                ),
                url: embedUrl,
            })
        }
        if (embedArchivedUrl) {
            opts.push({
                title: "Archived chart without data updates",
                description: (
                    <span>
                        To embed this specific version of the chart that will{" "}
                        <strong>not update</strong> when we update the data on
                        our site, paste this code into an HTML page:
                    </span>
                ),
                url: embedArchivedUrl,
            })
        }
        return opts
    }

    private codeSnippetForUrl(url: string): string {
        return `<iframe src="${url}" loading="lazy" style="width: 100%; height: 600px; border: 0px none;" allow="web-share; clipboard-write"></iframe>`
    }

    @action.bound private onDismiss(): void {
        this.manager.activeModal = undefined
    }

    override render() {
        const { embedOptions } = this

        if (!embedOptions.length) return null
        return (
            <Modal
                bounds={this.modalBounds}
                alignVertical="bottom"
                onDismiss={this.onDismiss}
            >
                <div
                    className="embed-modal-content"
                    style={{ maxHeight: this.modalBounds.height }}
                >
                    <OverlayHeader title="Embed" onDismiss={this.onDismiss} />
                    <div className="scrollable">
                        <div className="embed-modal--options">
                            {embedOptions.map((option) => (
                                <div
                                    key={option.title}
                                    className="embed-modal--option"
                                >
                                    <h3 className="grapher_body-2-semibold embed-modal--option-title">
                                        {option.title}
                                    </h3>
                                    <p className="grapher_label-1-medium embed-modal--option-description">
                                        {option.description}
                                    </p>
                                    <CodeSnippet
                                        code={this.codeSnippetForUrl(
                                            option.url
                                        )}
                                    />
                                </div>
                            ))}
                        </div>
                        {this.manager.canHideExternalControlsInEmbed && (
                            <Checkbox
                                className="embed-modal-hide-controls"
                                label="Hide controls"
                                checked={
                                    this.manager.hideExternalControlsInEmbedUrl
                                }
                                onChange={(event) =>
                                    this.manager.setHideExternalControlsInEmbedUrl(
                                        event.target.checked
                                    )
                                }
                            />
                        )}
                    </div>
                </div>
            </Modal>
        )
    }
}
