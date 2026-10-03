import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from '../components/layout/AppShell';
import { DashboardPage } from '../features/dashboard/DashboardPage';
import { PlaceholderPage } from '../features/placeholder/PlaceholderPage';

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<Navigate replace to="/dashboard" />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="sales" element={<PlaceholderPage title="Sales" />} />
          <Route path="expenses" element={<PlaceholderPage title="Expenses" />} />
          <Route path="accounting" element={<PlaceholderPage title="Accounting" />} />
          <Route path="reports" element={<PlaceholderPage title="Reports" />} />
          <Route path="*" element={<PlaceholderPage title="Page not found" />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
