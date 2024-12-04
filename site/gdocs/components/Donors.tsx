import * as React from "react"
import { groupBy } from "@ourworldindata/utils"
import { useDonors } from "../utils.js"

export default function Donors({ className }: { className?: string }) {
    const donors = useDonors()
    if (!donors) return null

    const donorsByLetter = groupBy(donors, (donor) => donor[0])
    return (
        <div className={className}>
            <div className="col-start-2 span-cols-12">
                <p className="donors-note">(Listed in alphabetical order)</p>
                {Object.entries(donorsByLetter).map(([letter, donors]) => (
                    <div key={letter}>
                        <h3 className="donors-letter">{letter}</h3>
                        <ul className="donor-list">
                            {donors.map((donor) => (
                                <li key={donor} className="donor-item">
                                    {donor}
                                </li>
                            ))}
                        </ul>
                    </div>
                ))}
            </div>
        </div>
    )
}
