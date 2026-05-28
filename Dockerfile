# Build stage — compile Kukicha source to a static binary
FROM golang:1.26 AS builder
WORKDIR /src

# Install kukicha compiler and brotli
RUN go install github.com/kukichalang/kukicha/cmd/kukicha@v0.25.0 && \
    apt-get update -qq && apt-get install -y --no-install-recommends brotli

# Copy source
COPY . .

# Build the site binary (multi-file directory compilation)
RUN CGO_ENABLED=0 kukicha build --no-line-directives . && mv src kukicha.org

# Pre-compress WASM files with Brotli (served via Content-Encoding: br)
RUN brotli -9 --keep static/wasm/kukicha.wasm static/wasm/stem-panic.wasm

# Warmup stage — pre-download kukicha stdlib Go dependencies into the module
# cache so playground executions don't need network access.
FROM golang:1.26 AS warmup
RUN go install github.com/kukichalang/kukicha/cmd/kukicha@v0.25.0
RUN mkdir /warm && cd /warm && \
    printf 'import "stdlib/slice"\nimport "stdlib/json"\nimport "time"\n\nfunc main()\n    nums := list of int{1, 2, 3}\n    evens := nums |> slice.Filter(n => n > 1)\n    out := json.Bytes(evens) onerr panic "{error}"\n    _ = time.Now()\n    print(out as string)\n' > warm.kuki && \
    kukicha run warm.kuki && \
    rm -rf /warm

# Runtime stage — Go toolchain + kukicha + pre-warmed module cache
# Required for server-side playground compilation via kukicha run.
FROM golang:1.26-bookworm

# Non-root user; playground go-tool invocations run as this user too
RUN groupadd -r app && useradd -r -g app -m app

RUN go install github.com/kukichalang/kukicha/cmd/kukicha@v0.25.0

# Module cache — make world-readable so the app user can use it
COPY --from=warmup /go/pkg/mod /go/pkg/mod
RUN chmod -R a+rX /go/pkg/mod

# Build cache — place in the app user's home so go tools can write new entries
COPY --from=warmup /root/.cache/go-build /home/app/.cache/go-build
RUN chown -R app:app /home/app

# Copy website binary and static assets from builder
COPY --from=builder --chown=app:app /src/kukicha.org /app/kukicha.org
COPY --from=builder --chown=app:app /src/static /app/static
WORKDIR /app

# Disable module proxy — all deps must come from the pre-warmed cache
ENV GOPROXY=off
# Point Go's cache tools to the app user's home
ENV HOME=/home/app

EXPOSE 8080
USER app
ENTRYPOINT ["/app/kukicha.org"]
