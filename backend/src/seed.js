/**
 * Seeds the database with a demo admin, owner, tenant, and a couple of
 * listings — useful for quickly demoing the app to evaluators.
 * Run with: npm run seed
 */
require('dotenv').config();
const bcrypt = require('bcryptjs');
const prisma = require('./prismaClient');

async function main() {
  const passwordHash = await bcrypt.hash('Password123!', 10);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@demo.com' },
    update: {},
    create: { name: 'Admin User', email: 'admin@demo.com', passwordHash, role: 'ADMIN' },
  });

  const owner = await prisma.user.upsert({
    where: { email: 'owner@demo.com' },
    update: {},
    create: { name: 'Priya Owner', email: 'owner@demo.com', passwordHash, role: 'OWNER' },
  });

  const tenantUser = await prisma.user.upsert({
    where: { email: 'tenant@demo.com' },
    update: {},
    create: { name: 'Rahul Tenant', email: 'tenant@demo.com', passwordHash, role: 'TENANT' },
  });

  await prisma.tenantProfile.upsert({
    where: { userId: tenantUser.id },
    update: {},
    create: {
      userId: tenantUser.id,
      preferredLocation: 'Koramangala',
      budgetMin: 8000,
      budgetMax: 15000,
      moveInDate: new Date('2026-08-01'),
    },
  });

  // Seed demo listings idempotently: only create each one if a listing with
  // the same owner + location doesn't already exist. This makes `npm run seed`
  // safe to run any number of times without piling up duplicate listings.
  const demoListings = [
    {
      location: 'Koramangala',
      rent: 12000,
      availableFrom: new Date('2026-07-15'),
      roomType: 'Single',
      furnishingStatus: 'FULLY_FURNISHED',
      photos: '',
    },
    {
      location: 'Indiranagar',
      rent: 25000,
      availableFrom: new Date('2026-08-01'),
      roomType: 'Shared',
      furnishingStatus: 'SEMI_FURNISHED',
      photos: '',
    },
  ];

  for (const listingData of demoListings) {
    const existing = await prisma.listing.findFirst({
      where: { ownerId: owner.id, location: listingData.location },
    });

    if (!existing) {
      await prisma.listing.create({
        data: { ownerId: owner.id, ...listingData },
      });
    }
  }

  console.log('Seed complete:');
  console.log('  Admin  -> admin@demo.com / Password123!');
  console.log('  Owner  -> owner@demo.com / Password123!');
  console.log('  Tenant -> tenant@demo.com / Password123!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
