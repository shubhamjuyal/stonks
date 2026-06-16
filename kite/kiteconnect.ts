import { KiteConnect } from 'kiteconnect';

const apiKey: string = process.env.zerodha_api_key || '';
const apiSecret: string = process.env.zerodha_api_secret || '';
const requestToken: string = process.env.zerodha_request_token || '';
const accessToken: string = process.env.zerodha_access_token || '';

const kc = new KiteConnect({ api_key: apiKey });
kc.setAccessToken(accessToken);


export async function buyStock(tradingsymbol: string, quantity: number) {
    try {
        const orderId = await kc.placeOrder('regular', {
            exchange: 'NSE',
            tradingsymbol,
            transaction_type: 'BUY',
            quantity,
            order_type: 'MARKET',
            product: 'CNC',
            validity: 'DAY',
        });
        console.log('Buy order placed:', orderId);
        return orderId;
    } catch (err) {
        console.error('Error placing buy order:', err);
        throw err;
    }
}

export async function sellStock(tradingsymbol: string, quantity: number) {
    try {
        const orderId = await kc.placeOrder('regular', {
            exchange: 'NSE',
            tradingsymbol,
            transaction_type: 'SELL',
            quantity,
            order_type: 'MARKET',
            product: 'CNC',
            validity: 'DAY',
        });
        console.log('Sell order placed:', orderId);
        return orderId;
    } catch (err) {
        console.error('Error placing sell order:', err);
        throw err;
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

async function getPositions() {
    try {
        const positions = await kc.getPositions();
        console.log('Positions:', positions);
    } catch (err) {
        console.error('Error getting positions:', err);
    }
}