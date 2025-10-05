export const simpleLogger = (req, res, next) => {
  console.log("New request has been arrived");
  next();
};
