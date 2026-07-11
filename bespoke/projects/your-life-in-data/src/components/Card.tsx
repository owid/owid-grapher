import { useEffect, useState } from "react"
import { useAtom, useAtomValue } from "jotai"
import cx from "clsx"

import type { CardRow } from "../types.js"
import {
    COUNTRIES_BY_CODE,
    ENTITY_NAME,
    HIGHLIGHTS_LABEL,
    PROFILE_TOPICS,
    TOPICS,
    WORLD_CODE,
    comparisonOptionsFor,
    countryFlag,
    countryProfileSlug,
} from "../helpers/catalog.js"
import { buildCardRows } from "../helpers/data.js"
import {
    birthYearAtom,
    compareCodeAtom,
    countryCodeAtom,
    topicAtom,
} from "../atoms.js"
import { MetricRow } from "./MetricRow.js"

interface CardRowsState {
    status: "loading" | "ready" | "error"
    rows: CardRow[]
}

function useCardRows(
    code: string,
    birthYear: number,
    topic: string,
    compCode: string
): CardRowsState {
    const [state, setState] = useState<CardRowsState>({
        status: "loading",
        rows: [],
    })
    useEffect(() => {
        let cancelled = false
        setState((s) => ({ ...s, status: "loading" }))
        buildCardRows(code, birthYear, topic, compCode)
            .then((rows) => {
                if (!cancelled) setState({ status: "ready", rows })
            })
            .catch(() => {
                if (!cancelled) setState({ status: "error", rows: [] })
            })
        return () => {
            cancelled = true
        }
    }, [code, birthYear, topic, compCode])
    return state
}

function ProfileLinks({
    topic,
    countryName,
}: {
    topic: string
    countryName: string
}) {
    const profiles = PROFILE_TOPICS[topic]
    if (!profiles) return null
    const slug = countryProfileSlug(countryName)
    return (
        <div className="your-life-in-data__explore">
            Go deeper into {countryName}:{" "}
            {profiles.map(([profileSlug, label], i) => (
                <span key={profileSlug}>
                    {i > 0 && " · "}
                    <a
                        href={`https://ourworldindata.org/profile/${profileSlug}/${slug}`}
                        target="_blank"
                        rel="noopener"
                    >
                        {label} profile →
                    </a>
                </span>
            ))}
        </div>
    )
}

/**
 * The card: topic pills, legend, one row per curated metric with then→now
 * numbers and a sparkline, and a footer linking onward into OWID.
 */
export function Card() {
    const code = useAtomValue(countryCodeAtom)
    const birthYear = useAtomValue(birthYearAtom)
    const [topic, setTopic] = useAtom(topicAtom)
    const compareCode = useAtomValue(compareCodeAtom)

    const country = COUNTRIES_BY_CODE.get(code)
    // fall back to World if the chosen comparison entity isn't available here
    const compCode = comparisonOptionsFor(code).includes(compareCode)
        ? compareCode
        : WORLD_CODE
    const { status, rows } = useCardRows(code, birthYear, topic, compCode)

    if (!country) {
        return (
            <div className="your-life-in-data__card">
                <div className="your-life-in-data__message">
                    Unknown country code: {code}
                </div>
            </div>
        )
    }

    const compName = ENTITY_NAME[compCode] ?? "World"
    // shared X-domain = the whole lifetime, so a metric covering only 2012–2021
    // occupies just that slice of the sparkline and all rows line up in time
    const domain: [number, number] = rows.length
        ? [
              Math.min(birthYear, ...rows.map((r) => r.thenYear)),
              Math.max(...rows.map((r) => r.nowYear)),
          ]
        : [birthYear, birthYear]

    return (
        <div className="your-life-in-data__card">
            <div className="your-life-in-data__card-header">
                <span className="your-life-in-data__flag">
                    {countryFlag(code)}
                </span>
                <div>
                    <div className="your-life-in-data__kicker">
                        Your life in data
                    </div>
                    <div className="your-life-in-data__card-title">
                        {country.name} · born {birthYear}
                    </div>
                </div>
            </div>
            <div className="your-life-in-data__pills">
                {[HIGHLIGHTS_LABEL, ...TOPICS].map((t) => (
                    <button
                        key={t}
                        type="button"
                        className={cx("your-life-in-data__pill", {
                            "your-life-in-data__pill--selected": t === topic,
                        })}
                        onClick={() => setTopic(t)}
                    >
                        {t}
                    </button>
                ))}
            </div>
            <div className="your-life-in-data__legend">
                <span className="your-life-in-data__swatch your-life-in-data__swatch--country" />{" "}
                {country.name}
                <span className="your-life-in-data__swatch your-life-in-data__swatch--comp" />{" "}
                {compName}
            </div>
            {status === "loading" && (
                <div className="your-life-in-data__message">
                    Fetching the data…
                </div>
            )}
            {status === "error" && (
                <div className="your-life-in-data__message">
                    Couldn’t load the data. Please try again later.
                </div>
            )}
            {status === "ready" && rows.length === 0 && (
                <div className="your-life-in-data__message">
                    No data for {country.name} born {birthYear} here.
                </div>
            )}
            {status === "ready" && rows.length > 0 && (
                <div>
                    {rows.map((row) => (
                        <MetricRow
                            key={row.meta.slug}
                            row={row}
                            domain={domain}
                            countryCode={code}
                            countryName={country.name}
                            compCode={compCode}
                            compName={compName}
                            birthYear={birthYear}
                        />
                    ))}
                </div>
            )}
            <div className="your-life-in-data__footer">
                Data: <b>Our World in Data</b> · tap a metric for its full chart
                <ProfileLinks topic={topic} countryName={country.name} />
            </div>
        </div>
    )
}
