import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { Shell } from "./components/Shell";
import { LoginPage } from "./pages/LoginPage";
import { RegisterPage } from "./pages/RegisterPage";
import { LandingPage } from "./pages/LandingPage";
import { FounderForumPage } from "./pages/FounderForumPage";
import { VprokPage } from "./pages/VprokPage";
import { VprokPreviewPage } from "./pages/VprokPreviewPage";
import { VprokAdminPage } from "./pages/VprokAdminPage";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/" element={<LandingPage />} />
        <Route path="/forum-lab" element={<FounderForumPage />} />
        <Route path="/vprok-preview" element={<VprokPreviewPage />} />
        <Route
          path="/vprok-admin"
          element={
            <ProtectedRoute>
              <Shell>
                <VprokAdminPage />
              </Shell>
            </ProtectedRoute>
          }
        />
        <Route
          path="/vprok"
          element={
            <ProtectedRoute>
              <Shell>
                <VprokPage />
              </Shell>
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
