const sendSMS = async (to, message) => {
  console.warn(`[SMS stub] Would send to ${to}: ${message}`);
};

module.exports = { sendSMS };
