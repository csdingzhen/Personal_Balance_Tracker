import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Dashboard from './pages/Dashboard';
import Accounts from './pages/Accounts';
import Budget from './pages/Budget';
import Investments from './pages/Investments';
import Import from './pages/Import';
import PlaidLink from './pages/PlaidLink';
import SpendingLayout from './pages/spending/SpendingLayout';
import SpendingOverview from './pages/spending/SpendingOverview';
import SpendingBreakdown from './pages/spending/SpendingBreakdown';
import SpendingTransactions from './pages/spending/SpendingTransactions';
import SpendingRecurring from './pages/spending/SpendingRecurring';
import SpendingReports from './pages/spending/SpendingReports';

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return (
    <div className="flex items-center justify-center h-screen bg-bg">
      <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
    </div>
  );
  if (user) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public */}
          <Route path="/login"  element={<PublicRoute><Login /></PublicRoute>} />
          <Route path="/signup" element={<PublicRoute><Signup /></PublicRoute>} />

          {/* Protected */}
          <Route path="/*" element={
            <ProtectedRoute>
              <Layout>
                <Routes>
                  <Route path="/"            element={<Navigate to="/dashboard" replace />} />
                  <Route path="/dashboard"   element={<Dashboard />} />
                  <Route path="/accounts"    element={<Accounts />} />
                  <Route path="/budget"      element={<Budget />} />
                  <Route path="/investments" element={<Investments />} />
                  <Route path="/import"      element={<Import />} />
                  <Route path="/link"        element={<PlaidLink />} />

                  {/* Spending Hub */}
                  <Route path="/spending" element={<SpendingLayout />}>
                    <Route index           element={<SpendingOverview />} />
                    <Route path="breakdown"    element={<SpendingBreakdown />} />
                    <Route path="transactions" element={<SpendingTransactions />} />
                    <Route path="recurring"    element={<SpendingRecurring />} />
                    <Route path="reports"      element={<SpendingReports />} />
                  </Route>

                  {/* Legacy redirect */}
                  <Route path="/transactions" element={<Navigate to="/spending/transactions" replace />} />
                </Routes>
              </Layout>
            </ProtectedRoute>
          } />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
