export function NonRedistributableDataNotice({
    sourceLinks,
    listClassName,
}: {
    sourceLinks?: string[]
    listClassName?: string
}) {
    return (
        <>
            The data is published under a license that doesn't allow us to
            redistribute it.
            {sourceLinks && sourceLinks.length > 0 && (
                <>
                    {" "}
                    Please visit the
                    {sourceLinks.length > 1
                        ? " data publishers' websites "
                        : " data publisher's website "}
                    for more details:
                    <ul className={listClassName}>
                        {sourceLinks.map((link) => (
                            <li key={link}>
                                <a href={link} target="_blank" rel="noopener">
                                    {link}
                                </a>
                            </li>
                        ))}
                    </ul>
                </>
            )}
        </>
    )
}
