import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const dashboardLink =
    user?.role === 'OWNER' ? '/owner' : user?.role === 'ADMIN' ? '/admin' : '/tenant';

  return (
    <div className="navbar">
      <Link to="/" className="brand">🏠 Rent & Flatmate Finder</Link>
      <nav>
        {user ? (
          <>
            <Link to={dashboardLink}>Dashboard</Link>
            <span style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>
              {user.name} ({user.role})
            </span>
            <button className="btn btn-sm" onClick={handleLogout}>Logout</button>
          </>
        ) : (
          <>
            <Link to="/login">Login</Link>
            <Link to="/register" className="btn btn-sm btn-primary">Sign up</Link>
          </>
        )}
      </nav>
    </div>
  );
}
