import { observer } from "mobx-react"
import React from "react"
import { computed, action } from "mobx"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import { faCopy } from "@fortawesome/free-solid-svg-icons"
import {
    Bounds,
    canWriteToClipboard,
    DEFAULT_BOUNDS,
} from "@ourworldindata/utils"
import { Modal } from "./Modal"

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

interface EmbedModalState {
    canWriteToClipboard: boolean
}

@observer
export class EmbedModal extends React.Component<
    EmbedModalProps,
    EmbedModalState
> {
    textAreaRef: React.RefObject<HTMLTextAreaElement> = React.createRef()

    constructor(props: EmbedModalProps) {
        super(props)

        this.state = {
            canWriteToClipboard: false,
        }
    }

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

    @action.bound resizeTextArea(): void {
        if (this.textAreaRef.current) {
            const textArea = this.textAreaRef.current
            textArea.style.height = textArea.scrollHeight + "px"
        }
    }

    componentDidMount(): void {
        canWriteToClipboard().then((canWriteToClipboard) =>
            this.setState({ canWriteToClipboard })
        )
        this.resizeTextArea()
    }

    componentDidUpdate(): void {
        this.resizeTextArea()
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
                    <div className="embedCode">
                        <textarea
                            ref={this.textAreaRef}
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
            </Modal>
        )
    }
}
