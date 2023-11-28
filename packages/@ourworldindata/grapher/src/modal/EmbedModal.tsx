import { observer } from "mobx-react"
import React from "react"
import { computed, action } from "mobx"
import { Bounds, DEFAULT_BOUNDS } from "@ourworldindata/utils"
import { Modal } from "./Modal"
import { CodeSnippet } from "@ourworldindata/components"

export interface EmbedModalManager {
    canonicalUrl?: string
    embedUrl?: string
    embedDialogAdditionalElements?: React.ReactElement
    isEmbedModalOpen?: boolean
    tabBounds?: Bounds
}

interface EmbedModalProps {
    manager: EmbedModalManager
}

@observer
export class EmbedModal extends React.Component<EmbedModalProps> {
    @computed private get tabBounds(): Bounds {
        return this.manager.tabBounds ?? DEFAULT_BOUNDS
    }

    @computed private get modalBounds(): Bounds {
        const maxWidth = 940
        const padWidth = Math.max(16, (this.tabBounds.width - maxWidth) / 2)
        return this.tabBounds.padHeight(16).padWidth(padWidth)
    }

    @computed private get codeSnippet(): string {
        const url = this.manager.embedUrl ?? this.manager.canonicalUrl
        return `<iframe src="${url}" loading="lazy" style="width: 100%; height: 600px; border: 0px none;"></iframe>`
    }

    @computed get manager(): EmbedModalManager {
        return this.props.manager
    }

    render(): JSX.Element {
        return (
            <Modal
                title="Embed"
                onDismiss={action(
                    () => (this.manager.isEmbedModalOpen = false)
                )}
                bounds={this.modalBounds}
                alignVertical="bottom"
            >
                <div className="embedMenu">
                    <p>Paste this into any HTML page:</p>
                    <CodeSnippet code={this.codeSnippet} />
                    {this.manager.embedDialogAdditionalElements}
                </div>
            </Modal>
        )
    }
}
