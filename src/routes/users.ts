import express from "express";
import { userWebhookType } from "../types";
import { Webhook } from "svix";
import {
  deleteUserFromDB,
  saveUserToDB,
  updateUserInDB,
} from "../controllers/usersControllers.js";
const router = express.Router();

// ⚠️ Must use raw body for signature verification
router.post(
  "/",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;
    if (!WEBHOOK_SECRET) return;
    // Verify the webhook signature
    const wh = new Webhook(WEBHOOK_SECRET);
    let event: userWebhookType;

    if (
      !req.headers["svix-id"] ||
      !req.headers["svix-timestamp"] ||
      !req.headers["svix-signature"]
    )
      return;
    try {
      event = wh.verify(req.body, {
        "svix-id": req.headers["svix-id"] as string,
        "svix-timestamp": req.headers["svix-timestamp"] as string,
        "svix-signature": req.headers["svix-signature"] as string,
      }) as userWebhookType;
    } catch (err) {
      return res.status(400).json({ error: "Invalid webhook signature" });
    }

    // Handle events
    const { type, data } = event;

    switch (type) {
      case "user.created":
        await saveUserToDB(data);
        break;
      case "user.updated":
        await updateUserInDB(data);
        break;
      case "user.deleted":
        await deleteUserFromDB(data.id);
        break;
    }

    res.status(200).json({ received: true });
  },
);

export default router;
