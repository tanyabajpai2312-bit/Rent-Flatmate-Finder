import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/axios';
import ListingCard from '../components/ListingCard';

export default function TenantDashboard() {
  const [listings, setListings] = useState([]);
  const [interests, setInterests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ location: '', minRent: '', maxRent: '' });

  const loadListings = async () => {
    setLoading(true);
    const params = {};
    if (filters.location) params.location = filters.location;
    if (filters.minRent) params.minRent = filters.minRent;
    if (filters.maxRent) params.maxRent = filters.maxRent;
    const { data } = await api.get('/api/listings', { params });
    setListings(data);
    setLoading(false);
  };

  const loadInterests = async () => {
    const { data } = await api.get('/api/interests/mine');
    setInterests(data);
  };

  useEffect(() => {
    loadListings();
    loadInterests();
  }, []);

  const expressedListingIds = new Set(interests.map((i) => i.listingId));

  const handleExpressInterest = async (listingId) => {
    await api.post('/api/interests', { listingId });
    loadInterests();
  };

  return (
    <div className="container">
      <h2>Find your room</h2>
      <p style={{ color: 'var(--text-dim)' }}>Listings ranked by AI compatibility with your profile.</p>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="grid grid-2" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px,1fr))' }}>
          <div className="form-group">
            <label>Location</label>
            <input value={filters.location} onChange={(e) => setFilters({ ...filters, location: e.target.value })} placeholder="e.g. Koramangala" />
          </div>
          <div className="form-group">
            <label>Min rent</label>
            <input type="number" value={filters.minRent} onChange={(e) => setFilters({ ...filters, minRent: e.target.value })} />
          </div>
          <div className="form-group">
            <label>Max rent</label>
            <input type="number" value={filters.maxRent} onChange={(e) => setFilters({ ...filters, maxRent: e.target.value })} />
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <button className="btn btn-primary" onClick={loadListings} style={{ width: '100%' }}>Filter</button>
          </div>
        </div>
      </div>

      {loading ? (
        <p>Loading listings…</p>
      ) : listings.length === 0 ? (
        <p>No listings match your filters yet.</p>
      ) : (
        <div className="grid grid-2">
          {listings.map((listing) => (
            <ListingCard
              key={listing.id}
              listing={listing}
              onExpressInterest={handleExpressInterest}
              expressed={expressedListingIds.has(listing.id)}
            />
          ))}
        </div>
      )}

      <h3 style={{ marginTop: 32 }}>Your interest requests</h3>
      {interests.length === 0 ? (
        <p style={{ color: 'var(--text-dim)' }}>You haven't expressed interest in any listing yet.</p>
      ) : (
        <table>
          <thead>
            <tr><th>Location</th><th>Rent</th><th>Status</th><th>Chat</th></tr>
          </thead>
          <tbody>
            {interests.map((i) => (
              <tr key={i.id}>
                <td>{i.listing.location}</td>
                <td>₹{i.listing.rent}</td>
                <td>
                  <span className={`badge ${i.status === 'ACCEPTED' ? 'badge-high' : i.status === 'DECLINED' ? 'badge-low' : 'badge-mid'}`}>
                    {i.status}
                  </span>
                </td>
                <td>
                  {i.status === 'ACCEPTED' ? (
                    <Link to={`/chat/${i.id}`} className="btn btn-sm">Open chat</Link>
                  ) : (
                    <span style={{ color: 'var(--text-dim)' }}>—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
