import "dotenv/config";
import express from "express";
import { clerkMiddleware } from "@clerk/express";
import foldersRoute from "./routes/folders.js";
import imagesRoutes from "./routes/images.js";
// initialize express app
const app = express();
const PORT = process.env.PORT || 8000;
// Clerk middleware to handle authentication and user management
app.use(clerkMiddleware());

// body parser middleware to parse JSON request bodies
app.use(express.json());

// folders routes
app.use("/api/folders", foldersRoute);
// images routes
app.use("/api/images", imagesRoutes);
// ✅ Export for Vercel — NOT module.exports

export default app;

// initialize server
// Keep listen() for local dev only
if (process.env.NODE_ENV !== "production") {
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
}
