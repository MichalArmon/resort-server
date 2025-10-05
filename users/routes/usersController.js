import express from "express";
import { createNewUser, login } from "../services/usersService.js";

const router = express.Router();

router.post("/", async (req, res) => {
  try {
    const newUser = req.body;
    const user = await createNewUser(newUser);
    res.status(201).send(user);
  } catch (error) {
    res.status(400).send(error.message);
  }
});

router.post("/login", async (req, res) => {
  try {
    const { password, email } = req.body;
    const token = await login(email, password);
    res.send(token);
  } catch (error) {
    res.status(401).send("invalid email or password");
  }
});

export default router;
