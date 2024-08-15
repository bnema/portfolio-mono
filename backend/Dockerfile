# Backend Dockerfile
FROM golang:latest AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod tidy
COPY . .
ARG TARGETARCH
RUN CGO_ENABLED=0 GOOS=linux GOARCH=$TARGETARCH go build -o /app/bin/main .

FROM scratch
WORKDIR /app
COPY --from=builder /app/bin/main .
EXPOSE 5432
CMD ["./main"]
