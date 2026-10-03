import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from '../components/layout/AppShell';
import { DashboardPage } from '../features/dashboard/DashboardPage';
import { PlaceholderPage } from '../features/placeholder/PlaceholderPage';
import { AccountsPage } from '../features/accounts/AccountsPage';
import { CompanySetupPage } from '../features/setup/CompanySetupPage';
import { LoginPage } from '../features/auth/LoginPage';
import { FirstRunPage } from '../features/auth/FirstRunPage';
import { UserManagementPage } from '../features/users/UserManagementPage';
import { SalesPage } from '../features/sales/SalesPage';
import { AuthProvider } from './auth/AuthContext';
import { RequireAuth } from './auth/RequireAuth';
import { WorkspaceProvider } from './workspace/WorkspaceContext';
import { WorkspaceRedirect } from './workspace/WorkspaceRedirect';

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/first-run" element={<FirstRunPage />} />
          <Route element={<RequireAuth />}>
            <Route element={<WorkspaceProvider />}>
              <Route index element={<WorkspaceRedirect />} />
              <Route path="/setup" element={<CompanySetupPage />} />
              <Route element={<AppShell />}>
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/accounts" element={<AccountsPage />} />
                <Route path="/settings/users" element={<UserManagementPage />} />
                <Route path="/sales" element={<SalesPage />} />
                <Route path="/expenses" element={<PlaceholderPage title="Expenses" />} />
                <Route path="/accounting" element={<PlaceholderPage title="Accounting" />} />
                <Route path="/reports" element={<PlaceholderPage title="Reports" />} />
              </Route>
            </Route>
          </Route>
          <Route path="*" element={<Navigate replace to="/" />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
