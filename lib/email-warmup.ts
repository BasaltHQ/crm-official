import { prismadb } from "@/lib/prisma";
import { systemLogger } from "@/lib/logger";

// ---------------------------------------------------------------------------
// Email Warm-Up Period Enforcement
// ---------------------------------------------------------------------------
// Progressively increases daily send limits per sender email address:
//   Phase 1 (Days 1–2):  20 emails/day
//   Phase 2 (Days 3–4):  50 emails/day
//   Phase 3 (Days 5–6): 100 emails/day
//   Graduated (Day 7+):  -1 (unlimited at this layer — subscription tier cap applies)
// ---------------------------------------------------------------------------

const WARMUP_PHASES = [
    { maxDay: 2, dailyLimit: 20, label: "Phase 1" },
    { maxDay: 4, dailyLimit: 50, label: "Phase 2" },
    { maxDay: 6, dailyLimit: 100, label: "Phase 3" },
] as const;

export interface WarmupCheckResult {
    allowed: boolean;
    dailyLimit: number;       // -1 = graduated (no warm-up restriction)
    sentToday: number;
    remaining: number;        // -1 = unlimited
    phase: string;            // "Phase 1", "Phase 2", "Phase 3", "Graduated"
    daysActive: number;       // Days since first send (0 = first day)
    message?: string;
}

/**
 * Determine which warm-up phase a sender is in based on days since first send.
 */
function resolvePhase(daysActive: number): { dailyLimit: number; label: string } {
    for (const phase of WARMUP_PHASES) {
        if (daysActive < phase.maxDay) {
            return { dailyLimit: phase.dailyLimit, label: phase.label };
        }
    }
    return { dailyLimit: -1, label: "Graduated" };
}

/**
 * Check if a sender email is within its warm-up period and whether
 * the current daily limit allows additional sends.
 *
 * @param teamId       - The team owning this sender identity
 * @param senderEmail  - The actual "From" email address
 * @param quantity     - Number of emails about to be sent (default 1)
 */
export async function checkWarmupQuota(
    teamId: string,
    senderEmail: string,
    quantity: number = 1
): Promise<WarmupCheckResult> {
    try {
        const normalizedEmail = senderEmail.toLowerCase().trim();
        const now = new Date();
        const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

        const record = await prismadb.emailWarmup.findUnique({
            where: { team_id_sender_email: { team_id: teamId, sender_email: normalizedEmail } },
        });

        // No record = brand new sender → Phase 1, 0 sent today
        if (!record) {
            const phase = resolvePhase(0);
            const remaining = phase.dailyLimit - 0;
            return {
                allowed: quantity <= remaining,
                dailyLimit: phase.dailyLimit,
                sentToday: 0,
                remaining,
                phase: phase.label,
                daysActive: 0,
                message: quantity > remaining
                    ? `Email warm-up limit: This is a new sender address. Only ${phase.dailyLimit} emails/day are allowed during ${phase.label} (first 2 days).`
                    : undefined,
            };
        }

        // Calculate days active using active_days_count if present, falling back to calendar days
        const firstSendDay = new Date(Date.UTC(
            record.first_send_at.getUTCFullYear(),
            record.first_send_at.getUTCMonth(),
            record.first_send_at.getUTCDate()
        ));
        const calendarDaysActive = Math.floor((todayStart.getTime() - firstSendDay.getTime()) / (1000 * 60 * 60 * 24));
        const daysActive = (record as any).active_days_count !== undefined && (record as any).active_days_count !== null
            ? Math.max(0, (record as any).active_days_count - 1)
            : calendarDaysActive;

        const phase = resolvePhase(daysActive);

        // Graduated — no warm-up restriction
        if (phase.dailyLimit === -1) {
            return {
                allowed: true,
                dailyLimit: -1,
                sentToday: 0,
                remaining: -1,
                phase: phase.label,
                daysActive,
            };
        }

        // Check if the stored last_send_date is today — if not, the counter resets
        const lastSendDay = new Date(Date.UTC(
            record.last_send_date.getUTCFullYear(),
            record.last_send_date.getUTCMonth(),
            record.last_send_date.getUTCDate()
        ));
        const isToday = lastSendDay.getTime() === todayStart.getTime();
        const sentToday = isToday ? record.emails_sent_today : 0;
        const remaining = phase.dailyLimit - sentToday;

        const allowed = sentToday + quantity <= phase.dailyLimit;

        return {
            allowed,
            dailyLimit: phase.dailyLimit,
            sentToday,
            remaining: Math.max(0, remaining),
            phase: phase.label,
            daysActive,
            message: !allowed
                ? `Email warm-up limit reached for ${normalizedEmail}: ${sentToday}/${phase.dailyLimit} sent today (${phase.label}, day ${daysActive + 1}). Limit increases after day ${WARMUP_PHASES.find(p => p.label === phase.label)?.maxDay || 6}.`
                : undefined,
        };
    } catch (error) {
        systemLogger.error("[EMAIL_WARMUP_CHECK_ERROR]", error);
        // Fail open — don't block sends if the warmup system errors
        return {
            allowed: true,
            dailyLimit: -1,
            sentToday: 0,
            remaining: -1,
            phase: "Unknown",
            daysActive: 0,
        };
    }
}

