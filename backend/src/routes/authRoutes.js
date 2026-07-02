const express = require('express');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const prisma = require('../prismaClient');
const { signToken } = require('../utils/jwt');

const router = express.Router();

/**
 * POST /api/auth/register
 * Registers a TENANT, OWNER, or ADMIN.
 * Tenants must also supply profile fields (preferredLocation, budgetMin,
 * budgetMax, moveInDate) which are stored as their TenantProfile.
 */
router.post(
  '/register',
  [
    body('name').trim().notEmpty(),
    body('email').isEmail(),
    body('password').isLength({ min: 6 }),
    body('role').isIn(['TENANT', 'OWNER', 'ADMIN']),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { name, email, password, role, preferredLocation, budgetMin, budgetMax, moveInDate } = req.body;

    try {
      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing) return res.status(409).json({ error: 'Email already registered' });

      const passwordHash = await bcrypt.hash(password, 10);

      const user = await prisma.user.create({
        data: { name, email, passwordHash, role },
      });

      if (role === 'TENANT') {
        if (!preferredLocation || budgetMin == null || budgetMax == null || !moveInDate) {
          return res.status(400).json({
            error: 'Tenant registration requires preferredLocation, budgetMin, budgetMax, moveInDate',
          });
        }
        await prisma.tenantProfile.create({
          data: {
            userId: user.id,
            preferredLocation,
            budgetMin: Number(budgetMin),
            budgetMax: Number(budgetMax),
            moveInDate: new Date(moveInDate),
          },
        });
      }

      const token = signToken({ id: user.id, role: user.role });
      res.status(201).json({
        token,
        user: { id: user.id, name: user.name, email: user.email, role: user.role },
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Registration failed' });
    }
  }
);

router.post(
  '/login',
  [body('email').isEmail(), body('password').notEmpty()],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { email, password } = req.body;

    try {
      const user = await prisma.user.findUnique({ where: { email } });
      if (!user) return res.status(401).json({ error: 'Invalid credentials' });

      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

      const token = signToken({ id: user.id, role: user.role });
      res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Login failed' });
    }
  }
);

module.exports = router;
