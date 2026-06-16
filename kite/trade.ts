import { KiteConnect } from 'kiteconnect';

const apiKey: string = process.env.zerodha_api_key || '';
const apiSecret: string = process.env.zerodha_api_secret || '';
const requestToken: string = process.env.zerodha_request_token || '';
const accessToken: string = process.env.zerodha_access_token || '';

const kc = new KiteConnect({ api_key: apiKey });
kc.setAccessToken(accessToken);

async function init() {
    try {
        // await generateSession();
        await getProfile();
    } catch (err) {
        console.error(err);
    }
}

async function generateSession() {
    try {
        const response = await kc.generateSession(requestToken, apiSecret);
        kc.setAccessToken(response.access_token);
        console.log('Session generated:', response);
    } catch (err) {
        console.error('Error generating session:', err);
    }
}

async function getProfile() {
    try {
        const profile = await kc.getProfile();
        console.log('Profile:', profile);
    } catch (err) {
        console.error('Error getting profile:', err);
    }
}

// Initialize the API calls
init();