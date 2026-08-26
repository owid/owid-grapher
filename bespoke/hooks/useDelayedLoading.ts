import { useSpinDelay } from "@ourworldindata/utils"

/**
 * Hook that only returns true after a loading state has persisted for a minimum duration.
 * This prevents loading indicators from flashing for quick operations.
 */
export function useDelayedLoading(isLoading: boolean, delay = 300): boolean {
    return useSpinDelay(isLoading, { delay, ssr: false })
}
