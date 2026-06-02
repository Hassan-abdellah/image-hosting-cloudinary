import "dotenv/config";
import express from "express";
import { clerkMiddleware } from "@clerk/express";
import foldersRoute from "./routes/foldersRoute.js";
// initialize express app
const app = express();
const PORT = process.env.PORT || 8000;

// Clerk middleware to handle authentication and user management
app.use(clerkMiddleware());

// body parser middleware to parse JSON request bodies
app.use(express.json());

app.use("/api/folders", foldersRoute);
// ✅ Export for Vercel — NOT module.exports

export default app;

// initialize server
// Keep listen() for local dev only
if (process.env.NODE_ENV !== "production") {
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
}
