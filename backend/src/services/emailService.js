const nodemailer = require('nodemailer');

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;

  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  return transporter;
}

/**
 * Sends an email. Failures are logged but never thrown — a notification
 * problem should never break the core interest/accept/decline flow.
 */
async function sendEmail({ to, subject, html }) {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.warn(`[emailService] SMTP not configured. Skipped email to ${to}: "${subject}"`);
    return { skipped: true };
  }

  try {
    const info = await getTransporter().sendMail({
      from: process.env.EMAIL_FROM || process.env.SMTP_USER,
      to,
      subject,
      html,
    });
    return { sent: true, id: info.messageId };
  } catch (err) {
    console.error('[emailService] Failed to send email:', err.message);
    return { sent: false, error: err.message };
  }
}

function notifyOwnerHighCompatibilityInterest({ ownerEmail, tenantName, listingLocation, score }) {
  return sendEmail({
    to: ownerEmail,
    subject: `High compatibility match (${score}/100) for your listing in ${listingLocation}`,
    html: `<p>Good news! <strong>${tenantName}</strong> has expressed interest in your listing in
      <strong>${listingLocation}</strong> with a compatibility score of <strong>${score}/100</strong>.</p>
      <p>Log in to Rent & Flatmate Finder to review and respond.</p>`,
  });
}

function notifyTenantInterestDecision({ tenantEmail, listingLocation, status }) {
  const friendly = status === 'ACCEPTED' ? 'accepted' : 'declined';
  return sendEmail({
    to: tenantEmail,
    subject: `Your interest request was ${friendly}`,
    html: `<p>The owner has <strong>${friendly}</strong> your interest request for the listing in
      <strong>${listingLocation}</strong>.</p>
      ${status === 'ACCEPTED' ? '<p>You can now chat with the owner in real time on the platform.</p>' : ''}`,
  });
}

module.exports = {
  sendEmail,
  notifyOwnerHighCompatibilityInterest,
  notifyTenantInterestDecision,
};
