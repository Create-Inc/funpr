import { createRootRoute, Outlet } from "@tanstack/react-router";
import { AuthProvider } from "../lib/auth-context";

export const Route = createRootRoute({
  component: () => (
    <AuthProvider>
      <div className="h-full bg-gray-950 text-gray-100">
        <Outlet />
      </div>
    </AuthProvider>
  ),
});
