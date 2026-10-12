# Site

The React code that renders our public pages on ourworldindata.org. It is shared
by the baker (which bakes the static site) and the admin (which uses it for
previews).

Where to read more:

- **Content pipeline** — content is authored in Google Docs using ArchieML and
  ingested by `db/model/Gdoc/`. See
  [gdocs-cms-pipeline.md](../docs/agent-guidelines/gdocs-cms-pipeline.md),
  [gdocs-class-hierarchy.md](../docs/agent-guidelines/gdocs-class-hierarchy.md)
  and [gdocs-attachments.md](../docs/agent-guidelines/gdocs-attachments.md).
- **ArchieML syntax** — [the gdocs writing
  reference](../docs/gdocs-writing-reference.md) documents every block authors
  can use, including images and charts.
- **Search** — [site/search/README.md](./search/README.md).
- **CSS conventions** — the "Code style" section of [CLAUDE.md](../CLAUDE.md).
  Shared variables, mixins, colors and typography live in
  `packages/@ourworldindata/components/src/styles/`; the grid is in
  [css/grid.scss](./css/grid.scss).
- **Images** — uploaded via `/admin/images`, referenced from a gdoc by filename,
  and rendered by [gdocs/components/Image.tsx](./gdocs/components/Image.tsx),
  which reads dimensions and alt text from React context.
- **Local setup** — `.env.example-full` lists and explains the keys that site
  features need, notably `CLOUDFLARE_IMAGES_*` and `ALGOLIA_*`.
