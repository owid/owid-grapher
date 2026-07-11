import { useEffect, useRef, useState } from "react"
import { useAtom } from "jotai"
import cx from "clsx"

import { COUNTRIES_BY_CODE, COUNTRIES_SORTED } from "../helpers/catalog.js"
import { countryCodeAtom } from "../atoms.js"

const NAME_TO_CODE = new Map(COUNTRIES_SORTED.map((c) => [c.name, c.code]))

/**
 * A typeable country picker: type to filter, or click the arrow to browse the
 * full list. (A custom combobox, since a native <datalist> shows no arrow and
 * only surfaces options mid-type.)
 */
export function CountryCombobox() {
    const [code, setCode] = useAtom(countryCodeAtom)
    const committedName = COUNTRIES_BY_CODE.get(code)?.name ?? ""

    const [text, setText] = useState(committedName)
    const [isOpen, setIsOpen] = useState(false)
    /** When open: the filter query; the arrow opens with "" to reveal everything */
    const [query, setQuery] = useState("")
    const [activeIndex, setActiveIndex] = useState(-1)
    const rootRef = useRef<HTMLDivElement>(null)
    const listRef = useRef<HTMLUListElement>(null)

    // reflect a country change coming from elsewhere (another variant, config)
    useEffect(() => {
        setText(committedName)
    }, [committedName])

    const shown = query.trim()
        ? COUNTRIES_SORTED.filter((c) =>
              c.name.toLowerCase().includes(query.trim().toLowerCase())
          )
        : COUNTRIES_SORTED

    const close = (): void => {
        setIsOpen(false)
        setActiveIndex(-1)
    }
    const pick = (name: string): void => {
        const picked = NAME_TO_CODE.get(name)
        if (picked) setCode(picked)
        setText(name)
        close()
    }
    const highlight = (index: number): void => {
        if (!shown.length) return
        const next = (index + shown.length) % shown.length
        setActiveIndex(next)
        listRef.current?.children[next]?.scrollIntoView({ block: "nearest" })
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
                pick(shown[activeIndex].name)
            } else if (NAME_TO_CODE.has(text.trim())) {
                pick(text.trim())
            }
        } else if (e.key === "Escape") {
            close()
        }
    }

    return (
        <div
            ref={rootRef}
            className={cx("your-life-in-data__combo", {
                "your-life-in-data__combo--open": isOpen,
            })}
        >
            <label
                className="your-life-in-data__control-label"
                htmlFor="your-life-in-data-country"
            >
                Where were you born?
            </label>
            <div className="your-life-in-data__combo-field">
                <input
                    id="your-life-in-data-country"
                    autoComplete="off"
                    placeholder="Start typing a country…"
                    role="combobox"
                    aria-autocomplete="list"
                    aria-expanded={isOpen}
                    aria-controls="your-life-in-data-country-options"
                    value={text}
                    onChange={(e) => {
                        setText(e.target.value)
                        setQuery(e.target.value)
                        setIsOpen(true)
                        setActiveIndex(-1)
                    }}
                    onBlur={() => {
                        if (NAME_TO_CODE.has(text.trim())) pick(text.trim())
                        else setText(committedName)
                    }}
                    onKeyDown={onKeyDown}
                />
                <button
                    type="button"
                    className="your-life-in-data__combo-arrow"
                    tabIndex={-1}
                    aria-label="Show all countries"
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
                    id="your-life-in-data-country-options"
                    className="your-life-in-data__combo-options"
                    role="listbox"
                >
                    {shown.length === 0 && (
                        <li className="your-life-in-data__combo-empty">
                            No matching country
                        </li>
                    )}
                    {shown.map((c, i) => (
                        <li
                            key={c.code}
                            role="option"
                            aria-selected={c.code === code}
                            className={cx({
                                "your-life-in-data__combo-option--active":
                                    i === activeIndex,
                            })}
                            onMouseDown={(e) => {
                                e.preventDefault()
                                pick(c.name)
                            }}
                        >
                            {c.name}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    )
}
