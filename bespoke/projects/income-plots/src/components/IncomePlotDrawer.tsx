import { useAtom } from "jotai"
import {
    atomTimeInterval,
    atomCurrentCurrency,
    atomCountriesOrRegionsMode,
} from "../store.ts"
import { TIME_INTERVALS, TimeInterval } from "../utils/incomePlotConstants.ts"

interface IncomePlotDrawerProps {
    isOpen: boolean
    onClose: () => void
}

const TIME_INTERVAL_LABELS: Record<TimeInterval, string> = {
    daily: "Daily",
    monthly: "Monthly",
    yearly: "Yearly",
}

const CURRENCY_OPTIONS = [
    { value: "INTD" as const, label: "International-$" },
    { value: "USD" as const, label: "Local currency" },
]

const MODE_OPTIONS = [
    { value: "regions" as const, label: "Show regions" },
    { value: "countries" as const, label: "Show countries" },
]

export function IncomePlotDrawer({ isOpen, onClose }: IncomePlotDrawerProps) {
    const [timeInterval, setTimeInterval] = useAtom(atomTimeInterval)
    const [currency, setCurrency] = useAtom(atomCurrentCurrency)
    const [mode, setMode] = useAtom(atomCountriesOrRegionsMode)

    return (
        <>
            <div
                className={`income-plot-drawer-backdrop${isOpen ? " income-plot-drawer-backdrop--open" : ""}`}
                onClick={onClose}
            />
            <div
                className={`income-plot-drawer${isOpen ? " income-plot-drawer--open" : ""}`}
            >
                <div className="income-plot-drawer__header">
                    <span className="income-plot-drawer__title">Settings</span>
                    <button
                        className="income-plot-drawer__close"
                        onClick={onClose}
                        aria-label="Close settings"
                    >
                        <svg
                            width="14"
                            height="14"
                            viewBox="0 0 14 14"
                            fill="none"
                        >
                            <path
                                d="M1 1L13 13M13 1L1 13"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                            />
                        </svg>
                    </button>
                </div>

                <div className="income-plot-drawer__sections">
                    <div className="income-plot-drawer__section">
                        <div className="income-plot-drawer__section-label">
                            Time interval
                        </div>
                        <div className="income-plot-drawer__button-group">
                            {TIME_INTERVALS.map((interval) => (
                                <button
                                    key={interval}
                                    className={`income-plot-drawer__button${timeInterval === interval ? " income-plot-drawer__button--active" : ""}`}
                                    onClick={() =>
                                        setTimeInterval(interval)
                                    }
                                >
                                    {TIME_INTERVAL_LABELS[interval]}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="income-plot-drawer__divider" />

                    <div className="income-plot-drawer__section">
                        <div className="income-plot-drawer__section-label">
                            Currency
                        </div>
                        <div className="income-plot-drawer__button-group">
                            {CURRENCY_OPTIONS.map((opt) => (
                                <button
                                    key={opt.value}
                                    className={`income-plot-drawer__button${currency === opt.value ? " income-plot-drawer__button--active" : ""}`}
                                    onClick={() => setCurrency(opt.value)}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="income-plot-drawer__divider" />

                    <div className="income-plot-drawer__section">
                        <div className="income-plot-drawer__section-label">
                            Chart options
                        </div>
                        <div className="income-plot-drawer__button-group">
                            {MODE_OPTIONS.map((opt) => (
                                <button
                                    key={opt.value}
                                    className={`income-plot-drawer__button${mode === opt.value ? " income-plot-drawer__button--active" : ""}`}
                                    onClick={() => setMode(opt.value)}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </>
    )
}
