import { useEffect, useState } from 'react';
import api from '../api/axios';

export default function AdminDashboard() {
  const [activity, setActivity] = useState(null);
  const [users, setUsers] = useState([]);
  const [listings, setListings] = useState([]);

  const loadAll = async () => {
    const [a, u, l] = await Promise.all([
      api.get('/api/admin/activity'),
      api.get('/api/admin/users'),
      api.get('/api/admin/listings'),
    ]);
    setActivity(a.data);
    setUsers(u.data);
    setListings(l.data);
  };

  useEffect(() => {
    loadAll();
  }, []);

  const deleteUser = async (id) => {
    await api.delete(`/api/admin/users/${id}`);
    loadAll();
  };

  const deleteListing = async (id) => {
    await api.delete(`/api/admin/listings/${id}`);
    loadAll();
  };

  return (
    <div className="container">
      <h2>Admin dashboard</h2>

      {activity && (
        <div className="stats-grid">
          <div className="stat-card"><div className="num">{activity.totalUsers}</div><div className="label">Users</div></div>
          <div className="stat-card"><div className="num">{activity.totalListings}</div><div className="label">Listings</div></div>
          <div className="stat-card"><div className="num">{activity.filledListings}</div><div className="label">Filled</div></div>
          <div className="stat-card"><div className="num">{activity.totalInterests}</div><div className="label">Interests</div></div>
          <div className="stat-card"><div className="num">{activity.totalMessages}</div><div className="label">Messages</div></div>
        </div>
      )}

      <h3>Users</h3>
      <table>
        <thead><tr><th>Name</th><th>Email</th><th>Role</th><th></th></tr></thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id}>
              <td>{u.name}</td>
              <td>{u.email}</td>
              <td>{u.role}</td>
              <td><button className="btn btn-sm btn-danger" onClick={() => deleteUser(u.id)}>Delete</button></td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3 style={{ marginTop: 28 }}>Listings</h3>
      <table>
        <thead><tr><th>Location</th><th>Rent</th><th>Owner</th><th>Status</th><th></th></tr></thead>
        <tbody>
          {listings.map((l) => (
            <tr key={l.id}>
              <td>{l.location}</td>
              <td>₹{l.rent}</td>
              <td>{l.owner.name}</td>
              <td>{l.isFilled ? 'Filled' : 'Open'}</td>
              <td><button className="btn btn-sm btn-danger" onClick={() => deleteListing(l.id)}>Delete</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
