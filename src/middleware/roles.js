export function authorize(...allowed) {
    return (req, res, next) => {
      if (!req.user?.role) return res.status(403).json({ message: 'Forbidden' });
      if (!allowed.includes(req.user.role)) {
        return res.status(403).json({ message: 'Forbidden' });
      }
      next();
    };
  }