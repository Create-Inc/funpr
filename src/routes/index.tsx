import { createRoute } from "@tanstack/react-router";
import { Route as rootRoute } from "./__root";
import { useAuth } from "../lib/auth-context";
import { Dashboard } from "../components/Dashboard";
import { LoginPage } from "../components/LoginPage";

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: IndexPage,
});

function IndexPage() {
  const { user, token, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-600 border-t-white" />
      </div>
    );
  }

  if (!user || !token) {
    return <LoginPage />;
  }

  return <Dashboard />;
}
