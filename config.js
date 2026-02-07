import dotenv from 'dotenv';
import {fileURLToPath} from 'url';
import path from 'path';

const __filename=fileURLToPath(import.meta.url);
const __dirname=path.dirname(__filename);

// Load environment variables FIRST before anything else
dotenv.config({path: path.join(__dirname, '.env')});

// Verify critical env vars
if (!process.env.GROQ_API_KEY)
{
    console.warn('⚠️  Warning: GROQ_API_KEY not found in .env file');
    console.warn('   Get your free API key from https://console.groq.com/keys');
} else
{
    console.log('✅ GROQ_API_KEY loaded successfully');
}

export default {
    PORT: process.env.PORT||8080,
    FRONTEND_URL: process.env.FRONTEND_URL||'http://localhost:5173',
    GROQ_API_KEY: process.env.GROQ_API_KEY,
};
