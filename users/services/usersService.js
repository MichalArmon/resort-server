import _ from "lodash";
import { generateToken } from "../../auth/providers/jwtProvider.js";
import { comparePassword, generatePassword } from "../helpers/bcrypt.js";
import { createUser, getUserByEmail } from "./usersDataService.js";

export const createNewUser = async (user) => {
  try {
    let hashPass = generatePassword(user.password);
    user.password = hashPass;
    const newUser = await createUser(user);
    const DTOuser = _.pick(newUser, ["email", "name", "_id"]);
    return DTOuser;
  } catch (error) {
    throw new Error(error.message);
  }
};

export const login = async (email, password) => {
  try {
    const user = await getUserByEmail(email);
    if (comparePassword(password, user?.password)) {
      return generateToken(user);
    }
    throw new Error("password incorrect");
  } catch (error) {
    throw new Error(error.message);
  }
};
