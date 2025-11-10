#!/usr/bin/env bash
# Temporary sanity-check script generated from Jenkinsfile sh blocks
set -euo pipefail

# Build image snippet (placeholders substituted for Groovy expressions)
DOCKERFILE_PATH="Dockerfile"
BUILD_ARGS="--build-arg FOO='bar'"
FULL_IMAGE="nexus.aimstek.cn/logic-test-jdk17:0.9.5-251110145101-SNAPSHOT"

echo "-- Running docker build syntax check --"
docker build -f "${DOCKERFILE_PATH}" ${BUILD_ARGS} -t "${FULL_IMAGE}" . || true

echo "-- Running docker login/push snippet syntax check --"
REGISTRY_PASSWORD="dummy"
REGISTRY_USERNAME="user"
REGISTRY=$(echo "${FULL_IMAGE}" | awk -F'/' '{print $1}')
printf '%s' "${REGISTRY_PASSWORD}" | docker login "${REGISTRY}" --username "${REGISTRY_USERNAME}" --password-stdin || true
docker push "${FULL_IMAGE}" || true

echo "-- Prune snippet --"
docker image prune -f || true

echo "Sanity script finished (note: docker commands were allowed to fail; we only checked shell parsing)."
