const stub = new Proxy({}, {
  get(_, method) {
    return async (req, res) => res.status(501).json({ success: false, message: `adminController.${method} not yet implemented` });
  }
});
module.exports = stub;
