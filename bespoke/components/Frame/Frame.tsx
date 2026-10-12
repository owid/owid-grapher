import cx from "clsx"

import { useBespokeMetadataContext } from "../MetadataModal/BespokeMetadataContext.js"
import { MetadataModal } from "../MetadataModal/MetadataModal.js"

export function Frame({
    children,
    className,
}: {
    children: React.ReactNode
    className?: string
}): React.ReactElement {
    const metadataContext = useBespokeMetadataContext()

    return (
        <div ref={metadataContext?.frameRef} className={cx("frame", className)}>
            {children}
            {metadataContext?.metadata && (
                <MetadataModal
                    metadata={metadataContext.metadata}
                    frameRef={metadataContext.frameRef}
                    isOpen={metadataContext.isModalOpen}
                    onDismiss={metadataContext.closeModal}
                />
            )}
        </div>
    )
}
