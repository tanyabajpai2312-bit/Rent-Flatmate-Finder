import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [role, setRole] = useState('TENANT');
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    preferredLocation: '',
    budgetMin: '',
    budgetMax: '',
    moveInDate: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const payload = { ...form, role };
      const user = await register(payload);
      if (user.role === 'OWNER') navigate('/owner');
      else if (user.role === 'ADMIN') navigate('/admin');
      else navigate('/tenant');
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-wrap">
      <h1>Create an account</h1>
      <p className="sub">Join as a tenant looking for a room, or an owner listing one.</p>
      <form className="card" onSubmit={handleSubmit}>
        <div className="form-group">
          <label>I am a</label>
          <select value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="TENANT">Tenant (looking for a room)</option>
            <option value="OWNER">Owner (listing a room)</option>
          </select>
        </div>
        <div className="form-group">
          <label>Full name</label>
          <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
        <div className="form-group">
          <label>Email</label>
          <input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </div>
        <div className="form-group">
          <label>Password</label>
          <input type="password" required minLength={6} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        </div>

        {role === 'TENANT' && (
          <>
            <div className="form-group">
              <label>Preferred location</label>
              <input required value={form.preferredLocation} onChange={(e) => setForm({ ...form, preferredLocation: e.target.value })} />
            </div>
            <div className="grid grid-2">
              <div className="form-group">
                <label>Budget min (₹)</label>
                <input type="number" required value={form.budgetMin} onChange={(e) => setForm({ ...form, budgetMin: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Budget max (₹)</label>
                <input type="number" required value={form.budgetMax} onChange={(e) => setForm({ ...form, budgetMax: e.target.value })} />
              </div>
            </div>
            <div className="form-group">
              <label>Move-in date</label>
              <input type="date" required value={form.moveInDate} onChange={(e) => setForm({ ...form, moveInDate: e.target.value })} />
            </div>
          </>
        )}

        {error && <div className="error-text">{error}</div>}
        <button className="btn btn-primary" type="submit" disabled={loading} style={{ width: '100%', marginTop: 8 }}>
          {loading ? 'Creating account…' : 'Sign up'}
        </button>
      </form>
      <p style={{ marginTop: 16, fontSize: '0.88rem', color: 'var(--text-dim)' }}>
        Already have an account? <Link to="/login">Log in</Link>
      </p>
    </div>
  );
}
