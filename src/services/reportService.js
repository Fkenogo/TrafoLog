module.exports = new Proxy({}, {
  get(_, method) {
    return async (...args) => {
      throw new Error(`reportService.${String(method)} not yet implemented`);
    };
  }
});
