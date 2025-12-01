import { registerAs } from '@nestjs/config';

export default registerAs('integrations', () => ({
  // DIDIT
  didit: {
    apiUrl: process.env.DIDIT_API_URL || 'https://api.didit.me/v1',
    apiKey: process.env.DIDIT_API_KEY,
    webhookSecret: process.env.DIDIT_WEBHOOK_SECRET,
  },

  // Futuras integraciones
  stripe: {
    apiKey: process.env.STRIPE_API_KEY,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
  },

  cregis: {
    apiUrl: process.env.CREGIS_API_URL,
    apiKey: process.env.CREGIS_API_KEY,
  },
}));
