import React from "react"

export default function PullQuote ({ d, styles }: any) {
  console.log(d);
  return (<blockquote className={'pullQuote'}>
    {d.value.map((d: any) => d.value).join('\n')}
  </blockquote>)
}
