import {
    BespokeMetadataHeading,
    BespokeMetadataKeyData,
    BespokeMetadataSections,
    OverlayHeader,
    SimpleMarkdownText,
} from "@ourworldindata/components"
import { BespokeMetadataWithProvenance } from "@ourworldindata/types"
import { UNSAFE_PortalProvider } from "react-aria"
import { Dialog, Modal as AriaModal, ModalOverlay } from "react-aria-components"

const MODAL_TITLE = "About this data"

interface MetadataModalProps {
    metadata: BespokeMetadataWithProvenance
    /** The positioned element the overlay covers */
    frameRef: React.RefObject<HTMLElement | null>
    isOpen: boolean
    onDismiss: () => void
}

/** Methods and sources for a bespoke viz, over the viz's own box */
export function MetadataModal({
    metadata,
    frameRef,
    isOpen,
    onDismiss,
}: MetadataModalProps): React.ReactElement {
    return (
        <UNSAFE_PortalProvider getContainer={() => frameRef.current}>
            <ModalOverlay
                className="metadata-modal"
                isOpen={isOpen}
                onOpenChange={(isOpen) => {
                    if (!isOpen) onDismiss()
                }}
                isDismissable
            >
                <AriaModal className="metadata-modal__panel">
                    <Dialog
                        className="metadata-modal__dialog"
                        aria-label={MODAL_TITLE}
                    >
                        {/* Restore the default portal container for nested
                            overlays such as dropdowns. */}
                        <UNSAFE_PortalProvider getContainer={null}>
                            <OverlayHeader
                                title={MODAL_TITLE}
                                onDismiss={onDismiss}
                            />
                            <div className="metadata-modal__body">
                                <BespokeMetadataHeading
                                    metadata={metadata}
                                    headingLevel="h3"
                                />
                                <BespokeMetadataKeyData metadata={metadata} />
                                {metadata.descriptionKey && (
                                    <div className="metadata-modal__prose">
                                        <SimpleMarkdownText
                                            text={metadata.descriptionKey}
                                        />
                                    </div>
                                )}
                                <BespokeMetadataSections metadata={metadata} />
                            </div>
                        </UNSAFE_PortalProvider>
                    </Dialog>
                </AriaModal>
            </ModalOverlay>
        </UNSAFE_PortalProvider>
    )
}
