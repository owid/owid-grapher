import { BuilderProps, Builder } from "@react-awesome-query-builder/antd"

export default function QueryBuilderContainer(props: BuilderProps) {
    return (
        <div className="query-builder-container" style={{ padding: "0" }}>
            <div className="query-builder qb-lite">
                <Builder {...props} />
            </div>
        </div>
    )
}
