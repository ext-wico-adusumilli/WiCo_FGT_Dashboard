import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { ToastProvider } from './components/Toast';
import { ProtectedRoute } from './components/ProtectedRoute';
import { MainLayout } from './components/MainLayout';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { MTTFDashboardPage } from './pages/MTTFDashboardPage';
import { ProfilePage } from './pages/ProfilePage';
import { MTTFPage } from './pages/MTTFPage';
import { AdminPage } from './pages/AdminPage';
import { GeneralOverviewPage } from './pages/GeneralOverviewPage';
import { WeatherStationPage } from './pages/WeatherStationPage';
import { WeatherStationPageOptimized } from './pages/WeatherStationPageOptimized';
import { SNOverviewPageOptimized } from './pages/SNOverviewPageOptimized';
import { LogDetailsPageOptimized } from './pages/LogDetailsPageOptimized';
import { LTEConnectivityPage } from './pages/LTEConnectivityPage';
import { LTEConnectivityPageOptimized } from './pages/LTEConnectivityPageOptimized';
import { SNBranchManagementPage } from './pages/SNBranchManagementPage';
import { MttfFilterManagementPage } from './pages/MttfFilterManagementPage';
import { AnalysisManagerPage } from './pages/AnalysisManagerPage';
import { DataIngestionPage } from './pages/DataIngestionPage';
import { UnauthorizedPage } from './pages/UnauthorizedPage';

// Component to handle root redirect based on privileges
function RootRedirect() {
  return (
    <ProtectedRoute>
      <MainLayout>
        <div></div>
      </MainLayout>
    </ProtectedRoute>
  );
}

function App() {
  return (
    <BrowserRouter
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true
      }}
    >
      <ThemeProvider>
        <AuthProvider>
          <ToastProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/unauthorized" element={<UnauthorizedPage />} />
            
            <Route
              path="/mttf-data"
              element={
                <ProtectedRoute checkPrivilege={(p) => p.canAccessMTTFDashboard()}>
                  <MainLayout>
                    <MTTFDashboardPage />
                  </MainLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/general-overview"
              element={
                <ProtectedRoute checkPrivilege={(p) => p.canAccessGeneralOverview()}>
                  <MainLayout>
                    <GeneralOverviewPage />
                  </MainLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/mttf-dashboard"
              element={
                <ProtectedRoute checkPrivilege={(p) => p.canAccessMTTFDashboard()}>
                  <MainLayout>
                    <MTTFPage />
                  </MainLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/analysis-manager"
              element={
                <ProtectedRoute checkPrivilege={(p) => p.canAccessAnalysisManager()}>
                  <MainLayout>
                    <AnalysisManagerPage />
                  </MainLayout>
                </ProtectedRoute>
              }
            />

            <Route
              path="/user-management"
              element={
                <ProtectedRoute checkPrivilege={(p) => p.canAccessAdministration()}>
                  <MainLayout>
                    <AdminPage />
                  </MainLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/privilege-management"
              element={
                <ProtectedRoute checkPrivilege={(p) => p.canAccessPrivilegeManagement()}>
                  <MainLayout>
                    <AdminPage />
                  </MainLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/weather-station"
              element={
                <ProtectedRoute checkPrivilege={(p) => p.canAccessWeatherStation()}>
                  <MainLayout>
                    <WeatherStationPage />
                  </MainLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/weather-station-optimized"
              element={
                <ProtectedRoute checkPrivilege={(p) => p.canAccessWeatherStation()}>
                  <MainLayout>
                    <WeatherStationPageOptimized />
                  </MainLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/general-overview-optimised"
              element={
                <ProtectedRoute checkPrivilege={(p) => p.canAccessGeneralOverview()}>
                  <MainLayout>
                    <SNOverviewPageOptimized />
                  </MainLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/log-details"
              element={
                <ProtectedRoute checkPrivilege={(p) => p.canAccessLogDetails()}>
                  <MainLayout>
                    <LogDetailsPageOptimized />
                  </MainLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/log-details-optimized"
              element={
                <ProtectedRoute checkPrivilege={(p) => p.canAccessLogDetails()}>
                  <MainLayout>
                    <LogDetailsPageOptimized />
                  </MainLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/lte-connectivity"
              element={
                <ProtectedRoute checkPrivilege={(p) => p.canAccessLTEConnectivity()}>
                  <MainLayout>
                    <LTEConnectivityPage />
                  </MainLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/lte-connectivity-optimized"
              element={
                <ProtectedRoute checkPrivilege={(p) => p.canAccessLTEConnectivity()}>
                  <MainLayout>
                    <LTEConnectivityPageOptimized />
                  </MainLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/sn-branch-management"
              element={
                <ProtectedRoute checkPrivilege={(p) => p.canAccessSNGeoLocations()}>
                  <MainLayout>
                    <SNBranchManagementPage />
                  </MainLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/mttf-filters"
              element={
                <ProtectedRoute checkPrivilege={(p) => p.canAccessMTTFDashboard('filters')}>
                  <MainLayout>
                    <MttfFilterManagementPage />
                  </MainLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/data-ingestion"
              element={
                <ProtectedRoute checkPrivilege={(p) => p.canAccessDataIngestion()}>
                  <MainLayout>
                    <DataIngestionPage />
                  </MainLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/profile"
              element={
                <ProtectedRoute>
                  <MainLayout>
                    <ProfilePage />
                  </MainLayout>
                </ProtectedRoute>
              }
            />
            <Route path="/" element={<RootRedirect />} />
            <Route path="*" element={<RootRedirect />} />
          </Routes>
          </ToastProvider>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}

export default App;

