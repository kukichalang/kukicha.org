# Build stage — compile Kukicha source to a static binary
FROM golang:1.26 AS builder
WORKDIR /src

# Install kukicha compiler and brotli
RUN go install github.com/kukichalang/kukicha/cmd/kukicha@v0.1.0 && \
    apt-get update -qq && apt-get install -y --no-install-recommends brotli

# Copy source
COPY . .

# Build the site binary (multi-file directory compilation)
RUN CGO_ENABLED=0 kukicha build --no-line-directives . && mv src kukicha.org

# Pre-compress WASM files with Brotli (served via Content-Encoding: br)
RUN brotli -9 --keep static/wasm/kukicha.wasm static/wasm/stem-panic.wasm

# Runtime stage — scratch image with just the binary + static assets
FROM scratch
COPY --from=builder /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/
COPY --from=builder /src/kukicha.org /kukicha.org
COPY --from=builder /src/static /static

EXPOSE 8080
ENTRYPOINT ["/kukicha.org"]
