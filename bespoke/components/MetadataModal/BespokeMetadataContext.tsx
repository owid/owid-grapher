import {
    createContext,
    useCallback,
    useContext,
    useMemo,
    useRef,
    useState,
} from "react"

import { BespokeMetadata } from "@ourworldindata/types"

import { useEmbedConfig } from "../../hooks/useEmbedConfig.js"

interface BespokeMetadataContextValue {
    /** Absent where the viz offers no modal, not only where the manifest carries none */
    metadata: BespokeMetadata | undefined
    isModalOpen: boolean
    openModal: () => void
    closeModal: () => void
    frameRef: React.RefObject<HTMLDivElement | null>
}

const BespokeMetadataContext = createContext<
    BespokeMetadataContextValue | undefined
>(undefined)

export function BespokeMetadataProvider({
    metadata,
    children,
}: {
    metadata: BespokeMetadata | undefined
    children: React.ReactNode
}): React.ReactElement {
    const { hideMetadataModal } = useEmbedConfig()
    const [isModalOpen, setIsModalOpen] = useState(false)
    const frameRef = useRef<HTMLDivElement | null>(null)

    const openModal = useCallback(() => setIsModalOpen(true), [])
    const closeModal = useCallback(() => setIsModalOpen(false), [])

    const value = useMemo(
        () => ({
            metadata: hideMetadataModal ? undefined : metadata,
            isModalOpen,
            openModal,
            closeModal,
            frameRef,
        }),
        [metadata, hideMetadataModal, isModalOpen, openModal, closeModal]
    )

    return (
        <BespokeMetadataContext.Provider value={value}>
            {children}
        </BespokeMetadataContext.Provider>
    )
}

export function useBespokeMetadataContext():
    | BespokeMetadataContextValue
    | undefined {
    return useContext(BespokeMetadataContext)
}
