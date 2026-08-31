import {
    createContext,
    useCallback,
    useContext,
    useMemo,
    useRef,
    useState,
} from "react"

import { BespokeMetadataWithProvenance } from "@ourworldindata/types"

interface BespokeMetadataContextValue {
    /** Absent where the viz offers no modal, not only where the manifest carries none */
    metadata: BespokeMetadataWithProvenance | undefined
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
    isModalEnabled = true,
    children,
}: {
    metadata: BespokeMetadataWithProvenance | undefined
    isModalEnabled?: boolean
    children: React.ReactNode
}): React.ReactElement {
    const [isModalOpen, setIsModalOpen] = useState(false)
    const frameRef = useRef<HTMLDivElement | null>(null)

    const openModal = useCallback(() => setIsModalOpen(true), [])
    const closeModal = useCallback(() => setIsModalOpen(false), [])

    const value = useMemo(
        () => ({
            metadata: isModalEnabled ? metadata : undefined,
            isModalOpen,
            openModal,
            closeModal,
            frameRef,
        }),
        [metadata, isModalEnabled, isModalOpen, openModal, closeModal]
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
