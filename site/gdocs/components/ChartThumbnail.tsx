import Image, { ImageParentContainer } from "./Image.js"

export default function ChartThumbnail({
    image,
    containerType,
}: {
    image: string
    containerType: ImageParentContainer
}) {
    return (
        <>
            <Image
                filename={image}
                containerType={containerType}
                shouldLightbox={false}
                shouldHideDownloadButton={true}
            />
            <div className="chart-thumbnail__overlay">
                <div className="chart-thumbnail__cta">Click to explore</div>
            </div>
        </>
    )
}
