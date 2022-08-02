import React from "react"

export default function PullQuote ({ d, styles }: any) {
  return (<blockquote className={'pullQuote'}>
    {d.value.map((d: any) => d.value).join('\n')}
  </blockquote>)
}
