"use server";

import { prismadb } from "@/lib/prisma";
import { getSessionAndTeam, validateResourceOwnership } from "@/lib/api-utils";
import { decryptSecret } from "@/lib/encryption";
import { safeFetch } from "@/lib/security/ssrf-guard";
import { revalidatePath } from "next/cache";
import { systemLogger } from "@/lib/logger";

export async function getProducts() {
    try {
        const { error, session, teamInfo } = await getSessionAndTeam();
        if (error || !session?.user?.id || !teamInfo?.teamId) return [];

        const products = await prismadb.crm_Products.findMany({
            where: {
                team_id: teamInfo.teamId,
                active: true,
            },
            include: {
                bundles: {
                    include: {
                        childProduct: true
                    }
                }
            },
            orderBy: {
                name: "asc",
            },
        });

        return products;
    } catch (error) {
        systemLogger.error("[GET_PRODUCTS]", error);
        return [];
    }
}

export async function createProduct(data: {
    name: string;
    sku: string;
    description?: string;
    price: number;
    costPrice?: number;
    taxRate?: number;
    category?: string;
    brand?: string;
    model?: string;
    stock?: number;
    weight?: number;
    width?: number;
    height?: number;
    length?: number;
    isDigital?: boolean;
    imageUrl?: string;
    tags?: string[];
    taxable?: boolean;
    jurisdictionCode?: string;
    attributes?: any;
    industryPack?: string;
    currency?: string;
    ownerWallet?: string;
    isBook?: boolean;
    allowDownload?: boolean;
    drmEnabled?: boolean;
    isSubscription?: boolean;
    shippingEnabled?: boolean;
    shippingConfig?: any;
}) {
    try {
        const { error, session, teamInfo } = await getSessionAndTeam();
        if (error || !session?.user?.id || !teamInfo?.teamId) return { success: false };

        const teamId = teamInfo.teamId;
        const { id: _id, team_id: _teamId, ...safeData } = data as any;

        const newProduct = await prismadb.crm_Products.create({
            data: {
                ...safeData,
                team_id: teamId,
            },
        });

        // Fetch integration config once for all sync checks
        const integration = await prismadb.tenant_Integrations.findUnique({
            where: { tenant_id: teamId }
        });

        const syncResults: string[] = [];
        const surgeApiKey = decryptSecret(integration?.surge_api_key);
        const shopifyAccessToken = decryptSecret(integration?.shopify_access_token);
        const wooConsumerKey = decryptSecret(integration?.woocommerce_consumer_key);
        const wooConsumerSecret = decryptSecret(integration?.woocommerce_consumer_secret);

        // Auto-sync to Surge if linked
        if (integration?.surge_enabled && surgeApiKey) {
            const result = await syncProductToSurge(newProduct, surgeApiKey);
            if (result) syncResults.push("Surge");
        }

        // Auto-sync to Shopify if linked
        if (integration?.shopify_enabled && shopifyAccessToken && integration?.shopify_store_url) {
            const result = await syncProductToShopify(newProduct, integration.shopify_store_url, shopifyAccessToken);
            if (result) syncResults.push("Shopify");
        }

        // Auto-sync to WooCommerce if linked
        if (integration?.woocommerce_enabled && wooConsumerKey && wooConsumerSecret && integration?.woocommerce_store_url) {
            const result = await syncProductToWooCommerce(newProduct, integration.woocommerce_store_url, wooConsumerKey, wooConsumerSecret);
            if (result) syncResults.push("WooCommerce");
        }

        revalidatePath("/crm/products");
        return { success: true, syncedTo: syncResults };
    } catch (error) {
        systemLogger.error("[CREATE_PRODUCT]", error);
        return { success: false };
    }
}

// Helper: check if a URL is from Surge's S3 bucket (not ours)
function isSurgeHostedUrl(url: string): boolean {
    return url.includes("basaltsurge") && (url.includes("s3") || url.includes("ovh.us"));
}

// Helper: check if a URL is from our CRM S3 bucket
function isCrmHostedUrl(url: string): boolean {
    return url.includes("basaltcrm") && (url.includes("s3") || url.includes("ovh.us"));
}

