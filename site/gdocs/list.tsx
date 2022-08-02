import React from "react"

export default function List({ d }: any) {
    return (
        <ul className={"list"}>
            {d.value.map((_d: any, i: any) => {
                return <li key={i}>{_d}</li>
            })}
        </ul>
    )
}
