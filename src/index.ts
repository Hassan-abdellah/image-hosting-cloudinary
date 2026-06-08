import "dotenv/config";
import express from "express";
import { clerkMiddleware } from "@clerk/express";
import foldersRoute from "./routes/folders.js";
import imagesRoutes from "./routes/images.js";
import userRoutes from "./routes/users.js";

import cors from "cors";
import rateLimit from "express-rate-limit";

const PORT = process.env.PORT || 8000;
// rate limiter
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per `window`
  message: "Too many requests from this IP, please try again after 15 minutes",
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

// initialize express app
const app = express();

// cors
app.use(
  cors({
    origin: ["http://localhost:5173"], // your frontend origins
    allowedHeaders: ["Authorization", "Content-Type"],
    credentials: true,
  }),
);
// Clerk middleware to handle authentication and user management
app.use(
  clerkMiddleware({
    authorizedParties: ["http://localhost:5173"],
    clockSkewInMs: 60000, // tolerate 60 seconds of clock drift
  }),
);

// users webhook
app.use("/webhooks/clerk", userRoutes);

// body parser middleware to parse JSON request bodies
app.use(express.json());

// rate limit
app.use(limiter);

// folders routes
app.use("/api/folders", foldersRoute);
// images routes
app.use("/api/images", imagesRoutes);
// ✅ Export for Vercel — NOT module.exports

// ✅ Export for Vercel — NOT module.exports
export default app;

// initialize server
// Keep listen() for local dev only
if (process.env.NODE_ENV !== "production") {
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
}
