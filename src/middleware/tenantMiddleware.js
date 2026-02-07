module.exports = (req, res, next) => {
  if (req.user) {
    // prefer explicit organizationId, fallback to salonId (Prisma users)
    req.organizationId = req.user.organizationId || req.user.salonId || req.user.organization || null;
  }
  next();
};
