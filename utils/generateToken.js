import jwt from "jsonwebtoken";

const token = (id) => {
  const token = jwt.sign({ userId: id }, process.env.JWT_SECRET, {
    expiresIn: "30d",
  });
  return token;
};

export default token;
