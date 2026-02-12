
/**
 * UCP (Universal Commerce Protocol) - Simplified Adaptation
 * 
 * Standard Schema for Agent-Readable Product Catalog and Orders.
 * Based on Schema.org and JSON-LD principles.
 */

export interface UCPProduct {
    "@context": "https://schema.org";
    "@type": "Product";
    name: string;
    description: string;
    image?: string;
    sku: string;
    offers: {
        "@type": "Offer";
        price: string;
        priceCurrency: string; // "USD", "USDC"
        availability: "https://schema.org/InStock" | "https://schema.org/OutOfStock";
    };
}

export interface UCPOrderIntent {
    "@context": "https://ucp.network/v1";
    "@type": "OrderIntent";
    buyerId: string; // DID or Wallet
    items: Array<{
        sku: string;
        quantity: number;
    }>;
    payment: {
        method: "x402" | "base-pay" | "classic";
        maxAmount: string;
    };
}

/**
 * Transforms an Invoice or Product into a UCP-compliant JSON-LD object.
 */
export function toUCPProduct(invoiceItem: any): UCPProduct {
    return {
        "@context": "https://schema.org",
        "@type": "Product",
        name: invoiceItem.description || "Service Charge",
        description: `Invoice item #${invoiceItem.id}`,
        sku: invoiceItem.id,
        offers: {
            "@type": "Offer",
            price: String(invoiceItem.amount || 0),
            priceCurrency: "USD",
            availability: "https://schema.org/InStock"
        }
    };
}
