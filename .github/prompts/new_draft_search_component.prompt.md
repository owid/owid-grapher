---
mode: "agent"
description: "Generate a new React Search component"
---

Your goal is to generate a new React Search draft component based on the currently selected Figma frame.

Ask for the component name if not provided.

Requirements for the component:

- Follow #site.instructions.md
- Create a tsx file for the component in the site/search directory
- Always create a companion scss file in the same directory and list it in #owid.scss
- When necessary, get algolia data from useQuery() in the component itself
- Add a skeleton for loading state
- Use #searchTypes.ts for types
- Use #searchQueries.ts
- Use #searchHooks.ts
- Use useSearchContext() in site/search/SearchContext.tsx to gain access to state and actions
- Do not focus on styling, just the structure and wiring of data from Algolia
- Wrap with a SearchAsDraft component
- Use #SearchDataResults.tsx for inspiration on how to structure the component
