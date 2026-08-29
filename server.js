import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";

const app = express();

const PORT = 3000;


// --------------------------------------------------
// Paths
// --------------------------------------------------

const __filename =
  fileURLToPath(import.meta.url);

const __dirname =
  path.dirname(__filename);

const viewsPath =
  path.join(
    __dirname,
    "src",
    "web",
    "views",
  );

const publicPath =
  path.join(
    __dirname,
    "src",
    "web",
    "public",
  );


// --------------------------------------------------
// View engine
// --------------------------------------------------

app.set(
  "view engine",
  "ejs",
);

app.set(
  "views",
  viewsPath,
);


// --------------------------------------------------
// Static files
// --------------------------------------------------

app.use(
  express.static(publicPath),
);

app.use(
  "/",
  dashboardRoutes,
);


import {
  dashboardRoutes,
} from "./src/web/routes/dashboardRoutes.js";


// --------------------------------------------------
// Start server
// --------------------------------------------------

app.listen(PORT, () => {
  console.log(
    `TrendTornado running at http://localhost:${PORT}`,
  );
});


app.use(
  (error, req, res, next) => {
    console.error(error);

    res
      .status(500)
      .send(
        "TrendTornado encountered an error.",
      );
  },
);