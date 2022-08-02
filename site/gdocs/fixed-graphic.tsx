
import React from "react"

import ArticleElement from "./article-element"

export default function FixedSection ({ d, styles }: any) {
  const position = d.value.find((_d: any) => _d.type === 'position');
  return (
    <section className={`fixedSection ${position ? position.value : ''}`}>
      <div className={'fixedSectionGraphic'}>
        {d.value.filter((_d: any) => (!['text', 'position'].includes(_d.type) || _d.value.startsWith('<img src='))).map((_d: any, j: any) => {
          return <ArticleElement key={j} d={_d} styles={styles} />
        })}
      </div>
      <div className={'fixedSectionContent'}>
        {d.value.filter((_d: any) => _d.type === 'text' && !_d.value.startsWith('<img src=')).map((_d: any, j: any) => {
          return <ArticleElement key={j} d={_d} styles={styles} />
        })}
      </div>
    </section>
  )
}
