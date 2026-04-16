import { Route as rootRoute } from "./routes/__root";
import { Route as indexRoute } from "./routes/index";
import { Route as reviewRoute } from "./routes/review.$owner.$repo.$number";

export const routeTree = rootRoute.addChildren([indexRoute, reviewRoute]);
