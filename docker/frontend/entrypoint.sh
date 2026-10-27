#!/bin/sh
set -eu

: "${API_UPSTREAM:=http://kkrepo:8080}"
export API_UPSTREAM

envsubst '${API_UPSTREAM}' < /etc/nginx/templates/nginx.conf.template > /etc/nginx/nginx.conf
exec nginx -g 'daemon off;'
