import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/axios';

const emptyForm = {
  location: '',
  rent: '',
  availableFrom: '',
  roomType: '',
  furnishingStatus: 'UNFURNISHED',
};

export default function OwnerDashboard() {
  const [listings, setListings] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadListings = async () => {
    const { data } = await api.get('/api/listings/mine');
    setListings(data);
  };

  useEffect(() => {
    loadListings();
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await api.post('/api/listings', form);
      setForm(emptyForm);
      loadListings();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create listing');
    } finally {
      setSubmitting(false);
    }
  };

  const handleMarkFilled = async (id) => {
    await api.patch(`/api/listings/${id}/fill`);
    loadListings();
  };

  const handleDecision = async (interestId, status) => {
    await api.patch(`/api/interests/${interestId}`, { status });
    loadListings();
  };

  return (
    <div className="container">
      <h2>Manage your listings</h2>

      <div className="card" style={{ marginBottom: 28 }}>
        <h3 style={{ marginTop: 0 }}>Post a new room</h3>
        <form onSubmit={handleCreate}>
          <div className="grid grid-2">
            <div className="form-group">
              <label>Location</label>
              <input required value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Rent (₹/month)</label>
              <input type="number" required value={form.rent} onChange={(e) => setForm({ ...form, rent: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Available from</label>
              <input type="date" required value={form.availableFrom} onChange={(e) => setForm({ ...form, availableFrom: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Room type</label>
              <input required placeholder="e.g. Single / Shared" value={form.roomType} onChange={(e) => setForm({ ...form, roomType: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Furnishing status</label>
              <select value={form.furnishingStatus} onChange={(e) => setForm({ ...form, furnishingStatus: e.target.value })}>
                <option value="UNFURNISHED">Unfurnished</option>
                <option value="SEMI_FURNISHED">Semi-furnished</option>
                <option value="FULLY_FURNISHED">Fully furnished</option>
              </select>
            </div>
          </div>
          {error && <div className="error-text">{error}</div>}
          <button className="btn btn-primary" type="submit" disabled={submitting}>
            {submitting ? 'Posting…' : 'Post listing'}
          </button>
        </form>
      </div>

      <h3>Your listings & interest requests</h3>
      {listings.length === 0 ? (
        <p style={{ color: 'var(--text-dim)' }}>You haven't posted any listings yet.</p>
      ) : (
        listings.map((listing) => (
          <div className="card" key={listing.id} style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <div>
                <h3 style={{ margin: 0 }}>{listing.location} — ₹{listing.rent}/mo</h3>
                <p className="listing-meta">{listing.roomType} · {listing.furnishingStatus.replace('_', ' ')}</p>
              </div>
              <div>
                {listing.isFilled ? (
                  <span className="badge badge-low">Filled</span>
                ) : (
                  <button className="btn btn-sm" onClick={() => handleMarkFilled(listing.id)}>Mark as filled</button>
                )}
              </div>
            </div>

            {listing.interests?.length > 0 ? (
              <table style={{ marginTop: 12 }}>
                <thead>
                  <tr><th>Tenant</th><th>Status</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {listing.interests.map((i) => (
                    <tr key={i.id}>
                      <td>{i.tenant.name} ({i.tenant.email})</td>
                      <td>
                        <span className={`badge ${i.status === 'ACCEPTED' ? 'badge-high' : i.status === 'DECLINED' ? 'badge-low' : 'badge-mid'}`}>
                          {i.status}
                        </span>
                      </td>
                      <td style={{ display: 'flex', gap: 6 }}>
                        {i.status === 'PENDING' && (
                          <>
                            <button className="btn btn-sm btn-success" onClick={() => handleDecision(i.id, 'ACCEPTED')}>Accept</button>
                            <button className="btn btn-sm btn-danger" onClick={() => handleDecision(i.id, 'DECLINED')}>Decline</button>
                          </>
                        )}
                        {i.status === 'ACCEPTED' && (
                          <Link to={`/chat/${i.id}`} className="btn btn-sm">Open chat</Link>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p style={{ color: 'var(--text-dim)', marginTop: 10, fontSize: '0.85rem' }}>No interest requests yet.</p>
            )}
          </div>
        ))
      )}
    </div>
  );
}
