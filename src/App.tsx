import { lazy, Suspense, type ReactNode } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { isConfigured } from "./lib/env";
import { ROUTES, homeFor, type RouteKey } from "./lib/roles";
import { RequireRole } from "./components/RequireRole";
import { LoadingScreen, PageLoading } from "./components/StatusScreen";
import { UpdateBanner } from "./components/UpdateBanner";
import { Login } from "./pages/Login";
import { Placeholder } from "./pages/Placeholder";
import {
  DeactivatedScreen,
  ErrorScreen,
  NoInviteScreen,
  ProvisioningScreen,
  SetupScreen,
  VerifyEmailScreen,
} from "./pages/AuthScreens";

// Everything after sign-in is loaded on demand, so the login page only downloads what it needs.
const Layout = lazy(() => import("./components/Layout").then((m) => ({ default: m.Layout })));
const TeamPage = lazy(() => import("./pages/Team").then((m) => ({ default: m.TeamPage })));
const ProjectsPage = lazy(() => import("./pages/Projects").then((m) => ({ default: m.ProjectsPage })));
const ProjectPage = lazy(() => import("./pages/ProjectPage").then((m) => ({ default: m.ProjectPage })));
const AllTasksPage = lazy(() => import("./pages/MyTasks").then((m) => ({ default: m.AllTasksPage })));
const MyTasksPage = lazy(() => import("./pages/MyTasks").then((m) => ({ default: m.MyTasksPage })));
const ReviewQueuePage = lazy(() => import("./pages/ReviewQueue").then((m) => ({ default: m.ReviewQueuePage })));
const NotificationsPage = lazy(() => import("./pages/Notifications").then((m) => ({ default: m.NotificationsPage })));
const ProspectsPage = lazy(() => import("./pages/Prospects").then((m) => ({ default: m.ProspectsPage })));
const ProspectPage = lazy(() => import("./pages/ProspectPage").then((m) => ({ default: m.ProspectPage })));
const ImportProspectsPage = lazy(() => import("./pages/ImportProspects").then((m) => ({ default: m.ImportProspectsPage })));
const TemplatesPage = lazy(() => import("./pages/Templates").then((m) => ({ default: m.TemplatesPage })));
const DashboardPage = lazy(() => import("./pages/Dashboard").then((m) => ({ default: m.DashboardPage })));
const PayoutsPage = lazy(() => import("./pages/Payouts").then((m) => ({ default: m.PayoutsPage })));
const MyPayoutsPage = lazy(() => import("./pages/Payouts").then((m) => ({ default: m.MyPayoutsPage })));
const SettingsPage = lazy(() => import("./pages/SettingsPage").then((m) => ({ default: m.SettingsPage })));
const QuotePage = lazy(() => import("./pages/QuotePage").then((m) => ({ default: m.QuotePage })));
const QuotePrint = lazy(() => import("./pages/QuotePrint").then((m) => ({ default: m.QuotePrint })));
const ClientPage = lazy(() => import("./pages/ClientPage").then((m) => ({ default: m.ClientPage })));
const ResponsesPage = lazy(() => import("./pages/ResponsesPage").then((m) => ({ default: m.ResponsesPage })));
// The client portal: an outside person, no sign-in, no team app around it.
const PortalPage = lazy(() => import("./pages/PortalPage").then((m) => ({ default: m.PortalPage })));
const DIRECTOR_ONLY = ["director"] as const;

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
    <Suspense fallback={<PageLoading />}>
    <Routes>
      <Route path="/projects/:projectId/quote/print/:version" element={<RequireRole roles={DIRECTOR_ONLY}><QuotePrint /></RequireRole>} />
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
        <Route path="/projects/:projectId/quote" element={<RequireRole roles={DIRECTOR_ONLY}><QuotePage /></RequireRole>} />
        <Route path="/projects/:projectId/client" element={<RequireRole roles={DIRECTOR_ONLY}><ClientPage /></RequireRole>} />
        <Route path="/responses" element={<RequireRole roles={DIRECTOR_ONLY}><ResponsesPage /></RequireRole>} />
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
    </Suspense>
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
  // /p/<token>: the client portal — rendered on its own, outside the team app and its auth gate.
  const portal = /^\/p\/([^/]+)\/?$/.exec(window.location.pathname);
  if (portal) {
    return (
      <Suspense fallback={<LoadingScreen />}>
        <PortalPage token={decodeURIComponent(portal[1])} />
      </Suspense>
    );
  }
  return (
    <AuthProvider>
      <BrowserRouter>
        <Gate />
      </BrowserRouter>
      <UpdateBanner />
    </AuthProvider>
  );
}
