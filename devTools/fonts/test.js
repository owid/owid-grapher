const express = require("express"),
    { readFileSync } = require("fs")

const PORT = 8000

const FONTS_CSS = readFileSync(".env/build/fonts.css", "utf-8")
    .replace(/\/fonts\/(Playfair)/g, "/.env/build/playfair/$1")
    .replace(/\/fonts\/(Lato)/g, "/.env/build/lato/$1")

const FAMILIES = {
    Lato: [
        [100, "Hairline"],
        [200, "Thin"],
        [300, "Light"],
        [400, "Regular"],
        [500, "Medium"],
        [600, "Semibold"],
        [700, "Bold"],
        [800, "Heavy"],
        [900, "Black"],
    ],

    PlayfairDisplay: [
        [400, "Regular"],
        [500, "Medium"],
        [600, "SemiBold"],
        [700, "Bold"],
        [800, "ExtraBold"],
        [900, "Black"],
    ],
}

const SAMPLE_TEXT =
    "hamburgefonstiv 0123<sub>456</sub><sup>789</sup> ←↑→↓↔↕↖↗↘↙"

function pangram(family, postscriptNames = false) {
    return FAMILIES[family]
        .flatMap(([wt, weight]) => {
            const familyName = family.replace(/(.+?)([A-Z])/, "$1 $2")
            const italicWeight = (weight + "Italic").replace(/Regular/, "")
            const style = postscriptNames
                ? `font-family: ${family}-${weight};`
                : `font-family: ${familyName}; font-weight:${wt};`
            const italic = postscriptNames
                ? `font-family: ${family}-${italicWeight};`
                : `font-family: ${familyName}; font-weight:${wt}; font-style:italic;`

            return [
                `<p style="${style}">${weight} ${SAMPLE_TEXT}</p>`,
                `<p style="${italic}">${weight} Italic ${SAMPLE_TEXT}</p>`,
            ]
        })
        .join("\n")
}

const app = express()
app.get("/", (req, res) => {
    res.send(`<!DOCTYPE html><html>
        <head>
            <meta charset="utf-8"><link rel="stylesheet" href="/fonts.css" type="text/css" charset="utf-8">
            <style>
                body{ font-size:48px; }
                h1{
                    font: 64px/1.5 Helvetica, Arial, sans-serif;
                }
                h2{
                    border-top: 1px solid black;
                    font: 24px/1.5 Helvetica, Arial, sans-serif;
                }
                p{margin:0;}
                sup{
                    vertical-align:baseline;
                    font-size:inherit;
                    font-feature-settings: "sups";
                }
                sub{
                    vertical-align:baseline;
                    font-size:inherit;
                    font-feature-settings: "subs";
                }
                .serif{ font-family:"Playfair Display"; }
                .fraction{ font-feature-settings: "frac"; }
                .lining{ font-feature-settings: "lnum"; }
                .osf{ font-feature-settings: "onum"; }
                .small-caps{
                    font-feature-settings: "c2sc", "smcp";
                    letter-spacing: 0.05em;
                }
            </style>
        </head>
        <body>

            <h1>Hard-coded family names</h1>
            <h2>Lato</h2>
            ${pangram("Lato", true)}
            <h2>Playfair</h2>
            ${pangram("PlayfairDisplay", true)}

            <h1>Style-based font selection</h1>
            <h2>Lato</h2>
            ${pangram("Lato")}
            <h2>Playfair</h2>
            ${pangram("PlayfairDisplay")}

            <h2>Playfair Smallcaps</h2>
            <div class="small-caps">
                ${pangram("PlayfairDisplay")}
            </div>

        </body></html>
    `)
})

app.get("/fonts.css", (req, res) => {
    res.contentType("text/css")
    res.send(FONTS_CSS)
})

app.use("/.env", express.static(".env"))

app.listen(PORT, () => {
    console.log(`Preview the fonts in .env/build at: http://localhost:${PORT}`)
})
