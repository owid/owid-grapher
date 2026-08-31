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
    children,
}: {
    metadata: BespokeMetadataWithProvenance | undefined
    children: React.ReactNode
}): React.ReactElement {
    const [isModalOpen, setIsModalOpen] = useState(false)
    const frameRef = useRef<HTMLDivElement | null>(null)

    const openModal = useCallback(() => setIsModalOpen(true), [])
    const closeModal = useCallback(() => setIsModalOpen(false), [])

    const value = useMemo(
        () => ({ metadata, isModalOpen, openModal, closeModal, frameRef }),
        [metadata, isModalOpen, openModal, closeModal]
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
