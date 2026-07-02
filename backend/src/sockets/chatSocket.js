const { verifyToken } = require('../utils/jwt');
const prisma = require('../prismaClient');

/**
 * Sets up Socket.IO chat: authenticates the socket via JWT, lets users
 * join a room per `interestId` (only after interest is ACCEPTED), and
 * persists every message to the database before broadcasting it.
 */
function initChatSocket(io) {
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error('Authentication required'));
      const decoded = verifyToken(token);
      socket.userId = decoded.id;
      next();
    } catch (err) {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    socket.on('join_chat', async ({ interestId }) => {
      try {
        const interest = await prisma.interest.findUnique({
          where: { id: interestId },
          include: { listing: true },
        });

        if (!interest) return socket.emit('error_message', 'Interest not found');

        const isParticipant =
          interest.tenantId === socket.userId || interest.listing.ownerId === socket.userId;
        if (!isParticipant) return socket.emit('error_message', 'Not authorized for this chat');
        if (interest.status !== 'ACCEPTED') {
          return socket.emit('error_message', 'Chat unlocks once interest is accepted');
        }

        socket.join(interestId);
        socket.emit('joined_chat', { interestId });
      } catch (err) {
        socket.emit('error_message', 'Failed to join chat');
      }
    });

    socket.on('send_message', async ({ interestId, content }) => {
      if (!content || !content.trim()) return;

      try {
        const interest = await prisma.interest.findUnique({
          where: { id: interestId },
          include: { listing: true },
        });

        if (!interest || interest.status !== 'ACCEPTED') {
          return socket.emit('error_message', 'Chat unavailable for this interest');
        }

        const isParticipant =
          interest.tenantId === socket.userId || interest.listing.ownerId === socket.userId;
        if (!isParticipant) return socket.emit('error_message', 'Not authorized to send message');

        const message = await prisma.message.create({
          data: { interestId, senderId: socket.userId, content: content.trim() },
          include: { sender: { select: { id: true, name: true } } },
        });

        io.to(interestId).emit('new_message', message);
      } catch (err) {
        console.error('[chatSocket] send_message error:', err.message);
        socket.emit('error_message', 'Failed to send message');
      }
    });

    socket.on('disconnect', () => {
      // Socket.IO automatically cleans up room membership on disconnect.
    });
  });
}

module.exports = { initChatSocket };
