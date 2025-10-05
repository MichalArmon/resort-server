import { Schema } from "mongoose";
import { DEFAULT_VALIDATION } from "../mongooseValidators.js";

export const Address = new Schema({
  state: {
    type: String,
    maxLength: 256,
    trim: true,
  },
  country: DEFAULT_VALIDATION,
  city: DEFAULT_VALIDATION,
  street: DEFAULT_VALIDATION,
  houseNumber: {
    type: Number,
    required: true,
    trim: true,
    minLength: 1,
  },
  zip: {
    type: Number,
    trim: true,
    minLength: 4,
    default: 0,
  },
});
