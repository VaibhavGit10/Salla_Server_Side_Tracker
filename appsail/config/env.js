export const ENV = {
  PORT: process.env.PORT || 3000,

  NODE_ENV: process.env.NODE_ENV || "development",

  SALLA: {
    CLIENT_ID: process.env.SALLA_CLIENT_ID,
    CLIENT_SECRET: process.env.SALLA_CLIENT_SECRET,
    CALLBACK_URL: `${process.env.APP_BASE_URL}/oauth/callback`
  },

  SECURITY: {
    ENCRYPTION_KEY: process.env.ENCRYPTION_KEY
  }
};