// Helper: resolve a product image to a data URL for Surge's images[] array
// Returns undefined if the image is already on Surge (no re-upload needed)
async function resolveImageForSurge(product: any): Promise<string[] | undefined> {
    // If we have the original Surge data URL cached, use it directly — no fetch needed
    if (product.surgeImageData) {
        return [product.surgeImageData];
    }

    if (!product.imageUrl) return undefined;

    // If this image is already hosted on Surge, Surge already has it — don't touch
    if (isSurgeHostedUrl(product.imageUrl)) {
        return undefined;
    }

    try {
        // Already a data URL — pass through directly
        if (product.imageUrl.startsWith("data:")) {
            return [product.imageUrl];
        }

        if (product.imageUrl.startsWith("http")) {
            let fetchUrl = product.imageUrl;
            // Presign if from our own private S3
            if (isCrmHostedUrl(fetchUrl)) {
                const { getBlobServiceClient } = await import("@/lib/s3-storage");
                const key = new URL(product.imageUrl).pathname.substring(1);
                fetchUrl = await getBlobServiceClient().getPresignedUrl(key);
            }

            // Fetch and convert to data URL via SSRF-safe fetch
            const imgRes = await safeFetch(fetchUrl);
            if (imgRes.ok) {
                const arrayBuffer = await imgRes.arrayBuffer();
                const buffer = Buffer.from(arrayBuffer);
                const contentType = imgRes.headers.get("content-type") || "image/jpeg";
                const base64 = buffer.toString("base64");
                return [`data:${contentType};base64,${base64}`];
            }
        }
    } catch (e) {
        systemLogger.error("[SURGE_IMAGE_RESOLVE_ERROR]", e);
    }
    return undefined;
}

// Helper: push product data to Surge API
async function syncProductToSurge(product: any, apiKey: string) {
    try {
        const surgeImages = await resolveImageForSurge(product);

        const surgeBody: any = {
            id: product.surge_id || undefined,
            sku: product.sku,
            name: product.name,
            priceUsd: product.price,
            stockQty: product.stock,
            category: product.category || undefined,
            description: product.description || undefined,
            tags: product.tags,
            costUsd: product.costPrice || undefined,
            taxable: product.taxable,
            jurisdictionCode: product.jurisdictionCode || undefined,
            attributes: product.attributes || undefined,
            industryPack: product.industryPack || undefined,
            currency: product.currency || "USD",
            wallet: product.ownerWallet || undefined,
            isBook: product.isBook || false,
            allowDownload: product.allowDownload || false,
            drmEnabled: product.drmEnabled || false,
            shippingEnabled: product.shippingEnabled || false,
            shippingConfig: product.shippingConfig || undefined
        };

        // Only include images if we have new ones to push — omitting preserves existing Surge images
        if (surgeImages) {
            surgeBody.images = surgeImages;
        }

        const response = await fetch("https://surge.basalthq.com/api/inventory", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Ocp-Apim-Subscription-Key": apiKey
            },
            body: JSON.stringify(surgeBody)
        });

        if (!response.ok) return null;

        const result = await response.json();

        // Store surge_id if this was a new push
        if (!product.surge_id && result.id) {
            await prismadb.crm_Products.update({
                where: { id: product.id },
                data: { surge_id: result.id }
            });
        }

        return result;
    } catch (error) {
        systemLogger.error("[SYNC_TO_SURGE]", error);
        return null;
    }
}

