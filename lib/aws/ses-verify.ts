import { SESv2Client, CreateEmailIdentityCommand, GetEmailIdentityCommand, DeleteEmailIdentityCommand } from "@aws-sdk/client-sesv2";

const region = process.env.SES_REGION || process.env.AWS_REGION || "us-east-1";

// Singleton client (reusing if possible, though new allowed)
const client = new SESv2Client({ region });

export type VerificationStatus = "PENDING" | "SUCCESS" | "FAILED" | "NOT_STARTED";

/**
 * Triggers a verification email to be sent to the specified address.
 * AWS SES will send a link that the user must click.
 */
export async function verifyEmailIdentity(email: string): Promise<boolean> {
    try {
        const command = new CreateEmailIdentityCommand({
            EmailIdentity: email,
        });
        await client.send(command);
        return true;
    } catch (error: any) {
        console.error("[SES_VERIFY_INIT]", error);
        // If already exists, we might get a conflict, which is fine, we just want to ensure it's there.
        if (error.name === "AlreadyExistsException") {
            return true;
        }
        throw new Error(`Failed to initiate verification: ${error.message}`);
    }
}

/**
 * Checks the current verification status of an email identity.
 */
export async function getIdentityVerificationStatus(email: string): Promise<VerificationStatus> {
    try {
        const command = new GetEmailIdentityCommand({
            EmailIdentity: email,
        });
        const response = await client.send(command);

        // SESv2 returns VerifiedForSendingStatus: boolean
        if (response.VerifiedForSendingStatus) {
            return "SUCCESS";
        }
        return "PENDING";
    } catch (error: any) {
        if (error.name === "NotFoundException") {
            return "NOT_STARTED";
        }
        console.error("[SES_VERIFY_CHECK]", error);
        return "FAILED";
    }
}

/**
 * Remove an identity (stopped verifying or deleted config)
 */
export async function deleteEmailIdentity(email: string) {
    try {
        const command = new DeleteEmailIdentityCommand({
            EmailIdentity: email
        });
        await client.send(command);
    } catch {
        // Ignore if not found
    }
}
