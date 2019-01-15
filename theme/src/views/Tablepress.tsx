import * as React from 'react'

export default function Tablepress(props: { data: string[][] }) {
    const {data} = props
    return <table className="tablepress">
        <thead>
            <tr>
                {data[0].map((title, i) => <th key={i} dangerouslySetInnerHTML={{__html: title}}/>)}
            </tr>
        </thead>
        <tbody className="row-hover">
            {data.slice(1).map((row, i) => 
                <tr key={i}>
                    {row.map((value, j) => <td key={j} dangerouslySetInnerHTML={{__html: value}}/>)}
                </tr>
            )}
        </tbody>
    </table>
}