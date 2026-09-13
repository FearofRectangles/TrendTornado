import {
  Router,
} from "express";

import {
  DashboardController,
} from "../controllers/DashboardController.js";
import {
  RelocationController,
} from "../controllers/RelocationController.js";
import {
  ArticleController,
} from "../controllers/ArticleController.js";
import {
  AnalysisController,
} from "../controllers/AnalysisController.js";
import {
  WarehouseStructureController,
} from "../controllers/WarehouseStructureController.js";
import {
  SettingsController,
} from "../controllers/SettingsController.js";
import { AffinityController } from "../controllers/AffinityController.js";


export const dashboardRoutes =
  Router();

dashboardRoutes.get(
  "/",
  DashboardController.index,
);

dashboardRoutes.get("/relocations", RelocationController.index);
dashboardRoutes.get("/relocations/:view", RelocationController.index);
dashboardRoutes.get("/articles", ArticleController.index);
dashboardRoutes.get("/articles/:articleNumber", ArticleController.show);
dashboardRoutes.get("/analysis", AnalysisController.index);
dashboardRoutes.get("/affinity", AffinityController.index);
dashboardRoutes.get("/warehouse", WarehouseStructureController.index);
dashboardRoutes.get("/settings", SettingsController.index);
dashboardRoutes.post("/settings", SettingsController.update);
