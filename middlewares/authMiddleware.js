import jwt from "jsonwebtoken";

const authMiddleware = (req, res, next) => {
  try {
    const token = req.headers.Authorization.split(" ")[1];

    const decode = jwt.decode(token, process.env.JWT_SECRET);
    res.userData = decode;
    next();
  } catch (error) {
    return res.status(401).json({ message: "Autentifikatsiya amalga oshmadi" });
  }
};

export default authMiddleware;
