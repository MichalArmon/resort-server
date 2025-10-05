// models/PricingRule.js

import mongoose from "mongoose";

const pricingRuleSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  // applies to 'ALL' room types or a specific room type (e.g., 'Deluxe Villa')
  appliesTo: {
    type: String,
    required: true,
  },
  startDate: {
    type: Date,
    required: true,
  },
  endDate: {
    type: Date,
    required: true,
  },
  // Multiplier: 1.2 for 20% increase, 0.8 for 20% discount
  priceMultiplier: {
    type: Number,
    required: true,
    default: 1.0,
  },
  minStay: {
    type: Number,
    default: 1,
  },
});

const PricingRule = mongoose.model("PricingRule", pricingRuleSchema);
export default PricingRule;
