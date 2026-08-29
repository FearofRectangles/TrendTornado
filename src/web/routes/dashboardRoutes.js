import {
  Router,
} from "express";

import {
  DashboardController,
} from "../controllers/DashboardController.js";


export const dashboardRoutes =
  Router();

dashboardRoutes.get(
  "/",
  DashboardController.index,
);