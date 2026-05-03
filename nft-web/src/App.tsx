import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { MarketplaceLayout } from "./layout/MarketplaceLayout";
import { BidsPage } from "./pages/BidsPage";
import { ItemPage } from "./pages/ItemPage";
import { MarketplacePage } from "./pages/MarketplacePage";
import { ProfilePage } from "./pages/ProfilePage";
import { LegalPage } from "./pages/LegalPage";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={
            <MarketplaceLayout>
              <MarketplacePage />
            </MarketplaceLayout>
          }
        />
        <Route
          path="/bids"
          element={
            <MarketplaceLayout>
              <BidsPage />
            </MarketplaceLayout>
          }
        />
        <Route
          path="/profile"
          element={
            <MarketplaceLayout>
              <ProfilePage />
            </MarketplaceLayout>
          }
        />
        <Route
          path="/item/:listingId"
          element={
            <MarketplaceLayout>
              <ItemPage />
            </MarketplaceLayout>
          }
        />
        <Route
          path="/privacy"
          element={
            <MarketplaceLayout>
              <LegalPage doc="privacy" />
            </MarketplaceLayout>
          }
        />
        <Route
          path="/terms"
          element={
            <MarketplaceLayout>
              <LegalPage doc="terms" />
            </MarketplaceLayout>
          }
        />
        <Route
          path="/cookies"
          element={
            <MarketplaceLayout>
              <LegalPage doc="cookies" />
            </MarketplaceLayout>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
