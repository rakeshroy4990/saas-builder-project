# Upstream skill references

Install the full upstream skills locally if you want the complete SKILL.md bodies in your environment:

```bash
npx skills add https://github.com/anthropics/skills --skill frontend-design
npx skills add https://github.com/affaan-m/everything-claude-code --skill design-system
npx skills add https://github.com/vercel/components.build --skill building-components
npx skills add https://github.com/vuejs-ai/skills --skill vue-pinia-best-practices
npx skills add https://github.com/supercent-io/skills-template --skill performance-optimization
```

## Links

1. **frontend-design** — Bold aesthetic direction, typography, motion, avoid generic AI UI.  
   https://skills.sh/anthropics/skills/frontend-design

2. **design-system** — Generate/audit tokens, `DESIGN.md`, visual consistency scoring.  
   https://skills.sh/affaan-m/everything-claude-code/design-system

3. **building-components** — Primitives vs blocks, a11y, composition, tokens, registries.  
   https://skills.sh/vercel/components.build/building-components

4. **vue-pinia-best-practices** — Store setup, reactivity pitfalls, DevTools, SSR notes.  
   https://skills.sh/vuejs-ai/skills/vue-pinia-best-practices

5. **performance-optimization** — Measure first, bundle/images/lists, incremental fixes.  
   https://skills.sh/supercent-io/skills-template/performance-optimization

This project’s composite skill is `.cursor/skills/declarative-ui-design/SKILL.md` — it maps those ideas onto **config-driven Vue** (`configs/`, `layers.ts`, renderer, Pinia, Tailwind).
