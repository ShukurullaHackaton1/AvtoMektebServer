import jwt from "jsonwebtoken";

const auth = async (req, res, next) => {
  try {
    const token = req.header("Authorization")?.replace("Bearer ", "");

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Token topilmadi, ruxsat berilmadi",
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    req.userData = decoded;
    next();
  } catch (error) {
    console.error("Auth middleware error:", error);
    res.status(401).json({
      success: false,
      message: "Token yaroqsiz",
    });
  }
};

export default auth;
