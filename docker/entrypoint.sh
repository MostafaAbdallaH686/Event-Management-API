#!/usr/bin/env bash
set -e

echo "Running Prisma migrations..."
# Retry until DB is ready
until npx prisma migrate deploy; do
  echo "Migrations failed. Retrying in 5s..."
  sleep 5
done

echo "Starting API..."
node src/index.js