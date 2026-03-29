# Build stage — compile Kukicha source to a static binary
FROM golang:1.26 AS build
WORKDIR /src

# Install kukicha compiler
RUN go install github.com/kukichalang/kukicha/cmd/kukicha@latest

# Copy source
COPY . .

# Build the site binary (multi-file directory compilation)
RUN kukicha build . && mv src kukicha.org

# Runtime stage — scratch image with just the binary + static assets
FROM scratch
COPY --from=build /src/kukicha.org /kukicha.org
COPY --from=build /src/static /static

EXPOSE 8080
ENTRYPOINT ["/kukicha.org"]
