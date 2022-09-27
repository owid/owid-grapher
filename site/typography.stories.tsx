import React, { useEffect, useState } from "react"
import webfontloader from "webfontloader"

export default {
    title: "Typography",
}

const typographyClasses = [
    "display-1-semibold",
    "display-2-semibold",
    "h1-semibold",
    "h1-bold-italic",
    "h2-bold",
    "h3-bold",
    "h4-semibold",
    "subtitle-1",
    "overline-black-caps",
    "body-1-regular",
    "body-1-regular-underlined",
    "body-1-regular-superscript",
    "body-2-regular",
    "body-2-regular-underlined",
    "body-2-regular-superscript",
    "body-2-semibold",
    "body-3-medium",
    "body-3-medium-underlined",
    "body-3-medium-italic",
    "body-3-medium-italic-underlined",
]

const makeTitleCaseAndStripDashes = (str: string) =>
    str
        .split("-")
        .map((str) => str[0].toUpperCase() + str.substring(1))
        .join(" ")

export const Default = (): JSX.Element => {
    useEffect(() => {
        webfontloader.load({
            google: {
                families: ["Playfair Display", "Lato"],
            },
        })
    })
    const [className, setClassName] = useState(typographyClasses[9])
    return (
        <div>
            <p className={className} contentEditable>
                This text can be edited and the quick brown fox jumps over the
                lazy dog
            </p>
            <label htmlFor="typography-select" style={{ display: "block" }}>
                Select a style to demo
            </label>
            <select
                id="typography-select"
                name="typography select"
                value={className}
                onChange={(e) => setClassName(e.target.value)}
            >
                {typographyClasses.map((typographyClass) => (
                    <option value={typographyClass} key={typographyClass}>
                        {typographyClass}
                    </option>
                ))}
            </select>
            <hr style={{ marginTop: 48 }} />
            {typographyClasses.map((className) => (
                <p key={className} className={className}>
                    {makeTitleCaseAndStripDashes(className)}
                </p>
            ))}
        </div>
    )
}
