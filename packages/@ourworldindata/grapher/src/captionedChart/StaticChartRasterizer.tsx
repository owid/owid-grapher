export const EMBEDDED_FONTS_CSS = "/fonts/embedded.css"
export const IMPORT_FONTS_REGEX = /@import url\([^\)]*?fonts\.css\)/

export interface GrapherExport {
    url: string
    blob: Blob
    svgUrl: string
    svgBlob: Blob
}

export class StaticChartRasterizer {
    svg: string
    width: number
    height: number
    format: string
    canvas: Promise<HTMLCanvasElement>
    density = 4 // overscaling factor for bitmap generation
    embeddedFonts = ""

    constructor(
        svg: string,
        width: number,
        height: number,
        format = "image/png"
    ) {
        this.svg = svg
        this.width = width
        this.height = height
        this.format = format

        // The canvas used for rendering is locked behind a promise that won't resolve
        // until the embedded fonts css has been loaded and the font faces initialized
        const canvasElt = document.createElement("canvas")
        this.canvas = new Promise((resolve) => {
            fetch(EMBEDDED_FONTS_CSS)
                .then(async (data) => {
                    this.embeddedFonts = await data.text()
                    await this.preloadFonts(canvasElt)
                    resolve(canvasElt)
                })
                .catch((err) => {
                    console.error(JSON.stringify(err))
                    resolve(canvasElt)
                })
        })
    }

    private async preloadFonts(canvas: HTMLCanvasElement): Promise<void> {
        // Even though the font data is inlined in the font-face definitions, the browser may not
        // have fully loaded the fonts by the time it tries to render to canvas (in which case any
        // text drawn in non-loaded fonts will simply be invisible). This method will block rendering
        // for up to ~3.25s (with decelerating polling) or until it verifies that all the fonts in
        // the `faces` array are ready for use, whichever comes first.
        const MAX_RETRIES = 10,
            RETRY_DELAY_MS = 100

        const faces = [
            { font: "40px Lato", offset: 17 },
            { font: "bold 40px Lato", offset: 17 },
            { font: "75px 'Playfair Display'", offset: 27 },
        ]

        for (let retry = 0; retry < MAX_RETRIES; retry++) {
            const ctx = canvas.getContext("2d", { alpha: false })!
            const outcomes: boolean[] = []

            for (const { font, offset } of faces) {
                // draw a bullet character that's big enough to fill the entire 10×10 canvas
                const testBlob = blobFromSVG(
                        `<svg xmlns="http://www.w3.org/2000/svg" version="1.1" style="font:${font};" width="10" height="10" viewBox="0 0 10 10">
                         <defs><style>${this.embeddedFonts}</style></defs>
                         <text x="5.0" y="${offset}.0" text-anchor="middle" fill="white">•</text>
                         </svg>`
                    ),
                    testUrl = await urlFromBlob(testBlob),
                    testImage = await imageFromUrl(testUrl)

                canvas.width = 10
                canvas.height = 10
                ctx.drawImage(testImage, 0, 0)

                // ensure that all the pixels have been painted opaque white; if the font hasn't loaded yet,
                // nothing will be drawn and the pixels will all be transparent black
                const pixels = ctx.getImageData(0, 0, 10, 10)?.data ?? [],
                    didDraw = pixels.length && pixels.every((ch) => ch === 255)
                outcomes.push(!!didDraw)
            }

            // check that all the fonts rendered correctly and exit if so
            if (outcomes.every((result) => result)) return

            // otherwise, keep retrying until we reach the time limit
            console.warn(
                "preloading fonts...",
                faces.filter((f, i) => !outcomes[i]).map((f) => f.font)
            )
            await new Promise((res) =>
                setTimeout(res, RETRY_DELAY_MS + (retry * RETRY_DELAY_MS) / 2)
            )
        }

        // if the function didn't return from within the loop, the embedded fonts aren't usable
        // so don't try to insert them when rendering the chart
        this.embeddedFonts = ""
    }

    async render(): Promise<GrapherExport> {
        // await the canvas before doing anything else to make sure .preloadFonts() has completed
        const canvas = await this.canvas,
            ctx = canvas.getContext("2d", { alpha: false })!

        // create an Image object using the chart's svg, but with embedded fonts swapped in for
        // its external `fonts.css` stylesheet
        const svgImage = await imageFromUrl(
            await urlFromBlob(
                blobFromSVG(
                    this.svg.replace(IMPORT_FONTS_REGEX, this.embeddedFonts)
                )
            )
        )

        // render the bitmap version
        const { width, height, density, format } = this
        canvas.width = width * density
        canvas.height = height * density
        ctx.imageSmoothingEnabled = false
        ctx.setTransform(density, 0, 0, density, 0, 0)
        ctx.drawImage(svgImage, 0, 0)

        // package the svg version
        const svgBlob = blobFromSVG(this.svg),
            svgUrl = await urlFromBlob(svgBlob)

        return new Promise((res, rej) => {
            try {
                const url = canvas.toDataURL(format)
                canvas.toBlob((blob) => {
                    if (blob) res({ url, blob, svgUrl, svgBlob })
                    else rej(new Error("Failed to generate bitmap blob"))
                })
            } catch (err) {
                rej(err)
            }
        })
    }
}

//
// Format converters
//

const blobFromSVG = (svg: string): Blob =>
    new Blob([svg], { type: "image/svg+xml;charset=utf-8" })

const urlFromBlob = (blob: Blob): Promise<string> =>
    new Promise((res, rej) => {
        const reader = new FileReader()
        reader.onload = (ev: any): void => {
            res(ev.target.result as string)
        }
        reader.onerror = rej
        reader.readAsDataURL(blob)
    })

const imageFromUrl = (url: string): Promise<HTMLImageElement> =>
    new Promise((res, rej) => {
        const image = new Image()
        image.onload = (): void => res(image)
        image.onerror = rej
        image.src = url
    })
