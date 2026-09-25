import express, { Router } from "express";

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
dashboardRoutes.get("/api/calendar", DashboardController.calendar);

dashboardRoutes.get("/relocations", RelocationController.index);
dashboardRoutes.get("/relocations/:view", RelocationController.index);
dashboardRoutes.get("/api/relocations/:articleNumber/options", RelocationController.placementOptions);
dashboardRoutes.post("/relocations/export.pdf", RelocationController.exportPdf);
dashboardRoutes.get("/articles", ArticleController.index);
dashboardRoutes.post("/articles/export.pdf", ArticleController.exportPdf);
dashboardRoutes.get("/api/articles/:articleNumber", ArticleController.detail);
dashboardRoutes.get("/articles/:articleNumber", ArticleController.show);
dashboardRoutes.get("/analysis", AnalysisController.index);
dashboardRoutes.get("/affinity", AffinityController.index);
dashboardRoutes.get("/warehouse", WarehouseStructureController.index);
dashboardRoutes.get("/settings", SettingsController.index);
dashboardRoutes.post("/settings", SettingsController.update);
dashboardRoutes.post("/settings/analyses", SettingsController.createAnalysis);
dashboardRoutes.post("/analyses/activate", SettingsController.activateAnalysis);
dashboardRoutes.post("/analyses/delete", SettingsController.deleteAnalysis);
dashboardRoutes.post("/settings/data-sources/import", express.raw({ type: () => true, limit: "150mb" }), SettingsController.importDataSource);
dashboardRoutes.post("/settings/data-sources/deactivate", SettingsController.deactivateDataSource);
dashboardRoutes.post("/settings/data-sources/activate", SettingsController.activateDataSource);
dashboardRoutes.post("/settings/data-sources/delete", SettingsController.deleteDataSource);
dashboardRoutes.post("/settings/zones", SettingsController.saveZoneMappings);
dashboardRoutes.post("/settings/pick-areas", SettingsController.savePickAreas);
dashboardRoutes.post("/settings/article-rules", SettingsController.saveArticleRules);
