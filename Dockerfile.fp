# syntax=docker/dockerfile:1

FROM node:24-alpine AS build
WORKDIR /src

COPY ui/package.json ui/package-lock.json ./ui/
RUN cd ui && npm ci

COPY ui ./ui
COPY admin-ui ./admin-ui
COPY browse-ui ./browse-ui

RUN cd ui && npm run build:admin && npm run build:browse

FROM nginx:alpine

COPY --from=build /src/admin-ui/src/main/resources/META-INF/resources/admin /usr/share/nginx/html/admin
COPY --from=build /src/browse-ui/src/main/resources/META-INF/resources/browse /usr/share/nginx/html/browse
COPY docker/frontend/nginx.conf.template /etc/nginx/templates/nginx.conf.template
COPY docker/frontend/entrypoint.sh /entrypoint.sh
RUN chmod 0755 /entrypoint.sh

ENV API_UPSTREAM=http://kkrepo:8080
EXPOSE 80
ENTRYPOINT ["/entrypoint.sh"]
