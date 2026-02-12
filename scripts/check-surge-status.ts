
import axios from 'axios';
import https from 'https';

const apiKey = process.env.SURGE_API_KEY || '';
const receiptId = 'R-633574';
const baseUrl = 'https://surge.basalthq.com/api/receipts';

const httpsAgent = new https.Agent({
    rejectUnauthorized: false
});

async function main() {
    try {
        console.log(`Checking status for ${receiptId}...`);
        const response = await axios.get(`${baseUrl}/${receiptId}`, {
            headers: {
                'Ocp-Apim-Subscription-Key': apiKey
            },
            httpsAgent
        });
        console.log('Status Response:', JSON.stringify(response.data, null, 2));
    } catch (error: any) {
        console.error('Error:', error.response?.data || error.message);
    }
}

main();
