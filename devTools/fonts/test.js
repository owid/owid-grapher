const express = require("express"),
    { readFileSync } = require("fs")

const PORT = 8000

const app = express()
app.get("/", (req, res) => {
    const pangram =
        "hamburgefonstiv 0123<sub>456</sub><sup>789</sup> ←↑→↓↔↕↖↗↘↙"

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
            <p style="font-family: Lato-Hairline">Hairline ${pangram}</p>
            <p style="font-family: Lato-HairlineItalic">HairlineItalic ${pangram}</p>
            <p style="font-family: Lato-Thin">Thin ${pangram}</p>
            <p style="font-family: Lato-ThinItalic">ThinItalic ${pangram}</p>
            <p style="font-family: Lato-Light">Light ${pangram}</p>
            <p style="font-family: Lato-LightItalic">LightItalic ${pangram}</p>
            <p style="font-family: Lato-Regular">Regular ${pangram}</p>
            <p style="font-family: Lato-Italic">Italic ${pangram}</p>
            <p style="font-family: Lato-Medium">Medium ${pangram}</p>
            <p style="font-family: Lato-MediumItalic">MediumItalic ${pangram}</p>
            <p style="font-family: Lato-Semibold">Semibold ${pangram}</p>
            <p style="font-family: Lato-SemiboldItalic">SemiboldItalic ${pangram}</p>
            <p style="font-family: Lato-Bold">Bold ${pangram}</p>
            <p style="font-family: Lato-BoldItalic">BoldItalic ${pangram}</p>
            <p style="font-family: Lato-Heavy">Heavy ${pangram}</p>
            <p style="font-family: Lato-HeavyItalic">HeavyItalic ${pangram}</p>
            <p style="font-family: Lato-Black">Black ${pangram}</p>
            <p style="font-family: Lato-BlackItalic">BlackItalic ${pangram}</p>

            <h2>Playfair</h2>
            <p style="font-family: PlayfairDisplay-Regular">Regular ${pangram}</p>
            <p style="font-family: PlayfairDisplay-Italic">Italic ${pangram}</p>
            <p style="font-family: PlayfairDisplay-SemiBold, fantasy">Semibold ${pangram}</p>
            <p style="font-family: PlayfairDisplay-SemiBoldItalic, fantasy">SemiboldItalic ${pangram}</p>
            <p style="font-family: PlayfairDisplay-Bold">Bold ${pangram}</p>
            <p style="font-family: PlayfairDisplay-BoldItalic">BoldItalic ${pangram}</p>
            <p style="font-family: PlayfairDisplay-ExtraBold, fantasy">ExtraBold ${pangram}</p>
            <p style="font-family: PlayfairDisplay-ExtraBoldItalic, fantasy">ExtraBoldItalic ${pangram}</p>
            <p style="font-family: PlayfairDisplay-Black">Black ${pangram}</p>
            <p style="font-family: PlayfairDisplay-BlackItalic">BlackItalic ${pangram}</p>

            <h1>Style-based font selection</h1>
            <h2>Lato</h2>
                <div style="font-family: Lato, fantasy;">
                <p style="font-weight:100;">Hairline ${pangram}</p>
                <p style="font-weight:100; font-style:italic;">HairlineItalic ${pangram}</p>
                <p style="font-weight:200;">Thin ${pangram}</p>
                <p style="font-weight:200; font-style:italic;">ThinItalic ${pangram}</p>
                <p style="font-weight:300;">Light ${pangram}</p>
                <p style="font-weight:300; font-style:italic;">LightItalic ${pangram}</p>
                <p style="font-weight:400;">Regular ${pangram}</p>
                <p style="font-weight:400; font-style:italic;">Italic ${pangram}</p>
                <p style="font-weight:500;">Medium ${pangram}</p>
                <p style="font-weight:500; font-style:italic;">MediumItalic ${pangram}</p>
                <p style="font-weight:600;">Semibold ${pangram}</p>
                <p style="font-weight:600; font-style:italic;">SemiboldItalic ${pangram}</p>
                <p style="font-weight:700;">Bold ${pangram}</p>
                <p style="font-weight:700; font-style:italic;">BoldItalic ${pangram}</p>
                <p style="font-weight:800;">Heavy ${pangram}</p>
                <p style="font-weight:800; font-style:italic;">HeavyItalic ${pangram}</p>
                <p style="font-weight:900;">Black ${pangram}</p>
                <p style="font-weight:900; font-style:italic;">BlackItalic ${pangram}</p>
            </div>

            <h2>Playfair</h2>
            <div style="font-family: 'Playfair Display', fantasy;">
                <p style="font-weight:400;">Regular ${pangram}</p>
                <p style="font-weight:400; font-style:italic;">Italic ${pangram}</p>
                <p style="font-weight:600;">Semibold ${pangram}</p>
                <p style="font-weight:600; font-style:italic;">SemiboldItalic ${pangram}</p>
                <p style="font-weight:700;">Bold ${pangram}</p>
                <p style="font-weight:700; font-style:italic;">BoldItalic ${pangram}</p>
                <p style="font-weight:800;">ExtraBold ${pangram}</p>
                <p style="font-weight:800; font-style:italic;">ExtraBoldItalic ${pangram}</p>
                <p style="font-weight:900;">Black ${pangram}</p>
                <p style="font-weight:900; font-style:italic;">BlackItalic ${pangram}</p>
            </div>


            <h2>Playfair Smallcaps</h2>
            <div style="font-family: 'Playfair Display', fantasy;" class="small-caps">
                <p style="font-weight:400;">Regular ${pangram}</p>
                <p style="font-weight:400; font-style:italic;">Italic ${pangram}</p>
                <p style="font-weight:600;">Semibold ${pangram}</p>
                <p style="font-weight:600; font-style:italic;">SemiboldItalic ${pangram}</p>
                <p style="font-weight:700;">Bold ${pangram}</p>
                <p style="font-weight:700; font-style:italic;">BoldItalic ${pangram}</p>
                <p style="font-weight:800;">ExtraBold ${pangram}</p>
                <p style="font-weight:800; font-style:italic;">ExtraBoldItalic ${pangram}</p>
                <p style="font-weight:900;">Black ${pangram}</p>
                <p style="font-weight:900; font-style:italic;">BlackItalic ${pangram}</p>
            </div>

        </body></html>
    `)
})

const FONTS_CSS = readFileSync(".env/build/fonts.css", "utf-8")
    .replace(/\/fonts\/(Playfair)/g, "/.env/build/playfair/$1")
    .replace(/\/fonts\/(Lato)/g, "/.env/build/lato/$1")

app.get("/fonts.css", (req, res) => {
    res.contentType("text/css")
    res.send(FONTS_CSS)
})

app.use("/.env", express.static(".env"))

app.listen(PORT, () => {
    console.log(`Preview the fonts in .env/build at: http://localhost:${PORT}`)
})
