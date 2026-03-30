# kukicha.org

The [Kukicha](https://github.com/kukichalang/kukicha) language website — built in Kukicha.

No framework, no static site generator. The entire site is `.kuki` files serving `html.Fragment` components with HTMX for interactivity.

## Run locally

```bash
kukicha build . && ./kukicha.org
# or
kukicha run main.kuki
```

Then visit http://localhost:8080.

## Structure

```
main.kuki               # Routes, server startup
components/
  layout.kuki           # Layout(), Navbar(), Footer()
  hero.kuki             # Hero(), WasmPlayer()
  cards.kuki            # Card(), CardGrid(), Feature type
  code.kuki             # CodeCompare(), SourceReveal(), SourceCode()
  tutorials.kuki        # Tutorials()
pages/
  home.kuki             # HomePage() — composes all components
static/
  wasm/kukicha.wasm     # WASM-compiled Kukicha compiler (playground)
  wasm/stem-panic.wasm  # Pre-built WASM game demo
  wasm_exec.js          # Go WASM support
  playground.js         # Playground logic (transpile + run)
```

## Playground

The playground transpiles Kukicha → Go in-browser via WASM, then executes the
generated Go by proxying to [go.dev](https://go.dev)'s compile API (`/api/compile` → `go.dev/_/compile`).

Since go.dev doesn't have Kukicha's stdlib packages, `playground.js` shims them
before sending: it replaces `github.com/kukichalang/kukicha/stdlib/*` imports
with inlined Go equivalents (see `STDLIB_SHIMS` in `playground.js`). The
"Generated Go" pane still shows the real imports — shims are only applied for
execution. A future version will run Kukicha natively in a sandboxed backend,
removing the need for shims.

## Credits

- Games powered by [Ebitengine](https://ebitengine.org/) by Hajime Hoshi
- HTML component model inspired by [templ](https://templ.guide/) by Adrian Hesketh
- CSS: [Oat CSS](https://oatcss.com/)
- Interactivity: [HTMX](https://htmx.org/)
