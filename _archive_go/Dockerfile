FROM golang:1.23-alpine AS builder
RUN apk add --no-cache git
WORKDIR /app
COPY . .
RUN go mod tidy && go mod download
RUN CGO_ENABLED=0 go build -ldflags="-s -w" -o /morphe ./cmd/morphe

FROM alpine:3.20
RUN apk add --no-cache ca-certificates tzdata
COPY --from=builder /morphe /usr/local/bin/morphe
EXPOSE 8080
ENTRYPOINT ["morphe"]
