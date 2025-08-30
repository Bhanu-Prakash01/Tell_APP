// middleware/roles.js
module.exports = function (allowed = []) {
  // allowed can be a string or array
  if (typeof allowed === 'string') allowed = [allowed];
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    if (!allowed.includes(req.user.role)) return res.status(403).json({ error: 'Forbidden' });
    next();
  };
};
