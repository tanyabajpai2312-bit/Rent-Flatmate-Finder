const express = require('express');
const prisma = require('../prismaClient');
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/role');

const router = express.Router();

router.use(authenticate, requireRole('ADMIN'));

/** GET /api/admin/users — list all users */
router.get('/users', async (_req, res) => {
  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true, role: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  });
  res.json(users);
});

/** DELETE /api/admin/users/:id — remove a user */
router.delete('/users/:id', async (req, res) => {
  try {
    await prisma.user.delete({ where: { id: req.params.id } });
    res.status(204).end();
  } catch (err) {
    res.status(404).json({ error: 'User not found or has related records' });
  }
});

/** GET /api/admin/listings — list all listings */
router.get('/listings', async (_req, res) => {
  const listings = await prisma.listing.findMany({
    include: { owner: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: 'desc' },
  });
  res.json(listings);
});

/** DELETE /api/admin/listings/:id — remove a listing */
router.delete('/listings/:id', async (req, res) => {
  try {
    await prisma.listing.delete({ where: { id: req.params.id } });
    res.status(204).end();
  } catch (err) {
    res.status(404).json({ error: 'Listing not found or has related records' });
  }
});

/** GET /api/admin/activity — platform-wide activity snapshot */
router.get('/activity', async (_req, res) => {
  const [userCount, listingCount, interestCount, messageCount, filledCount] = await Promise.all([
    prisma.user.count(),
    prisma.listing.count(),
    prisma.interest.count(),
    prisma.message.count(),
    prisma.listing.count({ where: { isFilled: true } }),
  ]);

  res.json({
    totalUsers: userCount,
    totalListings: listingCount,
    totalInterests: interestCount,
    totalMessages: messageCount,
    filledListings: filledCount,
  });
});

module.exports = router;
