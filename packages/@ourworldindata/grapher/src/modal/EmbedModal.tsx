import { observer } from "mobx-react"
import React from "react"
import { computed, action } from "mobx"
import { Bounds, DEFAULT_BOUNDS } from "@ourworldindata/utils"
import { Modal } from "./Modal"
import { CodeSnippet, OverlayHeader } from "@ourworldindata/components"

export interface EmbedModalManager {
    canonicalUrl?: string
    embedUrl?: string
    embedDialogAdditionalElements?: React.ReactElement
    isEmbedModalOpen?: boolean
    frameBounds?: Bounds
}

interface EmbedModalProps {
    manager: EmbedModalManager
}

@observer
export class EmbedModal extends React.Component<EmbedModalProps> {
    @computed get manager(): EmbedModalManager {
        return this.props.manager
    }

    @computed private get frameBounds(): Bounds {
        return this.manager.frameBounds ?? DEFAULT_BOUNDS
    }

    @computed private get modalBounds(): Bounds {
        const maxWidth = 940
        const padWidth = Math.max(16, (this.frameBounds.width - maxWidth) / 2)
        return this.frameBounds.padHeight(16).padWidth(padWidth)
    }

    @computed private get codeSnippet(): string {
        const url = this.manager.embedUrl
        return `<iframe src="${url}" loading="lazy" style="width: 100%; height: 600px; border: 0px none;" allow="web-share; clipboard-write"></iframe>`
    }

    @action.bound private onDismiss(): void {
        this.manager.isEmbedModalOpen = false
    }

    render(): React.ReactElement {
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
                        <p className="grapher_label-1-medium">
                            Paste this into any HTML page:
                        </p>
                        <CodeSnippet code={this.codeSnippet} />
                        {this.manager.embedDialogAdditionalElements}
                    </div>
                </div>
            </Modal>
        )
    }
}
