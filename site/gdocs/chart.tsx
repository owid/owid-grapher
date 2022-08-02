import React from "react"

export default function Chart ({ d }: any) {
  let content;

  if (typeof d.value === 'string')
  content = <figure><iframe src={d.value} loading="lazy" style={{ width: '100%', height: '550px', border: '0px none' }} /></figure>;
  else {

    // handle cases where url has been wrapped in an a tag
    if (d.value.url.startsWith('<a href=')) {
        const results = /<a [^>]+>(.*?)<\/a>/g.exec(d.value.url);
        if (results && results.length > 1) {
            d.value.url = results[1];
        }
    }

    content = <figure className={d.value.position} style={{gridRow: d.value.row, gridColumn: d.value.column}}>
      <iframe src={d.value.url} loading="lazy" style={{ width: d.value.width || '100%', height: d.value.position === 'featured' ? 700 : (d.value.height || '550px'), border: '0px none' }} />
      {d.value.caption ? <figcaption>{d.value.caption}</figcaption> : null}
    </figure>
  }
  return content;
}
