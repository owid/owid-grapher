import cx from "clsx"
import { Key, ToggleButton, ToggleButtonGroup } from "react-aria-components"
import { PeerGroupOption } from "./rankingUtils.js"

/**
 * Picks the peer group a ranking block compares against. Renders a
 * toolbar of toggle buttons (with `aria-pressed`) of which exactly one is
 * pressed: we use react-aria's "multiple" selection mode, which gives
 * toggle-button semantics and arrow-key navigation, and enforce a single
 * selection ourselves.
 */
export function PeerGroupToggle({
    options,
    selected,
    onChange,
    label = "Compare with",
    variant = "segmented",
    className,
}: {
    options: PeerGroupOption[]
    selected: string
    onChange: (name: string) => void
    label?: string
    variant?: "segmented" | "pills"
    className?: string
}) {
    if (options.length < 2) return null

    const handleSelectionChange = (keys: Set<Key>): void => {
        const newlySelected = [...keys].find((key) => key !== selected)
        if (newlySelected !== undefined) onChange(String(newlySelected))
    }

    return (
        <ToggleButtonGroup
            className={cx(
                "peer-group-toggle",
                `peer-group-toggle--${variant}`,
                className
            )}
            aria-label={label}
            selectionMode="multiple"
            selectedKeys={new Set([selected])}
            onSelectionChange={handleSelectionChange}
        >
            {options.map((option) => (
                <ToggleButton
                    key={option.name}
                    id={option.name}
                    className="peer-group-toggle__button"
                >
                    {option.name}
                </ToggleButton>
            ))}
        </ToggleButtonGroup>
    )
}
