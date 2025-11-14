import mongoose from "mongoose";

const { Schema } = mongoose;

const CategorySchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    category: { type: mongoose.Schema.Types.ObjectId, ref: "Category" },
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
