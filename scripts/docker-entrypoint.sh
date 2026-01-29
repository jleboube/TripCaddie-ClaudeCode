#!/bin/sh
set -e

echo "============================================"
echo "  Starting TripCaddie IQBE"
echo "============================================"

echo ""
echo "Synchronizing database schema..."
npx prisma@6 db push

echo ""
echo "Running database seed..."
tsx prisma/seed.ts || echo "Seed completed or skipped"

echo ""
echo "Starting application..."
exec node server.js
