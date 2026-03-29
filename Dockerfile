# Build stage — compile Kukicha source to a static binary
FROM golang:1.26 AS builder
WORKDIR /src

# Install kukicha compiler
RUN go install github.com/kukichalang/kukicha/cmd/kukicha@latest

# Copy source
COPY . .

# Build the site binary (multi-file directory compilation)
RUN CGO_ENABLED=0 kukicha build . && mv src kukicha.org

# Runtime stage — scratch image with just the binary + static assets
FROM scratch
COPY --from=builder /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/
COPY --from=builder /src/kukicha.org /kukicha.org
COPY --from=builder /src/static /static

EXPOSE 8080
ENTRYPOINT ["/kukicha.org"]