// Helper: push product data to Shopify Admin REST API
async function syncProductToShopify(product: any, storeUrl: string, accessToken: string) {
    try {
        const cleanUrl = storeUrl.replace(/^https?:\/\//, "").replace(/\/$/, "");

        const shopifyBody = {
            product: {
                id: product.shopify_id ? parseInt(product.shopify_id) : undefined,
                title: product.name,
                body_html: product.description || "",
                vendor: product.brand || undefined,
                product_type: product.category || undefined,
                tags: (product.tags || []).join(", "),
                variants: [{
                    price: product.price.toString(),
                    sku: product.sku,
                    inventory_quantity: product.stock,
                    weight: product.weight || 0,
                    taxable: product.taxable
                }]
            }
        };

        const method = product.shopify_id ? "PUT" : "POST";
        const endpoint = product.shopify_id
            ? `https://${cleanUrl}/admin/api/2024-01/products/${product.shopify_id}.json`
            : `https://${cleanUrl}/admin/api/2024-01/products.json`;

        const response = await safeFetch(endpoint, {
            method,
            headers: {
                "Content-Type": "application/json",
                "X-Shopify-Access-Token": accessToken
            },
            body: JSON.stringify(shopifyBody)
        });

        if (!response.ok) return null;

        const result = await response.json();

        // Store shopify_id if this was a new push
        if (!product.shopify_id && result.product?.id) {
            await prismadb.crm_Products.update({
                where: { id: product.id },
                data: { shopify_id: result.product.id.toString() }
            });
        }

        return result;
    } catch (error) {
        systemLogger.error("[SYNC_TO_SHOPIFY]", error);
        return null;
    }
}

// Helper: push product data to WooCommerce REST API v3
async function syncProductToWooCommerce(product: any, storeUrl: string, consumerKey: string, consumerSecret: string) {
    try {
        const cleanUrl = storeUrl.replace(/\/$/, "");
        const authHeader = "Basic " + Buffer.from(`${consumerKey}:${consumerSecret}`).toString("base64");

        const wooBody: any = {
            name: product.name,
            regular_price: product.price.toString(),
            description: product.description || "",
            short_description: product.description || "",
            sku: product.sku,
            stock_quantity: product.stock,
            manage_stock: true,
            weight: product.weight?.toString() || "",
            virtual: product.isDigital || false,
            tax_status: product.taxable ? "taxable" : "none",
            tags: (product.tags || []).map((t: string) => ({ name: t })),
            categories: product.category ? [{ name: product.category }] : []
        };

        const method = product.woo_id ? "PUT" : "POST";
        const endpoint = product.woo_id
            ? `${cleanUrl}/wp-json/wc/v3/products/${product.woo_id}`
            : `${cleanUrl}/wp-json/wc/v3/products`;

        const response = await safeFetch(endpoint, {
            method,
            headers: {
                "Content-Type": "application/json",
                "Authorization": authHeader
            },
            body: JSON.stringify(wooBody)
        });

        if (!response.ok) return null;

        const result = await response.json();

        // Store woo_id if this was a new push
        if (!product.woo_id && result.id) {
            await prismadb.crm_Products.update({
                where: { id: product.id },
                data: { woo_id: result.id.toString() }
            });
        }

        return result;
    } catch (error) {
        systemLogger.error("[SYNC_TO_WOOCOMMERCE]", error);
        return null;
    }
}

export async function updateProduct(productId: string, data: {
    name?: string;
    sku?: string;
    description?: string;
    price?: number;
    costPrice?: number;
    taxRate?: number;
    category?: string;
    brand?: string;
    model?: string;
    stock?: number;
    weight?: number;
    width?: number;
    height?: number;
    length?: number;
    isDigital?: boolean;
    imageUrl?: string;
    tags?: string[];
    taxable?: boolean;
    jurisdictionCode?: string;
    attributes?: any;
    industryPack?: string;
    currency?: string;
    ownerWallet?: string;
    isBook?: boolean;
    allowDownload?: boolean;
    drmEnabled?: boolean;
    isSubscription?: boolean;
    shippingEnabled?: boolean;
    shippingConfig?: any;
}) {
    try {
        const { error, session, teamInfo } = await getSessionAndTeam();
        if (error || !session?.user?.id || !teamInfo?.teamId) return { success: false };

        const existingProduct = await prismadb.crm_Products.findUnique({
            where: { id: productId },
            select: { id: true, team_id: true },
        });
        if (!existingProduct || !validateResourceOwnership(teamInfo.teamId, existingProduct.team_id, teamInfo.isPlatformAdmin)) {
            return { success: false };
        }

        const teamId = existingProduct.team_id || teamInfo.teamId;
        const { id: _id, team_id: _teamId, ...safeData } = data as any;

        const updated = await prismadb.crm_Products.update({
            where: { id: productId },
            data: safeData
        });

        // Fetch integration config once for all sync checks
        const integration = await prismadb.tenant_Integrations.findUnique({
            where: { tenant_id: teamId }
        });

        const syncResults: string[] = [];
        const surgeApiKey = decryptSecret(integration?.surge_api_key);
        const shopifyAccessToken = decryptSecret(integration?.shopify_access_token);
        const wooConsumerKey = decryptSecret(integration?.woocommerce_consumer_key);
        const wooConsumerSecret = decryptSecret(integration?.woocommerce_consumer_secret);

        // Auto-sync to Surge if linked
        if (updated.surge_id && integration?.surge_enabled && surgeApiKey) {
            const result = await syncProductToSurge(updated, surgeApiKey);
            if (result) syncResults.push("Surge");
        }

        // Auto-sync to Shopify if linked
        if (updated.shopify_id && integration?.shopify_enabled && shopifyAccessToken && integration?.shopify_store_url) {
            const result = await syncProductToShopify(updated, integration.shopify_store_url, shopifyAccessToken);
            if (result) syncResults.push("Shopify");
        }

        // Auto-sync to WooCommerce if linked
        if (updated.woo_id && integration?.woocommerce_enabled && wooConsumerKey && wooConsumerSecret && integration?.woocommerce_store_url) {
            const result = await syncProductToWooCommerce(updated, integration.woocommerce_store_url, wooConsumerKey, wooConsumerSecret);
            if (result) syncResults.push("WooCommerce");
        }

        revalidatePath("/crm/products");
        return { success: true, syncedTo: syncResults };
    } catch (error) {
        systemLogger.error("[UPDATE_PRODUCT]", error);
        return { success: false };
    }
}

export async function deleteProduct(productId: string, deleteFromSurge: boolean = true) {
    try {
        const { error, session, teamInfo } = await getSessionAndTeam();
        if (error || !session?.user?.id || !teamInfo?.teamId) return { success: false, error: "Unauthorized" };

        const product = await prismadb.crm_Products.findUnique({
            where: { id: productId }
        });

        if (!product || !validateResourceOwnership(teamInfo.teamId, product.team_id, teamInfo.isPlatformAdmin)) {
            return { success: false, error: "Product not found" };
        }

        const teamId = product.team_id || teamInfo.teamId;
        let surgeDeleted = false;

        // Only delete from Surge if explicitly requested and product is synced
        if (deleteFromSurge && product.surge_id) {
            try {
                const integration = await prismadb.tenant_Integrations.findUnique({
                    where: { tenant_id: teamId }
                });
                const surgeApiKey = decryptSecret(integration?.surge_api_key);

                if (integration?.surge_enabled && surgeApiKey) {
                    const response = await fetch(`https://surge.basalthq.com/api/inventory?id=${encodeURIComponent(product.surge_id)}`, {
                        method: "DELETE",
                        headers: {
                            "Ocp-Apim-Subscription-Key": surgeApiKey
                        }
                    });

                    if (!response.ok) {
                        const errText = await response.text().catch(() => "");
                        systemLogger.error("[DELETE_FROM_SURGE]", `Failed (${response.status}): ${errText}`);
                    } else {
                        surgeDeleted = true;
                    }
                }
            } catch (surgeErr) {
                systemLogger.error("[DELETE_FROM_SURGE]", surgeErr);
            }
        }

        // Delete locally (hard delete including bundle relations)
        await prismadb.crm_ProductBundles.deleteMany({
            where: {
                OR: [
                    { parentProductId: productId },
                    { childProductId: productId }
                ]
            }
        });

        await prismadb.crm_Products.delete({
            where: { id: productId }
        });

        revalidatePath("/crm/products");
        return { success: true, deletedFromSurge: surgeDeleted };
    } catch (error) {
        systemLogger.error("[DELETE_PRODUCT]", error);
        return { success: false, error: "Failed to delete product" };
    }
}

export async function getSurgeTaxCatalog() {
    try {
        const { error, session, teamInfo } = await getSessionAndTeam();
        if (error || !session?.user?.id || !teamInfo?.teamId) return { jurisdictions: [] };

        const teamId = teamInfo.teamId;
        const integration = await prismadb.tenant_Integrations.findUnique({
            where: { tenant_id: teamId }
        });
        const surgeApiKey = decryptSecret(integration?.surge_api_key);

        if (!integration?.surge_enabled || !surgeApiKey) {
            return { jurisdictions: [] };
        }

        const response = await fetch("https://surge.basalthq.com/api/tax/catalog", {
            headers: {
                "Ocp-Apim-Subscription-Key": surgeApiKey
            }
        });

        if (!response.ok) return { jurisdictions: [] };

        return await response.json();
    } catch (error) {
        systemLogger.error("[GET_SURGE_TAX]", error);
        return { jurisdictions: [] };
    }
}

export async function importFromSurge() {
    try {
        const { error, session, teamInfo } = await getSessionAndTeam();
        if (error || !session?.user?.id || !teamInfo?.teamId) return { success: false, error: "Unauthorized" };

        const teamId = teamInfo.teamId;
        const integration = await prismadb.tenant_Integrations.findUnique({
            where: { tenant_id: teamId }
        });
        const surgeApiKey = decryptSecret(integration?.surge_api_key);

        if (!integration?.surge_enabled || !surgeApiKey) {
            return { success: false, error: "Surge integration not configured" };
        }

        const response = await fetch("https://surge.basalthq.com/api/inventory", {
            headers: {
                "Ocp-Apim-Subscription-Key": surgeApiKey
            }
        });

        if (!response.ok) {
            throw new Error(`Surge API error: ${response.statusText}`);
        }

        const data = await response.json();
        const surgeItems = data.items || [];

        let importedCount = 0;
        let updatedCount = 0;

        for (const item of surgeItems) {
            // Resolve image: data URLs get uploaded to our S3, HTTP URLs stored directly
            const surgeImageSrc = item.images?.[0] || undefined;
            let resolvedImageUrl: string | undefined = undefined;
            let surgeImageData: string | undefined = undefined;

            if (surgeImageSrc) {
                if (surgeImageSrc.startsWith("data:")) {
                    // Keep the original data URL for sync operations
                    surgeImageData = surgeImageSrc;
                    // Upload to our S3 for reliable display
                    try {
                        const base64Match = surgeImageSrc.match(/^data:([^;]+);base64,(.+)$/);
                        if (base64Match) {
                            const mimeType = base64Match[1];
                            const buffer = Buffer.from(base64Match[2], "base64");
                            const ext = mimeType.split("/")[1] || "jpg";
                            const key = `uploads/${teamId}/${Date.now()}_${item.sku}.${ext}`;
                            const { getBlobServiceClient } = await import("@/lib/s3-storage");
                            const s3 = getBlobServiceClient();
                            const container = s3.getContainerClient(process.env.S3_BUCKET_NAME || "basaltcrm");
                            const blobClient = container.getBlockBlobClient(key);
                            await blobClient.uploadData(buffer, {
                                blobHTTPHeaders: { blobContentType: mimeType }
                            });
                            resolvedImageUrl = blobClient.url;
                        }
                    } catch (imgErr) {
                        systemLogger.error(`[IMPORT_SURGE_IMAGE] S3 upload failed for ${item.sku}:`, imgErr);
                    }
                } else if (surgeImageSrc.startsWith("http")) {
                    // Surge S3 URLs are accessible directly
                    resolvedImageUrl = surgeImageSrc;
                }
            }

            const existingProduct = await prismadb.crm_Products.findFirst({
                where: {
                    OR: [
                        { surge_id: item.id },
                        { sku: item.sku }
                    ],
                    team_id: teamId
                }
            });

            if (existingProduct) {
                await prismadb.crm_Products.update({
                    where: { id: existingProduct.id },
                    data: {
                        name: item.name,
                        price: item.priceUsd,
                        description: item.description,
                        category: item.category,
                        stock: item.stockQty,
                        costPrice: item.costUsd,
                        tags: item.tags || [],
                        surge_id: item.id,
                        taxable: item.taxable ?? true,
                        jurisdictionCode: item.jurisdictionCode,
                        // Prefer existing CRM image, only use Surge image if no local image exists
                        imageUrl: existingProduct.imageUrl || resolvedImageUrl || undefined,
                        surgeImageData: surgeImageData || existingProduct.surgeImageData || undefined,
                        industryPack: item.industryPack || undefined,
                        attributes: item.attributes || undefined,
                        currency: item.currency || "USD",
                        ownerWallet: item.wallet || undefined,
                        isBook: item.isBook || false,
                        allowDownload: item.allowDownload || false,
                        drmEnabled: item.drmEnabled || false,
                        shippingEnabled: item.shippingEnabled || false,
                        shippingConfig: item.shippingConfig || undefined
                    }
                });
                updatedCount++;
            } else {
                await prismadb.crm_Products.create({
                    data: {
                        name: item.name,
                        sku: item.sku,
                        price: item.priceUsd,
                        description: item.description,
                        category: item.category,
                        stock: item.stockQty,
                        costPrice: item.costUsd,
                        tags: item.tags || [],
                        surge_id: item.id,
                        taxable: item.taxable ?? true,
                        jurisdictionCode: item.jurisdictionCode,
                        imageUrl: resolvedImageUrl || undefined,
                        surgeImageData: surgeImageData || undefined,
                        industryPack: item.industryPack || undefined,
                        attributes: item.attributes || undefined,
                        currency: item.currency || "USD",
                        ownerWallet: item.wallet || undefined,
                        isBook: item.isBook || false,
                        allowDownload: item.allowDownload || false,
                        drmEnabled: item.drmEnabled || false,
                        shippingEnabled: item.shippingEnabled || false,
                        shippingConfig: item.shippingConfig || undefined,
                        team_id: teamId
                    }
                });
                importedCount++;
            }
        }

        revalidatePath("/crm/products");
        return { success: true, importedCount, updatedCount };
    } catch (error) {
        systemLogger.error("[IMPORT_FROM_SURGE]", error);
        return { success: false, error: "Failed to import from Surge" };
    }
}

export async function exportToSurge(productId: string) {
    try {
        const { error, session, teamInfo } = await getSessionAndTeam();
        if (error || !session?.user?.id || !teamInfo?.teamId) return { success: false, error: "Unauthorized" };

        const product = await prismadb.crm_Products.findUnique({
            where: { id: productId }
        });

        if (!product || !validateResourceOwnership(teamInfo.teamId, product.team_id, teamInfo.isPlatformAdmin)) {
            return { success: false, error: "Product not found" };
        }

        const teamId = product.team_id || teamInfo.teamId;
        const integration = await prismadb.tenant_Integrations.findUnique({
            where: { tenant_id: teamId }
        });
        const surgeApiKey = decryptSecret(integration?.surge_api_key);

        if (!integration?.surge_enabled || !surgeApiKey) {
            return { success: false, error: "Surge integration not configured" };
        }

        const surgeImages = await resolveImageForSurge(product);

        const surgeBody: any = {
            id: product.surge_id || undefined,
            sku: product.sku,
            name: product.name,
            priceUsd: product.price,
            stockQty: product.stock,
            category: product.category || undefined,
            description: product.description || undefined,
            tags: product.tags,
            costUsd: product.costPrice || undefined,
            taxable: product.taxable,
            jurisdictionCode: product.jurisdictionCode || undefined,
            attributes: product.attributes || undefined,
            industryPack: product.industryPack || undefined,
            currency: product.currency || "USD",
            wallet: product.ownerWallet || undefined,
            isBook: product.isBook || false,
            allowDownload: product.allowDownload || false,
            drmEnabled: product.drmEnabled || false,
            shippingEnabled: product.shippingEnabled || false,
            shippingConfig: product.shippingConfig || undefined
        };

        // Only include images if we have new ones to push — omitting preserves existing Surge images
        if (surgeImages) {
            surgeBody.images = surgeImages;
        }

        const response = await fetch("https://surge.basalthq.com/api/inventory", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Ocp-Apim-Subscription-Key": surgeApiKey
            },
            body: JSON.stringify(surgeBody)
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || `Surge API error: ${response.statusText}`);
        }

        const result = await response.json();

        // Update product with surge_id if it was a new creation
        if (!product.surge_id && result.id) {
            await prismadb.crm_Products.update({
                where: { id: product.id },
                data: { surge_id: result.id }
            });
        }

        revalidatePath("/crm/products");
        return { success: true };
    } catch (error) {
        systemLogger.error("[EXPORT_TO_SURGE]", error);
        return { success: false, error: "Failed to export to Surge" };
    }
}

