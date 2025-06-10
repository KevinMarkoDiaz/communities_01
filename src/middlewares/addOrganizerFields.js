// middlewares/addOrganizerFields.js
export function addOrganizerFields(req, res, next) {
  if (!req.body.organizer && req.user?.id) {
    req.body.organizer = req.user.id;
    req.body.organizerModel =
      req.user.role === "business_owner" ? "Business" : "User";
  }
  next();
}
