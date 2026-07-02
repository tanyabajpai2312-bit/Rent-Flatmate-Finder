const express = require('express');
const { body, validationResult } = require('express-validator');
const prisma = require('../prismaClient');
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/role');
const { getCompatibilityScore } = require('../services/llmService');

const router = express.Router();

/**
 * POST /api/listings
 * Owner creates a new room listing.
 */
router.post(
  '/',
  authenticate,
  requireRole('OWNER'),
  [
    body('location').trim().notEmpty(),
    body('rent').isInt({ min: 0 }),
    body('availableFrom').notEmpty(),
    body('roomType').trim().notEmpty(),
    body('furnishingStatus').isIn(['UNFURNISHED', 'SEMI_FURNISHED', 'FULLY_FURNISHED']),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { location, rent, availableFrom, roomType, furnishingStatus, photos } = req.body;

    try {
      const listing = await prisma.listing.create({
        data: {
          ownerId: req.user.id,
          location,
          rent: Number(rent),
          availableFrom: new Date(availableFrom),
          roomType,
          furnishingStatus,
          photos: Array.isArray(photos) ? photos.join(',') : photos || '',
        },
      });
      res.status(201).json(listing);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to create listing' });
    }
  }
);

/**
 * GET /api/listings
 * Browse + filter listings by location and budget. If the requester is a
 * tenant with a profile, results are ranked by AI compatibility score
 * (computed once per tenant-listing pair and cached in CompatibilityScore).
 * Query params: location, minRent, maxRent
 */
router.get('/', authenticate, async (req, res) => {
  try {
    const { location, minRent, maxRent } = req.query;

    const where = { isFilled: false };
    if (location) where.location = { contains: String(location) };
    if (minRent || maxRent) {
      where.rent = {};
      if (minRent) where.rent.gte = Number(minRent);
      if (maxRent) where.rent.lte = Number(maxRent);
    }

    const listings = await prisma.listing.findMany({
      where,
      include: { owner: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: 'desc' },
    });

    // Only rank by compatibility score for tenants who have a profile.
    if (req.user.role === 'TENANT') {
      const tenantProfile = await prisma.tenantProfile.findUnique({ where: { userId: req.user.id } });

      if (tenantProfile) {
        const withScores = await Promise.all(
          listings.map(async (listing) => {
            let scoreRecord = await prisma.compatibilityScore.findUnique({
              where: { listingId_tenantId: { listingId: listing.id, tenantId: req.user.id } },
            });

            // Compute once, cache forever (per assignment: "not recomputed on every request")
            if (!scoreRecord) {
              const result = await getCompatibilityScore(listing, tenantProfile);
              scoreRecord = await prisma.compatibilityScore.create({
                data: {
                  listingId: listing.id,
                  tenantId: req.user.id,
                  score: result.score,
                  explanation: result.explanation,
                  source: result.source,
                },
              });
            }

            return { ...listing, compatibility: scoreRecord };
          })
        );

        withScores.sort((a, b) => b.compatibility.score - a.compatibility.score);
        return res.json(withScores);
      }
    }

    res.json(listings);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch listings' });
  }
});

/**
 * GET /api/listings/mine
 * Owner views their own listings.
 */
router.get('/mine', authenticate, requireRole('OWNER'), async (req, res) => {
  try {
    const listings = await prisma.listing.findMany({
      where: { ownerId: req.user.id },
      include: { interests: { include: { tenant: { select: { id: true, name: true, email: true } } } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json(listings);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch your listings' });
  }
});

/**
 * PATCH /api/listings/:id/fill
 * Owner marks a listing as filled; it is then hidden from search results.
 */
router.patch('/:id/fill', authenticate, requireRole('OWNER'), async (req, res) => {
  try {
    const listing = await prisma.listing.findUnique({ where: { id: req.params.id } });
    if (!listing || listing.ownerId !== req.user.id) {
      return res.status(404).json({ error: 'Listing not found' });
    }

    const updated = await prisma.listing.update({
      where: { id: req.params.id },
      data: { isFilled: true },
    });
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update listing' });
  }
});

module.exports = router;
