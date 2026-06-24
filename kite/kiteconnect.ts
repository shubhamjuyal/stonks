import { KiteConnect } from 'kiteconnect';

const apiKey: string = process.env.zerodha_api_key || '';
const apiSecret: string = process.env.zerodha_api_secret || '';
const requestToken: string = process.env.zerodha_request_token || '';
const accessToken: string = process.env.zerodha_access_token || '';

const kc = new KiteConnect({ api_key: apiKey });
kc.setAccessToken(accessToken);


// Zerodha rejects plain MARKET orders via the API ("Market orders without market
// protection are not allowed"). Passing market_protection satisfies that rule
// without needing quote data (this account lacks LTP/quote permission, so a
// priced LIMIT order isn't an option). -1 = automatic protection per Kite's
// market guidelines. The kiteconnect types don't declare this field, so the
// params object is widened to allow it; the client forwards it to the API.
const MARKET_PROTECTION = -1;

// NSE trading hours
const NSE_OPEN_HOUR = 9;
const NSE_CLOSE_HOUR = 15;

// kiteconnect v5+ returns { order_id, children? } instead of a bare id.
function extractOrderId(result: unknown): string | number {
    if (result !== null && typeof result === "object" && "order_id" in result) {
        return (result as { order_id: string | number }).order_id;
    }
    if (typeof result === "string" || typeof result === "number") {
        return result;
    }
    throw new Error(`Unexpected placeOrder response: ${JSON.stringify(result)}`);
}

function getOrderType(): string {
    const currentHour = new Date().getHours();
    return (currentHour < NSE_OPEN_HOUR || currentHour >= NSE_CLOSE_HOUR) ? 'amo' : 'regular';
}

export async function buyStock(tradingsymbol: string, quantity: number) {
    try {
        const orderType = getOrderType();
        const response = await kc.placeOrder(orderType, {
            exchange: 'NSE',
            tradingsymbol,
            transaction_type: 'BUY',
            quantity,
            order_type: 'MARKET',
            product: 'CNC',
            validity: 'DAY',
            market_protection: MARKET_PROTECTION,
        } as Parameters<typeof kc.placeOrder>[1]);
        const orderId = extractOrderId(response);
        console.log('Buy order placed:', orderId);
        return orderId;
    } catch (err) {
        console.error('Error placing buy order:', err);
        throw err;
    }
}

export async function sellStock(tradingsymbol: string, quantity: number) {
    try {
        const orderType = getOrderType();
        const response = await kc.placeOrder(orderType, {
            exchange: 'NSE',
            tradingsymbol,
            transaction_type: 'SELL',
            quantity,
            order_type: 'MARKET',
            product: 'CNC',
            validity: 'DAY',
            market_protection: MARKET_PROTECTION,
        } as Parameters<typeof kc.placeOrder>[1]);
        const orderId = extractOrderId(response);
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

export async function getPositions() {
    try {
        const positions = await kc.getPositions();
        console.log('Positions:', positions);
        return positions;
    } catch (err) {
        console.error('Error getting positions:', err);
    }
}