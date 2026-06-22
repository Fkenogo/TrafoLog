const axios = require('axios');
const User = require('../models/User');
const AuthService = require('./authService');
const { ApiError } = require('../utils/error');

class OAuthService {
  /**
   * Google OAuth login
   */
  async googleLogin(accessToken, userAgent, ipAddress) {
    try {
      // Get user info from Google
      const response = await axios.get('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      
      const { email, name, sub: googleId, email_verified } = response.data;
      
      // Find or create user
      let user = await User.findOne({ email });
      
      if (!user) {
        // Create new user
        user = new User({
          email,
          name,
          password: crypto.randomBytes(32).toString('hex'),
          email_verified: email_verified,
          role: 'Viewer',
          google_id: googleId
        });
        await user.save();
      } else {
        // Update google_id if not set
        if (!user.google_id) {
          user.google_id = googleId;
          await user.save();
        }
      }
      
      // Perform login
      const loginResult = await AuthService.login(
        email,
        user.password,
        userAgent,
        ipAddress
      );
      
      // We need to set password for OAuth users
      // In practice, you'd generate a random password and store it
      
      return loginResult;
      
    } catch (error) {
      throw new ApiError(401, 'Google authentication failed');
    }
  }
}

module.exports = new OAuthService();