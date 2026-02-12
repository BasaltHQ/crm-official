
import axios from "axios";

const SURGE_API_BASE = "https://surge.basalthq.com/v1";

export interface SurgeChargeParams {
    vault_token: string;
    amount: number;
    currency?: string;
    token?: string; // e.g. "USDC"
    network?: string; // e.g. "base"
    recipient: string; // Merchant wallet
    description?: string;
}

export interface SurgeChargeResponse {
    success: boolean;
    transaction_id?: string;
    status: "success" | "pending" | "failed";
    error?: string;
}

/**
 * Checks the balance of a specific token for a wallet on a given network.
 */
export async function getWalletBalance(address: string, token: string = "USDC", network: string = "base"): Promise<number> {
    try {
        const apiKey = process.env.SURGE_API_KEY;
        const response = await axios.get(`${SURGE_API_BASE}/wallets/${address}/balance`, {
            params: { token, network },
            headers: { "Authorization": `Bearer ${apiKey}` }
        });
        return response.data.balance || 0;
    } catch (error) {
        console.error(`[SurgeBilling] Failed to fetch balance for ${address}:`, error);
        return 0;
    }
}

/**
 * Executes a direct crypto payment (Unified "Rain").
 */
export async function chargeFromWallet(params: {
    from_address: string;
    amount: number;
    token: string;
    network: string;
    recipient: string;
    description?: string;
}): Promise<SurgeChargeResponse> {
    try {
        const apiKey = process.env.SURGE_API_KEY;
        const response = await axios.post(`${SURGE_API_BASE}/payouts`, params, {
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json"
            }
        });
        return {
            success: true,
            transaction_id: response.data.id || response.data.transactionHash,
            status: "success"
        };
    } catch (error: any) {
        console.error("[SurgeBilling] Wallet Payout Failed:", error.response?.data || error.message);
        return {
            success: false,
            status: "failed",
            error: error.response?.data?.message || error.message
        };
    }
}

/**
 * Executes a charge against a vaulted card using Surge Rails.
 * This converts the fiat charge into a crypto payout on the Base network.
 */
export async function chargeVaultedCard(params: SurgeChargeParams): Promise<SurgeChargeResponse> {
    try {
        const apiKey = process.env.SURGE_API_KEY;
        if (!apiKey) {
            throw new Error("SURGE_API_KEY is not configured");
        }

        console.log(`[SurgeBilling] Initiating charge for ${params.amount} ${params.currency || 'USD'}...`);

        const response = await axios.post(`${SURGE_API_BASE}/billing/charge`, params, {
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json"
            }
        });

        return {
            success: true,
            transaction_id: response.data.id,
            status: "success"
        };

    } catch (error: any) {
        console.error("[SurgeBilling] Charge Failed:", error.response?.data || error.message);
        return {
            success: false,
            status: "failed",
            error: error.response?.data?.message || error.message
        };
    }
}
