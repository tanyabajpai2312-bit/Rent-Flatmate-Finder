import { Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar';
import Login from './pages/Login';
import Register from './pages/Register';
import TenantDashboard from './pages/TenantDashboard';
import OwnerDashboard from './pages/OwnerDashboard';
import AdminDashboard from './pages/AdminDashboard';
import Chat from './pages/Chat';
import { useAuth } from './context/AuthContext';

function Protected({ children, roles }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  const { user } = useAuth();

  const homeRedirect = !user
    ? '/login'
    : user.role === 'OWNER'
    ? '/owner'
    : user.role === 'ADMIN'
    ? '/admin'
    : '/tenant';

  return (
    <>
      <Navbar />
      <Routes>
        <Route path="/" element={<Navigate to={homeRedirect} replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route
          path="/tenant"
          element={
            <Protected roles={['TENANT']}>
              <TenantDashboard />
            </Protected>
          }
        />
        <Route
          path="/owner"
          element={
            <Protected roles={['OWNER']}>
              <OwnerDashboard />
            </Protected>
          }
        />
        <Route
          path="/admin"
          element={
            <Protected roles={['ADMIN']}>
              <AdminDashboard />
            </Protected>
          }
        />
        <Route
          path="/chat/:interestId"
          element={
            <Protected>
              <Chat />
            </Protected>
          }
        />
        <Route path="*" element={<Navigate to={homeRedirect} replace />} />
      </Routes>
    </>
  );
}
