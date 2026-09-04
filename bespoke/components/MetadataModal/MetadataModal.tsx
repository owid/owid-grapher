import {
    BESPOKE_METADATA_FALLBACK_TITLE,
    BespokeMetadataHeading,
    BespokeMetadataKeyData,
    BespokeMetadataSections,
    OverlayHeader,
    SimpleMarkdownText,
} from "@ourworldindata/components"
import { BespokeMetadata } from "@ourworldindata/types"
import { UNSAFE_PortalProvider } from "react-aria"
import { Dialog, Modal as AriaModal, ModalOverlay } from "react-aria-components"

interface MetadataModalProps {
    metadata: BespokeMetadata
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
                        aria-label={BESPOKE_METADATA_FALLBACK_TITLE}
                    >
                        {/* Restore the default portal container for nested
                            overlays such as dropdowns. */}
                        <UNSAFE_PortalProvider getContainer={null}>
                            <OverlayHeader
                                title={BESPOKE_METADATA_FALLBACK_TITLE}
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
