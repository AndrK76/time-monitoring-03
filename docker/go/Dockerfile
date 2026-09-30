# Builds one of the three Go backend services. The cmd directory to build is a
# build argument, so this single Dockerfile serves service-auth, service-admin
# and service-monitoring:
#
#   docker build -t mon3-auth --build-arg CMD=service-auth -f docker/go/Dockerfile .
#
# Used by docker/docker-compose.go.yml.
FROM golang:1.26-alpine AS build
WORKDIR /src

# Cache module downloads: the go.mod/go.sum change rarely.
COPY back-go/go.mod back-go/go.sum ./
RUN go mod download

# The rest of back-go (migrations are embedded, so no runtime files needed).
COPY back-go/ ./

ARG CMD=service-auth
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/service ./cmd/${CMD}

FROM alpine:3.20
RUN apk add --no-cache ca-certificates && adduser -D -u 10001 app
COPY --from=build /out/service /usr/local/bin/service
USER app
# service-monitoring serves no routes but still listens for the health on 8081.
EXPOSE 8081 8082 8083
ENTRYPOINT ["/usr/local/bin/service"]