/**
 * Deterministic, rule-based compatibility score used when the LLM call
 * fails, times out, or returns malformed output. This guarantees the
 * platform always has a score available — a core requirement of the
 * assignment ("LLM failures must be handled gracefully").
 *
 * Scoring logic (0-100):
 *  - Location match: exact (case-insensitive) match contributes up to 60 points;
 *    partial substring match contributes 30 points; no match contributes 0.
 *  - Budget fit: if listing rent falls within tenant's [budgetMin, budgetMax],
 *    contributes up to 40 points, scaled by how centered the rent is in the range.
 *    If rent is outside the range, points decay based on how far outside it is.
 */
function computeFallbackScore(listing, tenantProfile) {
  const reasons = [];
  let score = 0;

  // --- Location scoring (max 60) ---
  const listingLoc = (listing.location || '').trim().toLowerCase();
  const tenantLoc = (tenantProfile.preferredLocation || '').trim().toLowerCase();

  if (listingLoc && tenantLoc) {
    if (listingLoc === tenantLoc) {
      score += 60;
      reasons.push('exact location match');
    } else if (listingLoc.includes(tenantLoc) || tenantLoc.includes(listingLoc)) {
      score += 30;
      reasons.push('partial location match');
    } else {
      reasons.push('location does not match preference');
    }
  }

  // --- Budget scoring (max 40) ---
  const { budgetMin, budgetMax } = tenantProfile;
  const rent = listing.rent;

  if (rent >= budgetMin && rent <= budgetMax) {
    const mid = (budgetMin + budgetMax) / 2;
    const halfRange = Math.max((budgetMax - budgetMin) / 2, 1);
    const distanceFromMid = Math.abs(rent - mid);
    const closeness = 1 - distanceFromMid / halfRange; // 0..1
    score += Math.round(40 * Math.max(closeness, 0.5)); // never below 20 if within range
    reasons.push('rent is within budget range');
  } else {
    const distance = rent < budgetMin ? budgetMin - rent : rent - budgetMax;
    const penaltyBase = Math.max(budgetMax - budgetMin, 1);
    const overshoot = distance / penaltyBase;
    const partial = Math.max(0, 20 - overshoot * 20);
    score += Math.round(partial);
    reasons.push('rent is outside budget range');
  }

  score = Math.max(0, Math.min(100, Math.round(score)));

  const explanation =
    `Rule-based estimate (LLM unavailable): ${reasons.join(', ')}. ` +
    `Listing rent ₹${rent}, tenant budget ₹${budgetMin}-₹${budgetMax} in "${listing.location}" ` +
    `vs preferred "${tenantProfile.preferredLocation}".`;

  return { score, explanation };
}

module.exports = { computeFallbackScore };
