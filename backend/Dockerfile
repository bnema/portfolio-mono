# Backend Dockerfile
FROM --platform=$BUILDPLATFORM golang:latest AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
ARG TARGETOS
ARG TARGETARCH
RUN CGO_ENABLED=0 GOOS=$TARGETOS GOARCH=$TARGETARCH go build -o /app/bin/main .

FROM --platform=$TARGETPLATFORM scratch
WORKDIR /app
COPY --from=builder /app/bin/main .
EXPOSE 5432
CMD ["./main"]
