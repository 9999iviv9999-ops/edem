import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { EnvRibbon } from "./components/EnvRibbon";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { AdminRoute } from "./components/AdminRoute";
import { Shell } from "./components/Shell";
import { FeedPage } from "./pages/FeedPage";
import { LoginPage } from "./pages/LoginPage";
import { MatchesPage } from "./pages/MatchesPage";
import { ProfilePage } from "./pages/ProfilePage";
import { RegisterPage } from "./pages/RegisterPage";
import { CatalogImportPage } from "./pages/CatalogImportPage";
import { AdminPage } from "./pages/AdminPage";
import { ProfileViewPage } from "./pages/ProfileViewPage";
import { LikesPage } from "./pages/LikesPage";
import { SafetyPage } from "./pages/SafetyPage";
import { PrivacyPolicyPage } from "./pages/PrivacyPolicyPage";
import { TrainersPage } from "./pages/TrainersPage";
import { SearchPage } from "./pages/SearchPage";

function App() {
  const basename = (import.meta.env.BASE_URL || "/").replace(/\/$/, "") || "/";
  return (
    <BrowserRouter basename={basename === "/" ? undefined : basename}>
      <EnvRibbon />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/privacy" element={<PrivacyPolicyPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Shell>
                <FeedPage />
              </Shell>
            </ProtectedRoute>
          }
        />
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <Shell>
                <ProfilePage />
              </Shell>
            </ProtectedRoute>
          }
        />
        <Route
          path="/profiles/:userId"
          element={
            <ProtectedRoute>
              <Shell>
                <ProfileViewPage />
              </Shell>
            </ProtectedRoute>
          }
        />
        <Route
          path="/messages"
          element={
            <ProtectedRoute>
              <Shell>
                <MatchesPage />
              </Shell>
            </ProtectedRoute>
          }
        />
        <Route
          path="/likes"
          element={
            <ProtectedRoute>
              <Shell>
                <LikesPage />
              </Shell>
            </ProtectedRoute>
          }
        />
        <Route
          path="/search"
          element={
            <ProtectedRoute>
              <Shell>
                <SearchPage />
              </Shell>
            </ProtectedRoute>
          }
        />
        <Route path="/matches" element={<Navigate to="/messages" replace />} />
        <Route path="/message" element={<Navigate to="/messages" replace />} />
        <Route
          path="/catalog-import"
          element={
            <ProtectedRoute>
              <AdminRoute>
                <Shell>
                  <CatalogImportPage />
                </Shell>
              </AdminRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/safety"
          element={
            <ProtectedRoute>
              <Shell>
                <SafetyPage />
              </Shell>
            </ProtectedRoute>
          }
        />
        <Route
          path="/trainers"
          element={
            <ProtectedRoute>
              <Shell>
                <TrainersPage />
              </Shell>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin"
          element={
            <ProtectedRoute>
              <AdminRoute>
                <Shell>
                  <AdminPage />
                </Shell>
              </AdminRoute>
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
