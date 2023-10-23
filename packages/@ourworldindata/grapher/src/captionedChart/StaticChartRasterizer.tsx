export const EMBEDDED_FONTS_CSS = "/fonts/embedded.css"
export const IMPORT_FONTS_REGEX = new RegExp(
    "@import url\\([^\\)]*?fonts\\.css\\)"
)

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
                .then((data) => data.text())
                .then((css) => {
                    this.embeddedFonts = css
                })
                .then(() => this.preloadFonts(canvasElt))
                .then(() => resolve(canvasElt))
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
        // for up to {retries × delay} seconds or until it verifies that all the fonts in the `faces`
        // array are ready for use
        const MAX_RETRIES = 5,
            RETRY_DELAY_MS = 100

        const faces = [
            { font: "40px Lato", offset: 17 },
            { font: "bold 40px Lato", offset: 17 },
            { font: "500 75px 'Playfair Display'", offset: 27 },
        ]

        for (let retry = 0; retry < MAX_RETRIES; retry++) {
            const ctx = canvas.getContext("2d", { alpha: false })!
            const outcomes = []

            for (const { font, offset } of faces) {
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
                ctx.imageSmoothingEnabled = false
                ctx.drawImage(testImage, 0, 0)

                // ensure that all the pixels have been painted opaque white; if the font hasn't loaded yet,
                // nothing will be drawn and the pixels will all be transparent black
                const pixels = ctx.getImageData(0, 0, 10, 10)?.data ?? [],
                    didDraw = pixels.length && pixels.every((ch) => ch === 255)
                outcomes.push(didDraw)
            }

            // check that all the fonts rendered correctly
            if (outcomes.every((result) => result)) break
            else await new Promise((res) => setTimeout(res, RETRY_DELAY_MS))
        }
    }

    async render(): Promise<{
        url: string
        blob: Blob
        svgUrl: string
        svgBlob: Blob
    }> {
        // make sure .valdate() has completed and fonts have been retrieved before proceeding
        // by blocking on the canvas promise
        const canvas = await this.canvas

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
        const ctx = canvas.getContext("2d", {
            alpha: false,
        }) as CanvasRenderingContext2D
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
