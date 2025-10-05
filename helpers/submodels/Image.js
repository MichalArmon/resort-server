import { Schema } from "mongoose";
import { DEFAULT_VALIDATION, URL } from "../mongooseValidators.js";

export const Image = new Schema({
  url: URL,
  alt: { ...DEFAULT_VALIDATION, required: false, minLength: 0 },
});
