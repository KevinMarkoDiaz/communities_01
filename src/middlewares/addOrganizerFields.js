export function addOrganizerFields(req, res, next) {
  try {
    const isAdmin = req.user?.role === "admin";

    if (!isAdmin) {
      req.body.organizer = req.user._id;
      req.body.organizerModel =
        req.user.role === "business_owner" ? "Business" : "User";
    }

    next();
  } catch (error) {
    return res.status(500).json({
      msg: "Error al asignar campos de organizador",
      error: error.message,
    });
  }
}
