import cx from "classnames"

export function ChartHeader({
    title,
    subtitle,
    className,
}: {
    title: string
    subtitle?: React.ReactNode
    className?: string
}) {
    return (
        <div className={cx("chart-header", className)}>
            <img
                className="chart-header__logo"
                src="/owid-logo.svg"
                alt="Our World in Data logo"
                width={52}
                height={29}
            />
            <header>
                <h1 className="chart-header__title">{title}</h1>
                {subtitle && (
                    <p className="chart-header__subtitle">{subtitle}</p>
                )}
            </header>
        </div>
    )
}
