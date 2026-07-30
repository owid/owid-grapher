import { useEffect, useRef, useState } from "react"
import { useAtom, useAtomValue } from "jotai"
import cx from "clsx"

import {
    COUNTRIES_SORTED,
    compareLabel,
    comparisonOptionsFor,
} from "../helpers/catalog.js"
import { compareCodeAtom, countryCodeAtom } from "../atoms.js"

type CompareOption = { code: string; name: string; group: "region" | "country" }
const GROUP_LABEL: Record<CompareOption["group"], string> = {
    region: "Regions",
    country: "Countries",
}

/**
 * The "Compared with" picker: a typeable combobox that keeps the prominent
 * regions (World / continent / income group) pinned at the top, then lists
 * every other country below so you can compare against a specific one.
 */
export function ComparePicker() {
    const code = useAtomValue(countryCodeAtom)
    const [compareCode, setCompareCode] = useAtom(compareCodeAtom)
    const committedName = compareLabel(compareCode)

    const [text, setText] = useState(committedName)
    const [isOpen, setIsOpen] = useState(false)
    /** When open: the filter query; the arrow opens with "" to reveal everything */
    const [query, setQuery] = useState("")
    const [activeIndex, setActiveIndex] = useState(-1)
    const rootRef = useRef<HTMLDivElement>(null)
    const listRef = useRef<HTMLUListElement>(null)

    // reflect a comparison change coming from elsewhere (country reset, config)
    useEffect(() => {
        setText(committedName)
    }, [committedName])

    // the full option set for the current country: prominent regions, then
    // every other country (never the country itself)
    const allOptions: CompareOption[] = [
        ...comparisonOptionsFor(code).map(
            (c): CompareOption => ({
                code: c,
                name: compareLabel(c),
                group: "region",
            })
        ),
        ...COUNTRIES_SORTED.filter((c) => c.code !== code).map(
            (c): CompareOption => ({
                code: c.code,
                name: c.name,
                group: "country",
            })
        ),
    ]

    const q = query.trim().toLowerCase()
    const shown = q
        ? allOptions.filter((o) => o.name.toLowerCase().includes(q))
        : allOptions

    const close = (): void => {
        setIsOpen(false)
        setActiveIndex(-1)
    }
    const pick = (option: CompareOption): void => {
        setCompareCode(option.code)
        setText(option.name)
        close()
    }
    const highlight = (index: number): void => {
        if (!shown.length) return
        const next = (index + shown.length) % shown.length
        setActiveIndex(next)
        listRef.current
            ?.querySelectorAll('[role="option"]')
            [next]?.scrollIntoView({ block: "nearest" })
    }
    /** Resolve typed text to an option, case-insensitively (exact, else sole prefix) */
    const resolveTyped = (value: string): CompareOption | undefined => {
        const v = value.trim().toLowerCase()
        if (!v) return undefined
        const exact = allOptions.find((o) => o.name.toLowerCase() === v)
        if (exact) return exact
        const prefixed = allOptions.filter((o) =>
            o.name.toLowerCase().startsWith(v)
        )
        return prefixed.length === 1 ? prefixed[0] : undefined
    }

    // dismiss when clicking outside the combobox (inside the shadow root)
    useEffect(() => {
        if (!isOpen) return
        const onPointerDown = (e: Event): void => {
            const path = e.composedPath()
            if (rootRef.current && !path.includes(rootRef.current)) close()
        }
        document.addEventListener("mousedown", onPointerDown)
        return () => document.removeEventListener("mousedown", onPointerDown)
    }, [isOpen])

    const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
        if (e.key === "ArrowDown") {
            e.preventDefault()
            if (!isOpen) {
                setQuery(text)
                setIsOpen(true)
            }
            highlight(activeIndex + 1)
        } else if (e.key === "ArrowUp") {
            e.preventDefault()
            highlight(activeIndex - 1)
        } else if (e.key === "Enter") {
            if (isOpen && activeIndex >= 0 && shown[activeIndex]) {
                e.preventDefault()
                pick(shown[activeIndex])
            } else {
                const resolved = resolveTyped(text)
                if (resolved) pick(resolved)
            }
        } else if (e.key === "Escape") {
            close()
        }
    }

    // track the running option index (headers don't count) as we render groups
    let optionIndex = -1
    let lastGroup: CompareOption["group"] | null = null

    return (
        <div
            ref={rootRef}
            className={cx("your-life-in-data__combo", {
                "your-life-in-data__combo--open": isOpen,
            })}
        >
            <label
                className="your-life-in-data__control-label"
                htmlFor="your-life-in-data-compare"
            >
                Compared with
            </label>
            <div className="your-life-in-data__combo-field">
                <input
                    id="your-life-in-data-compare"
                    autoComplete="off"
                    placeholder="World, a region, or a country…"
                    role="combobox"
                    aria-autocomplete="list"
                    aria-expanded={isOpen}
                    aria-controls="your-life-in-data-compare-options"
                    value={text}
                    onChange={(e) => {
                        setText(e.target.value)
                        setQuery(e.target.value)
                        setIsOpen(true)
                        setActiveIndex(-1)
                    }}
                    onFocus={(e) => e.target.select()}
                    onBlur={() => {
                        const resolved = resolveTyped(text)
                        if (resolved) pick(resolved)
                        else setText(committedName)
                    }}
                    onKeyDown={onKeyDown}
                />
                <button
                    type="button"
                    className="your-life-in-data__combo-arrow"
                    tabIndex={-1}
                    aria-label="Show all comparison options"
                    onMouseDown={(e) => {
                        e.preventDefault() // keep focus on the input
                        if (isOpen) {
                            close()
                        } else {
                            setQuery("") // the arrow always reveals the full list
                            setIsOpen(true)
                        }
                    }}
                >
                    ▾
                </button>
            </div>
            {isOpen && (
                <ul
                    ref={listRef}
                    id="your-life-in-data-compare-options"
                    className="your-life-in-data__combo-options"
                    role="listbox"
                >
                    {shown.length === 0 && (
                        <li className="your-life-in-data__combo-empty">
                            No matching option
                        </li>
                    )}
                    {shown.flatMap((o) => {
                        optionIndex += 1
                        const i = optionIndex
                        const header =
                            o.group !== lastGroup ? (
                                <li
                                    key={`${o.group}-header`}
                                    className="your-life-in-data__combo-group"
                                    role="presentation"
                                >
                                    {GROUP_LABEL[o.group]}
                                </li>
                            ) : null
                        lastGroup = o.group
                        return [
                            header,
                            <li
                                key={o.code}
                                role="option"
                                aria-selected={o.code === compareCode}
                                className={cx({
                                    "your-life-in-data__combo-option--active":
                                        i === activeIndex,
                                })}
                                onMouseDown={(e) => {
                                    e.preventDefault()
                                    pick(o)
                                }}
                            >
                                {o.name}
                            </li>,
                        ]
                    })}
                </ul>
            )}
        </div>
    )
}
