const { PrismaClient } = require('@prisma/client');

// Reuse a single PrismaClient instance across the app (avoids exhausting
// DB connections, especially important on serverless / hot-reload dev).
const prisma = new PrismaClient();

module.exports = prisma;
