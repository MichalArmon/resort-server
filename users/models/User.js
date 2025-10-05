import { model, Schema } from "mongoose";
import { EMAIL, PHONE } from "../../helpers/mongooseValidators.js";
import { Address } from "../../helpers/submodels/Address.js";
import { Image } from "../../helpers/submodels/Image.js";
import { Name } from "../../helpers/submodels/Name.js";

const userSchema = new Schema({
  name: Name,
  phone: PHONE,
  email: EMAIL,
  password: {
    type: String,
    required: true,
    trim: true,
  },
  image: Image,
  address: Address,
  isAdmin: { type: Boolean, default: false },
  isBusiness: { type: Boolean, default: false },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const User = model("user", userSchema);

export default User;
