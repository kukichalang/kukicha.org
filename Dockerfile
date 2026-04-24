# Build stage — compile Kukicha source to a static binary
FROM golang:1.26 AS builder
WORKDIR /src

# Install kukicha compiler and brotli
RUN go install github.com/kukichalang/kukicha/cmd/kukicha@v0.6.5 && \
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
RUN go install github.com/kukichalang/kukicha/cmd/kukicha@v0.6.5
RUN mkdir /warm && cd /warm && \
    printf 'import "stdlib/slice"\nimport "stdlib/json"\nimport "time"\n\nfunc main()\n    nums := list of int{1, 2, 3}\n    evens := nums |> slice.Filter(n => n > 1)\n    out := json.Marshal(evens) onerr panic "{error}"\n    _ = time.Now()\n    print(out as string)\n' > warm.kuki && \
    kukicha run warm.kuki && \
    rm -rf /warm

# Runtime stage — Go toolchain + kukicha + pre-warmed module cache
# Required for server-side playground compilation via kukicha run.
FROM golang:1.26-bookworm
RUN go install github.com/kukichalang/kukicha/cmd/kukicha@v0.6.5

# Copy pre-warmed Go module and build caches from warmup stage
COPY --from=warmup /go/pkg/mod /go/pkg/mod
COPY --from=warmup /root/.cache/go-build /root/.cache/go-build

# Copy website binary and static assets from builder
COPY --from=builder /src/kukicha.org /app/kukicha.org
COPY --from=builder /src/static /app/static
WORKDIR /app

# Disable module proxy — all deps must come from the pre-warmed cache
ENV GOPROXY=off

EXPOSE 8080
ENTRYPOINT ["/app/kukicha.org"]
