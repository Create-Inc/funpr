import { createRoute } from "@tanstack/react-router";
import { Route as rootRoute } from "./__root";
import { ReviewPage } from "../components/ReviewPage";

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: "/review/$owner/$repo/$number",
  component: ReviewPage,
});
