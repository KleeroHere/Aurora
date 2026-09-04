import { Route, Routes } from "react-router-dom";
import AppLayout from "./components/AppLayout/AppLayout";
import StartupGate from "./components/StartupGate/StartupGate";
import { CurrentUserProvider } from "./context/CurrentUserContext";
import { useGlobalViewTransitions } from "./utils/useGlobalViewTransitions";
import HomePage from "./pages/HomePage";
import MacroPage from "./pages/MacroPage";
import SectionPage from "./pages/SectionPage";
import TagPage from "./pages/TagPage";
import MaterialPage from "./pages/MaterialPage";
import ArticleEditPage from "./pages/ArticleEditPage";
import MaterialCreatePage from "./pages/MaterialCreatePage";
import SettingsPage from "./pages/SettingsPage";
import AdminPage from "./pages/AdminPage";
import AdminJournalPage from "./pages/AdminJournalPage";
import ChangelogPage from "./pages/ChangelogPage";
import SearchPage from "./pages/SearchPage";
import AdminGate from "./components/AdminGate/AdminGate";
import UserPreferencesSync from "./components/UserPreferencesSync/UserPreferencesSync";
import TrainingProgramPage from "./pages/TrainingProgramPage";
import HelpAutoTour from "./components/HelpAutoTour/HelpAutoTour";
import { HelpProvider } from "./help/HelpContext";

export default function App() {
  useGlobalViewTransitions();

  return (
    <CurrentUserProvider>
      <UserPreferencesSync />
      <HelpProvider>
        <StartupGate>
          {/* The tour lives INSIDE the gate. Outside it, it fired 1.2 s after
              sign-in and, once the induction course appeared, would have run on
              top of it: the course is its own full-screen layer, and
              highlighting header elements over it would point at nothing. The
              gate only renders its children at the "app" stage, so here the
              tour waits its turn on its own, without a "training in progress"
              flag. */}
          <HelpAutoTour />
          <Routes>
            <Route element={<AppLayout />}>
              <Route path="/" element={<HomePage />} />
              <Route path="/macro/:macroId" element={<MacroPage />} />
              <Route path="/section/:sectionId" element={<SectionPage />} />
              <Route path="/tag/:tag" element={<TagPage />} />
              <Route path="/material/new" element={<MaterialCreatePage />} />
              <Route path="/material/:materialId" element={<MaterialPage />} />
              <Route path="/material/:materialId/edit" element={<ArticleEditPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/changelog" element={<ChangelogPage />} />
              <Route path="/training" element={<TrainingProgramPage />} />
              <Route path="/search/:query" element={<SearchPage />} />
              <Route element={<AdminGate />}>
                <Route path="/admin" element={<AdminPage />} />
                <Route path="/admin/journal" element={<AdminJournalPage />} />
              </Route>
            </Route>
          </Routes>
        </StartupGate>
      </HelpProvider>
    </CurrentUserProvider>
  );
}
