import type { ReactNode } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { isConfigured } from "./lib/env";
import { ROUTES, homeFor, type RouteKey } from "./lib/roles";
import { Layout } from "./components/Layout";
import { RequireRole } from "./components/RequireRole";
import { LoadingScreen } from "./components/StatusScreen";
import { Login } from "./pages/Login";
import { Placeholder } from "./pages/Placeholder";
import { TeamPage } from "./pages/Team";
import { ProjectsPage } from "./pages/Projects";
import { ProjectPage } from "./pages/ProjectPage";
import { AllTasksPage, MyTasksPage } from "./pages/MyTasks";
import { ReviewQueuePage } from "./pages/ReviewQueue";
import { NotificationsPage } from "./pages/Notifications";
import { ProspectsPage } from "./pages/Prospects";
import { ProspectPage } from "./pages/ProspectPage";
import { ImportProspectsPage } from "./pages/ImportProspects";
import { TemplatesPage } from "./pages/Templates";
import { DashboardPage } from "./pages/Dashboard";
import { MyPayoutsPage, PayoutsPage } from "./pages/Payouts";
import { SettingsPage } from "./pages/SettingsPage";
import {
  DeactivatedScreen,
  ErrorScreen,
  NoInviteScreen,
  ProvisioningScreen,
  SetupScreen,
  VerifyEmailScreen,
} from "./pages/AuthScreens";

const PAGES: Partial<Record<RouteKey, ReactNode>> = {
  team: <TeamPage />,
  projects: <ProjectsPage />,
  tasks: <AllTasksPage />,
  myTasks: <MyTasksPage />,
  review: <ReviewQueuePage />,
  notifications: <NotificationsPage />,
  prospects: <ProspectsPage />,
  templates: <TemplatesPage />,
  dashboard: <DashboardPage />,
  payouts: <PayoutsPage />,
  myPayouts: <MyPayoutsPage />,
  settings: <SettingsPage />,
};

function AppRoutes() {
  const { role } = useAuth();
  if (!role) return null;
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Navigate to={homeFor(role)} replace />} />
        {(Object.keys(ROUTES) as RouteKey[]).map((key) => {
          const route = ROUTES[key];
          return (
            <Route
              key={route.path}
              path={route.path}
              element={<RequireRole roles={route.roles}>{PAGES[key] ?? <Placeholder route={route} />}</RequireRole>}
            />
          );
        })}
        <Route
          path="/projects/:projectId"
          element={<RequireRole roles={ROUTES.projects.roles}><ProjectPage /></RequireRole>}
        />
        <Route
          path="/prospects/import"
          element={<RequireRole roles={ROUTES.prospects.roles}><ImportProspectsPage /></RequireRole>}
        />
        <Route
          path="/prospects/:prospectId"
          element={<RequireRole roles={ROUTES.prospects.roles}><ProspectPage /></RequireRole>}
        />
        <Route path="*" element={<Navigate to={homeFor(role)} replace />} />
      </Route>
    </Routes>
  );
}

function Gate() {
  const { status } = useAuth();
  switch (status) {
    case "loading":
      return <LoadingScreen />;
    case "signed-out":
      return <Login />;
    case "unverified":
      return <VerifyEmailScreen />;
    case "provisioning":
      return <ProvisioningScreen />;
    case "no-invite":
      return <NoInviteScreen />;
    case "deactivated":
      return <DeactivatedScreen />;
    case "error":
      return <ErrorScreen />;
    case "ready":
      return <AppRoutes />;
  }
}

export default function App() {
  if (!isConfigured) return <SetupScreen />;
  return (
    <AuthProvider>
      <BrowserRouter>
        <Gate />
      </BrowserRouter>
    </AuthProvider>
  );
}
