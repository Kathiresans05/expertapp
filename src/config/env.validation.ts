import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  PORT: Joi.number().default(3000),
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test', 'provision')
    .default('development'),
    
  DB_HOST: Joi.string().default('aws-0-ap-south-1.pooler.supabase.com'),
  DB_PORT: Joi.number().default(6543),
  DB_USER: Joi.string().default('postgres.abwtqlobvpuytrczrvnj'),
  DB_PASSWORD: Joi.string().default('SDpozS3PtXXQkBic'),
  DB_NAME: Joi.string().default('postgres'),

  REDIS_HOST: Joi.string().default('flowing-gibbon-198025.upstash.io'),
  REDIS_PORT: Joi.number().default(6379),
  REDIS_PASSWORD: Joi.string().allow('').optional(),

  JWT_SECRET: Joi.string().default('supersecretkey123'),
  JWT_EXPIRATION: Joi.string().default('7d'),

  WS_PORT: Joi.number().default(3001),

  AGORA_APP_ID: Joi.string().allow('').optional().default('mock_agora_app_id'),
  AGORA_APP_CERTIFICATE: Joi.string().allow('').optional().default('mock_agora_cert'),

  R2_ACCOUNT_ID: Joi.string().allow('').optional().default('mock_r2_account'),
  R2_ACCESS_KEY_ID: Joi.string().allow('').optional().default('mock_r2_key'),
  R2_SECRET_ACCESS_KEY: Joi.string().allow('').optional().default('mock_r2_secret'),
  R2_BUCKET_NAME: Joi.string().allow('').optional().default('mock_r2_bucket'),
  R2_PUBLIC_URL: Joi.string().allow('').optional().default('https://mock.r2.dev'),

  FIREBASE_PROJECT_ID: Joi.string().allow('').optional(),
  FIREBASE_PRIVATE_KEY: Joi.string().allow('').optional(),
  FIREBASE_CLIENT_EMAIL: Joi.string().allow('').optional(),

  RAZORPAY_KEY_ID: Joi.string().default('rzp_test_TMsSHx6MC6SMoJ'),
  RAZORPAY_KEY_SECRET: Joi.string().default('4nUPFcDLnTw6oPiR1dCHP4k6'),
  STRIPE_SECRET_KEY: Joi.string().allow('').optional(),
  STRIPE_WEBHOOK_SECRET: Joi.string().allow('').optional(),

  OPENSEARCH_NODE: Joi.string().allow('').optional().default('http://localhost:9200'),
  OPENSEARCH_USERNAME: Joi.string().allow('').optional().default('admin'),
  OPENSEARCH_PASSWORD: Joi.string().allow('').optional().default('admin'),
});

