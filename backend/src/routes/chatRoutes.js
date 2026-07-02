const express = require('express');
const prisma = require('../prismaClient');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

/**
 * GET /api/chat/:interestId/messages
 * Returns persisted chat history for an ACCEPTED interest. Only the
 * tenant or the listing owner involved may access it.
 */
router.get('/:interestId/messages', authenticate, async (req, res) => {
  try {
    const interest = await prisma.interest.findUnique({
      where: { id: req.params.interestId },
      include: { listing: true },
    });

    if (!interest) return res.status(404).json({ error: 'Interest not found' });

    const isParticipant =
      interest.tenantId === req.user.id || interest.listing.ownerId === req.user.id;
    if (!isParticipant) return res.status(403).json({ error: 'Not authorized to view this chat' });

    if (interest.status !== 'ACCEPTED') {
      return res.status(403).json({ error: 'Chat is only available once interest is accepted' });
    }

    const messages = await prisma.message.findMany({
      where: { interestId: req.params.interestId },
      include: { sender: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'asc' },
    });

    res.json(messages);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

module.exports = router;