// Returns which e-commerce integrations are enabled (no secrets exposed)
export async function getEnabledIntegrations() {
    try {
        const { error, session, teamInfo } = await getSessionAndTeam();
        if (error || !session?.user?.id || !teamInfo?.teamId) return { surge: false, shopify: false, woocommerce: false };

        const teamId = teamInfo.teamId;
        const integration = await prismadb.tenant_Integrations.findUnique({
            where: { tenant_id: teamId }
        });

        return {
            surge: !!(integration?.surge_enabled && integration?.surge_api_key),
            shopify: !!(integration?.shopify_enabled && integration?.shopify_access_token),
            woocommerce: !!(integration?.woocommerce_enabled && integration?.woocommerce_consumer_key),
        };
    } catch (error) {
        systemLogger.error("[GET_ENABLED_INTEGRATIONS]", error);
        return { surge: false, shopify: false, woocommerce: false };
    }
}

export async function importFromShopify() {
    try {
        const { error, session, teamInfo } = await getSessionAndTeam();
        if (error || !session?.user?.id || !teamInfo?.teamId) return { success: false, error: "Unauthorized" };

        const teamId = teamInfo.teamId;
        const integration = await prismadb.tenant_Integrations.findUnique({
            where: { tenant_id: teamId }
        });
        const shopifyAccessToken = decryptSecret(integration?.shopify_access_token);

        if (!integration?.shopify_enabled || !shopifyAccessToken || !integration?.shopify_store_url) {
            return { success: false, error: "Shopify integration not configured. Go to Admin → Integrations to set it up." };
        }

        // Shopify Admin REST API — GET products
        const storeUrl = integration.shopify_store_url.replace(/^https?:\/\//, "").replace(/\/$/, "");
        const response = await safeFetch(`https://${storeUrl}/admin/api/2024-01/products.json?limit=250`, {
            headers: {
                "X-Shopify-Access-Token": shopifyAccessToken
            }
        });

        if (!response.ok) {
            const errBody = await response.text().catch(() => "");
            throw new Error(`Shopify API error (${response.status}): ${errBody}`);
        }

        const data = await response.json();
        const shopifyProducts = data.products || [];

        let importedCount = 0;
        let updatedCount = 0;

        for (const item of shopifyProducts) {
            const sku = item.variants?.[0]?.sku || `shopify-${item.id}`;
            const price = parseFloat(item.variants?.[0]?.price || "0");
            const stock = item.variants?.[0]?.inventory_quantity || 0;
            const weight = item.variants?.[0]?.weight ? parseFloat(item.variants[0].weight) : undefined;
            const tags = item.tags ? item.tags.split(",").map((t: string) => t.trim()).filter(Boolean) : [];
            const imageUrl = item.image?.src || item.images?.[0]?.src || undefined;

            const existingProduct = await prismadb.crm_Products.findFirst({
                where: {
                    OR: [{ sku }],
                    team_id: teamId
                }
            });

            if (existingProduct) {
                await prismadb.crm_Products.update({
                    where: { id: existingProduct.id },
                    data: {
                        name: item.title,
                        price,
                        description: item.body_html?.replace(/<[^>]*>/g, "") || undefined,
                        category: item.product_type || undefined,
                        brand: item.vendor || undefined,
                        stock,
                        weight,
                        tags,
                        taxable: item.variants?.[0]?.taxable ?? true,
                        shopify_id: item.id.toString(),
                        imageUrl,
                    }
                });
                updatedCount++;
            } else {
                await prismadb.crm_Products.create({
                    data: {
                        name: item.title,
                        sku,
                        price,
                        description: item.body_html?.replace(/<[^>]*>/g, "") || undefined,
                        category: item.product_type || undefined,
                        brand: item.vendor || undefined,
                        stock,
                        weight,
                        tags,
                        taxable: item.variants?.[0]?.taxable ?? true,
                        shopify_id: item.id.toString(),
                        imageUrl,
                        team_id: teamId
                    }
                });
                importedCount++;
            }
        }

        revalidatePath("/crm/products");
        return { success: true, importedCount, updatedCount };
    } catch (error) {
        systemLogger.error("[IMPORT_FROM_SHOPIFY]", error);
        return { success: false, error: "Failed to import from Shopify" };
    }
}

export async function importFromWooCommerce() {
    try {
        const { error, session, teamInfo } = await getSessionAndTeam();
        if (error || !session?.user?.id || !teamInfo?.teamId) return { success: false, error: "Unauthorized" };

        const teamId = teamInfo.teamId;
        const integration = await prismadb.tenant_Integrations.findUnique({
            where: { tenant_id: teamId }
        });
        const wooConsumerKey = decryptSecret(integration?.woocommerce_consumer_key);
        const wooConsumerSecret = decryptSecret(integration?.woocommerce_consumer_secret);

        if (!integration?.woocommerce_enabled || !wooConsumerKey || !wooConsumerSecret || !integration?.woocommerce_store_url) {
            return { success: false, error: "WooCommerce integration not configured. Go to Admin → Integrations to set it up." };
        }

        // WooCommerce REST API v3 — Basic Auth
        const storeUrl = integration.woocommerce_store_url.replace(/\/$/, "");
        const authHeader = "Basic " + Buffer.from(`${wooConsumerKey}:${wooConsumerSecret}`).toString("base64");

        const response = await safeFetch(`${storeUrl}/wp-json/wc/v3/products?per_page=100`, {
            headers: {
                "Authorization": authHeader
            }
        });

        if (!response.ok) {
            const errBody = await response.text().catch(() => "");
            throw new Error(`WooCommerce API error (${response.status}): ${errBody}`);
        }

        const wooProducts = await response.json();

        let importedCount = 0;
        let updatedCount = 0;

        for (const item of wooProducts) {
            const sku = item.sku || `woo-${item.id}`;
            const price = parseFloat(item.price || item.regular_price || "0");
            const stock = item.stock_quantity || 0;
            const weight = item.weight ? parseFloat(item.weight) : undefined;
            const tags = item.tags?.map((t: any) => t.name) || [];
            const category = item.categories?.[0]?.name || undefined;
            const isDigital = item.virtual || item.downloadable || false;
            const imageUrl = item.images?.[0]?.src || undefined;

            const existingProduct = await prismadb.crm_Products.findFirst({
                where: {
                    OR: [{ sku }],
                    team_id: teamId
                }
            });

            if (existingProduct) {
                await prismadb.crm_Products.update({
                    where: { id: existingProduct.id },
                    data: {
                        name: item.name,
                        price,
                        description: item.short_description?.replace(/<[^>]*>/g, "") || item.description?.replace(/<[^>]*>/g, "") || undefined,
                        category,
                        stock,
                        weight,
                        tags,
                        isDigital,
                        taxable: item.tax_status === "taxable",
                        woo_id: item.id.toString(),
                        imageUrl,
                    }
                });
                updatedCount++;
            } else {
                await prismadb.crm_Products.create({
                    data: {
                        name: item.name,
                        sku,
                        price,
                        description: item.short_description?.replace(/<[^>]*>/g, "") || item.description?.replace(/<[^>]*>/g, "") || undefined,
                        category,
                        stock,
                        weight,
                        tags,
                        isDigital,
                        taxable: item.tax_status === "taxable",
                        woo_id: item.id.toString(),
                        imageUrl,
                        team_id: teamId
                    }
                });
                importedCount++;
            }
        }

        revalidatePath("/crm/products");
        return { success: true, importedCount, updatedCount };
    } catch (error) {
        systemLogger.error("[IMPORT_FROM_WOOCOMMERCE]", error);
        return { success: false, error: "Failed to import from WooCommerce" };
    }
}
