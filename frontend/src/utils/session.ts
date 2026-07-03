const ACCESS_TOKEN_KEY = 'kvassettracker.accessToken';

export const tokenStore = {
  getAccessToken() {
    return window.localStorage.getItem(ACCESS_TOKEN_KEY);
  },
  setAccessToken(token: string) {
    window.localStorage.setItem(ACCESS_TOKEN_KEY, token);
  },
  clearAccessToken() {
    window.localStorage.removeItem(ACCESS_TOKEN_KEY);
  }
};

export const sessionEvents = {
  expired: 'kvassettracker:session-expired'
} as const;
