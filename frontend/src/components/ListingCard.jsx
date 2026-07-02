export default function ListingCard({ listing, onExpressInterest, expressed }) {
  const compat = listing.compatibility;
  const badgeClass = !compat
    ? null
    : compat.score >= 70
    ? 'badge-high'
    : compat.score >= 40
    ? 'badge-mid'
    : 'badge-low';

  return (
    <div className="card listing-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
        <h3>{listing.location}</h3>
        {compat && <span className={`badge ${badgeClass}`}>{compat.score}/100 match</span>}
      </div>
      <div className="listing-meta">
        ₹{listing.rent}/mo · {listing.roomType} · {listing.furnishingStatus.replace('_', ' ')}
      </div>
      <div className="listing-meta">
        Available from {new Date(listing.availableFrom).toLocaleDateString()}
      </div>
      {listing.owner && <div className="listing-meta">Owner: {listing.owner.name}</div>}

      {compat && (
        <div className="explanation">
          {compat.explanation}
          {compat.source === 'rule-based-fallback' && (
            <div style={{ marginTop: 4, color: 'var(--warning)' }}>⚠ AI scoring unavailable — rule-based estimate shown</div>
          )}
        </div>
      )}

      {onExpressInterest && (
        <button
          className="btn btn-primary btn-sm"
          disabled={expressed}
          onClick={() => onExpressInterest(listing.id)}
          style={{ marginTop: 8, alignSelf: 'flex-start' }}
        >
          {expressed ? 'Interest sent ✓' : 'Express Interest'}
        </button>
      )}
    </div>
  );
}
