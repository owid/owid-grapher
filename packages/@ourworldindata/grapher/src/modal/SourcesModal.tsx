import { Bounds } from "@ourworldindata/utils"
import { CLOSE_BUTTON_WIDTH } from "@ourworldindata/components"
import * as React from "react"
import { action, computed, makeObservable } from "mobx"
import { observer } from "mobx-react"
import { CoreColumn } from "@ourworldindata/core-table"
import { Modal } from "./Modal"
import { MAX_CONTENT_WIDTH, SourcesContent } from "./SourcesContent"
import { DEFAULT_GRAPHER_BOUNDS, GrapherModal } from "../core/GrapherConstants"

export interface SourcesModalManager {
    isReady?: boolean
    adminBaseUrl?: string
    inputColumnsWithSources: CoreColumn[]
    showAdminControls?: boolean
    activeModal?: GrapherModal
    frameBounds?: Bounds
    base: React.RefObject<HTMLDivElement | null>
    isEmbeddedInADataPage?: boolean
    isNarrow?: boolean
    fontSize?: number
}

interface SourcesModalProps {
    manager: SourcesModalManager
}

/** Returns the admin URL indicator titles link to, if admin controls are shown */
export function getSourcesEditBaseUrl(
    manager: SourcesModalManager
): string | undefined {
    if (!manager.showAdminControls) return undefined
    return `${manager.adminBaseUrl}/admin`
}

@observer
export class SourcesModal extends React.Component<SourcesModalProps> {
    constructor(props: SourcesModalProps) {
        super(props)
        makeObservable(this)
    }

    @computed private get manager(): SourcesModalManager {
        return this.props.manager
    }

    @computed private get frameBounds(): Bounds {
        return this.manager.frameBounds ?? DEFAULT_GRAPHER_BOUNDS
    }

    @computed private get modalBounds(): Bounds {
        const maxWidth = MAX_CONTENT_WIDTH + 220
        // using 15px instead of 16px to make sure the modal fully covers the OWID logo in the header
        const padWidth = Math.max(15, (this.frameBounds.width - maxWidth) / 2)
        return this.frameBounds.padHeight(15).padWidth(padWidth)
    }

    @computed private get showStickyHeader(): boolean {
        const modalWidth = this.modalBounds.width - 2 * this.modalPadding
        return (modalWidth - MAX_CONTENT_WIDTH) / 2 < CLOSE_BUTTON_WIDTH + 2
    }

    @computed private get modalPadding(): number {
        return 1.5 * (this.manager.fontSize ?? 16)
    }

    @computed private get maxTabsWidth(): number {
        return Math.min(
            MAX_CONTENT_WIDTH,
            this.modalBounds.width - 2 * this.modalPadding
        )
    }

    @action.bound private onDismiss(): void {
        this.manager.activeModal = undefined
    }

    override render(): React.ReactElement {
        return (
            <Modal
                ariaLabel="Sources"
                grapherRef={this.manager.base}
                bounds={this.modalBounds}
                isHeightFixed={true}
                onDismiss={this.onDismiss}
            >
                <SourcesContent
                    columns={this.manager.inputColumnsWithSources}
                    isReady={this.manager.isReady}
                    isNarrow={this.manager.isNarrow}
                    maxTabsWidth={this.maxTabsWidth}
                    editBaseUrl={getSourcesEditBaseUrl(this.manager)}
                    isEmbeddedInADataPage={this.manager.isEmbeddedInADataPage}
                    showStickyHeader={this.showStickyHeader}
                    onDismiss={this.onDismiss}
                />
            </Modal>
        )
    }
}
