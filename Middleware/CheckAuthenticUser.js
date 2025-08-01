function CheckAuthneticUser() {
  return (req, res) => {
    if (!req.user.userId) {
      return res.json({ error: "UNAUTHORIZED USER" });
    }
  };
}

function AllowOnlyUserModel() {
  if (req.user && req.user.userType === "userModel") {
    return next();
  }

  return res
    .status(403)
    .json({ error: "ONLY USERMODEL TYPE USERS ARE ALLOWED" });
}

function AllowOnlyGymModel(req, res, next) {
  if (req.user && req.user.userType === "gymModel") {
    return next();
  }

  return res
    .status(403)
    .json({ error: "ONLY GYMMODEL TYPE USERS ARE ALLOWED" });
}

module.exports = { CheckAuthneticUser, AllowOnlyUserModel, AllowOnlyGymModel };
