import ReactDOM from "react-dom"
import { LightboxImage } from "./LightboxImage.js"
import { Lightbox } from "./Lightbox.js"

export const LIGHTBOX_IMAGE_CLASS = "lightbox-image"

/**
 * If the image is inside a <picture> element, get the URL of the largest
 * source image that matches the current viewport size.
 */
function getActiveSourceImgUrl(img: HTMLImageElement): string | undefined {
    if (img.closest("picture")) {
        const sources = img.closest("picture")!.querySelectorAll("source")
        const activeSource = Array.from(sources).find((s) =>
            s.media ? window.matchMedia(s.media).matches : true
        )
        const sourceSrcset = activeSource?.getAttribute("srcset")
        // split sourceSrcset into [src, width] pairs
        const srcsetPairs = sourceSrcset
            ?.split(",")
            .map((pair) => pair.trim().split(" "))
        const largestImgSrc = srcsetPairs?.at(-1)?.[0]
        return largestImgSrc
    }
    return undefined
}

const getImageDimensions = (url: string) => {
    return new Promise<{ width: number; height: number } | undefined>(
        (resolve, reject) => {
            const img = new Image()

            img.onload = () => {
                resolve({
                    width: img.naturalWidth,
                    height: img.naturalHeight,
                })
            }

            img.onerror = reject
            img.src = url
        }
    )
}

export const runLightbox = () => {
    let lightboxContainer = document.querySelector(".lightbox")
    if (!lightboxContainer) {
        lightboxContainer = document.createElement("div")
        lightboxContainer.classList.add("lightbox")
        document.body.appendChild(lightboxContainer)
    }
    Array.from(
        document.querySelectorAll<HTMLImageElement>(
            `.article-content img, .${LIGHTBOX_IMAGE_CLASS}`
        )
    ).forEach((img) => {
        if (img.closest("[data-no-lightbox]")) return

        img.classList.add("lightbox-enabled")
        img.addEventListener("click", async () => {
            // An attribute placed by our WP image formatter: the URL of the original image without any WxH suffix
            const highResSrc = img.getAttribute("data-high-res-src")
            // If the image is a Gdoc Image with a smallFilename, get the source that is currently active
            const activeSourceImgUrl = getActiveSourceImgUrl(img)
            const imgFilename =
                img.getAttribute("data-filename") || "owid-image"

            const imgSrc = highResSrc
                ? // getAttribute doesn't automatically URI encode values, img.src does
                  encodeURI(highResSrc)
                : activeSourceImgUrl
                  ? activeSourceImgUrl
                  : img.src

            // load image in advance and get naturalHeight and naturalWidth
            // if the image doesn't load, use the dimensions of the img element
            const dimensions = await getImageDimensions(imgSrc)
            const width = dimensions?.width || img.width
            const height = dimensions?.height || img.height

            const imgAlt = img.alt
            if (imgSrc) {
                ReactDOM.render(
                    <Lightbox
                        imgSrc={imgSrc}
                        imgFilename={imgFilename}
                        containerNode={lightboxContainer}
                    >
                        {(isLoaded: boolean, setIsLoaded: any) => (
                            <LightboxImage
                                width={width}
                                height={height}
                                src={imgSrc}
                                alt={imgAlt}
                                isLoaded={isLoaded}
                                setIsLoaded={setIsLoaded}
                            />
                        )}
                    </Lightbox>,
                    lightboxContainer
                )
            }
        })
    })
}
