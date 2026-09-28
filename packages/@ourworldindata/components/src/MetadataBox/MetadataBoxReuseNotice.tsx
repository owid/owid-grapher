/** The closing notice of a metadata box, asking readers to cite data providers */
export function MetadataBoxReuseNotice({
    children,
}: {
    /** A licence line, rendered as a second paragraph */
    children?: React.ReactNode
}): React.ReactElement {
    return (
        <>
            <p>
                All data produced by third-party providers and made available by
                Our World in Data are subject to the license terms from the
                original providers. Our work would not be possible without the
                data providers we rely on, so we ask you to always cite them
                appropriately. This is crucial to allow data providers to
                continue doing their work, enhancing, maintaining and updating
                valuable data.
            </p>
            {children && <p>{children}</p>}
        </>
    )
}
