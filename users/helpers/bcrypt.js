import bcrypt from "bcryptjs";

const generatePassword = (password) => bcrypt.hashSync(password, 10);

const comparePassword = (password, hashPassword) =>
  bcrypt.compareSync(password, hashPassword);

export { generatePassword, comparePassword };