/**
 * Record a successful email send against the warm-up counter.
 * Creates the record on first use; resets daily counter if the day has changed.
 *
 * @param teamId       - The team owning this sender identity
 * @param senderEmail  - The actual "From" email address
 * @param quantity     - Number of emails sent (default 1)
 */
export async function recordWarmupSend(
    teamId: string,
    senderEmail: string,
    quantity: number = 1
): Promise<void> {
    try {
        const normalizedEmail = senderEmail.toLowerCase().trim();
        const now = new Date();
        const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

        const existing = await prismadb.emailWarmup.findUnique({
            where: { team_id_sender_email: { team_id: teamId, sender_email: normalizedEmail } },
        });

        if (!existing) {
            // First-ever send from this address
            await prismadb.emailWarmup.create({
                data: {
                    team_id: teamId,
                    sender_email: normalizedEmail,
                    first_send_at: now,
                    emails_sent_today: quantity,
                    last_send_date: todayStart,
                    active_days_count: 1,
                },
            });
            systemLogger.info(`[EMAIL_WARMUP] New sender registered: ${normalizedEmail} (team ${teamId})`);
            return;
        }

        // Check if we need to reset the daily counter
        const lastSendDay = new Date(Date.UTC(
            existing.last_send_date.getUTCFullYear(),
            existing.last_send_date.getUTCMonth(),
            existing.last_send_date.getUTCDate()
        ));
        const isNewDay = lastSendDay.getTime() !== todayStart.getTime();

        // Safe fallback for legacy records to populate active_days_count on the fly
        const firstSendDay = new Date(Date.UTC(
            existing.first_send_at.getUTCFullYear(),
            existing.first_send_at.getUTCMonth(),
            existing.first_send_at.getUTCDate()
        ));
        const calendarDaysActive = Math.floor((todayStart.getTime() - firstSendDay.getTime()) / (1000 * 60 * 60 * 24));
        const currentActiveDays = (existing as any).active_days_count ?? Math.max(1, calendarDaysActive + 1);

        await prismadb.emailWarmup.update({
            where: { id: existing.id },
            data: {
                emails_sent_today: isNewDay ? quantity : { increment: quantity },
                last_send_date: todayStart,
                active_days_count: isNewDay
                    ? ((existing as any).active_days_count !== undefined && (existing as any).active_days_count !== null
                        ? { increment: 1 }
                        : currentActiveDays + 1)
                    : undefined,
            },
        });
    } catch (error) {
        systemLogger.error("[EMAIL_WARMUP_RECORD_ERROR]", error);
        // Non-fatal — recording failure should never block sends
    }
}
