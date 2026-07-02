const express = require('express');
const prisma = require('../prismaClient');
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/role');
const {
  notifyOwnerHighCompatibilityInterest,
  notifyTenantInterestDecision,
} = require('../services/emailService');

const router = express.Router();

const HIGH_THRESHOLD = Number(process.env.HIGH_COMPATIBILITY_THRESHOLD || 80);

/**
 * POST /api/interests
 * Tenant sends interest in a listing. If the tenant's cached compatibility
 * score for this listing is above HIGH_COMPATIBILITY_THRESHOLD, the owner
 * is emailed immediately.
 */
router.post('/', authenticate, requireRole('TENANT'), async (req, res) => {
  const { listingId } = req.body;
  if (!listingId) return res.status(400).json({ error: 'listingId is required' });

  try {
    const listing = await prisma.listing.findUnique({
      where: { id: listingId },
      include: { owner: true },
    });
    if (!listing) return res.status(404).json({ error: 'Listing not found' });
    if (listing.isFilled) return res.status(400).json({ error: 'Listing is already filled' });

    const interest = await prisma.interest.create({
      data: { tenantId: req.user.id, listingId },
    });

    const scoreRecord = await prisma.compatibilityScore.findUnique({
      where: { listingId_tenantId: { listingId, tenantId: req.user.id } },
    });

    if (scoreRecord && scoreRecord.score >= HIGH_THRESHOLD) {
      await notifyOwnerHighCompatibilityInterest({
        ownerEmail: listing.owner.email,
        tenantName: req.user.name,
        listingLocation: listing.location,
        score: scoreRecord.score,
      });
    }

    res.status(201).json(interest);
  } catch (err) {
    if (err.code === 'P2002') {
      return res.status(409).json({ error: 'You have already expressed interest in this listing' });
    }
    console.error(err);
    res.status(500).json({ error: 'Failed to send interest' });
  }
});

/**
 * PATCH /api/interests/:id
 * Owner accepts or declines an interest request. Tenant is emailed either way.
 */
router.patch('/:id', authenticate, requireRole('OWNER'), async (req, res) => {
  const { status } = req.body; // 'ACCEPTED' | 'DECLINED'
  if (!['ACCEPTED', 'DECLINED'].includes(status)) {
    return res.status(400).json({ error: 'status must be ACCEPTED or DECLINED' });
  }

  try {
    const interest = await prisma.interest.findUnique({
      where: { id: req.params.id },
      include: { listing: true, tenant: true },
    });

    if (!interest || interest.listing.ownerId !== req.user.id) {
      return res.status(404).json({ error: 'Interest request not found' });
    }

    const updated = await prisma.interest.update({
      where: { id: req.params.id },
      data: { status },
    });

    await notifyTenantInterestDecision({
      tenantEmail: interest.tenant.email,
      listingLocation: interest.listing.location,
      status,
    });

    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update interest' });
  }
});

/**
 * GET /api/interests/mine
 * Tenant views their sent interest requests with status.
 */
router.get('/mine', authenticate, requireRole('TENANT'), async (req, res) => {
  try {
    const interests = await prisma.interest.findMany({
      where: { tenantId: req.user.id },
      include: { listing: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json(interests);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch interests' });
  }
});

module.exports = router;
