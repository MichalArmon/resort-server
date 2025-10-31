import mongoose from "mongoose";

const { Schema } = mongoose;

const CategorySchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    color: {
      type: String,
      default: "#6ab04c",
    },
    types: {
      type: [String],
      enum: ["workshop", "retreat", "treatment", "room"],
      default: [],
    },
    icon: {
      type: String,
    },
  },
  { timestamps: true }
);

export default mongoose.model("Category", CategorySchema);
