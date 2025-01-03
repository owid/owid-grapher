import cx from "classnames"

export const LightboxImage = ({
    src,
    alt,
    isLoaded,
    setIsLoaded,
    width,
    height,
}: {
    src: string
    alt: string
    isLoaded: boolean
    setIsLoaded: any
    width: number
    height: number
}) => {
    return (
        <>
            <img
                width={width}
                height={height}
                onLoad={() => {
                    setIsLoaded(true)
                }}
                className={cx({
                    "lightbox__img--is-svg": src.endsWith(".svg"),
                })}
                src={src}
                alt={alt}
                style={{ opacity: !isLoaded ? 0 : 1, transition: "opacity 1s" }}
            />
        </>
    )
}
