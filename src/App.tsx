import { Navigate, Route, Routes } from "react-router";
import { LayoutGroup } from "motion/react";
import { AppShell } from "@/components/layout/AppShell";
import { AppearanceSync } from "@/components/AppearanceSync";
import { Toaster } from "@/components/ui/Toaster";
import { AccountSheet, ConsentSheet } from "@/components/account/AccountSheets";
import { useAccountSync } from "@/hooks/useAccountSync";
import HomePage from "@/pages/HomePage";
import ExplorePage from "@/pages/ExplorePage";
import LibraryPage from "@/pages/LibraryPage";
import NotFoundPage from "@/pages/NotFoundPage";
import PlaceholderPage from "@/pages/PlaceholderPage";
import SearchPage from "@/pages/SearchPage";
import SettingsPage from "@/pages/SettingsPage";
import TitlePage from "@/pages/TitlePage";
import WelcomePage from "@/pages/WelcomePage";

export default function App() {
  useAccountSync();
  return (
    <AppearanceSync>
      {/* LayoutGroup lets a poster's layoutId animate across route changes (poster → detail) */}
      <LayoutGroup>
        <Routes>
          <Route element={<AppShell />}>
            <Route index element={<HomePage />} />
            <Route path="explore" element={<ExplorePage />} />
            <Route
              path="together"
              element={
                <PlaceholderPage
                  title="Together"
                  note="Everyone swipes on their phone, we find the movie you all agree on. Coming soon."
                />
              }
            />
            <Route path="library" element={<LibraryPage />} />
            <Route path="search" element={<SearchPage />} />
            <Route path="settings" element={<SettingsPage />} />
            {/* old tab URLs */}
            <Route path="watchlist" element={<Navigate to="/library" replace />} />
            <Route path="group" element={<Navigate to="/together" replace />} />
            <Route path="stats" element={<Navigate to="/library" replace />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
          <Route path="title/movie/:id" element={<TitlePage />} />
          <Route path="welcome" element={<WelcomePage />} />
        </Routes>
      </LayoutGroup>
      <Toaster />
      <ConsentSheet />
      <AccountSheet />
    </AppearanceSync>
  );
}
