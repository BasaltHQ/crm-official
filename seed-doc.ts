import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const content = `# BasaltCRM - Email Compliance Architecture

## Overview
BasaltCRM implements a rigorous Double Opt-In mechanism designed to comply with Amazon SES standards, GDPR, and CAN-SPAM. The compliance layer ensures that all programmatic outreach (via automated sequence or marketing emails) only reaches verified users, reducing bounce rates and protecting platform sender reputation.

## Schema Upgrades
Three new compliance parameters govern email status across \`crm_Leads\`, \`crm_Contacts\`, and \`crm_Accounts\`:
- \`opt_in_boolean\` (boolean): Basic confirmation that an email was submitted intentionally.
- \`double_opt_in_boolean\` (boolean): Absolute verification. Flips to \`true\` *only* after a user clicks the verification email.
- Metadata: \`opt_in_ip\` and \`opt_in_timestamp\` log exactly when and where consent occurred.

## Component Workflows

### 1. Web Form Submission (\`api/crm/leads/create-lead-from-web/route.ts\`)
When a new lead arrives from an external form integration, the handler:
1. Registers the core lead info.
2. Generates a secure \`crypto\` verification token.
3. Automatically triggers the first "Please Confirm Your Subscription" email via standard transactional layers.

### 2. Verification Callback (\`api/crm/verify-optin/route.ts\`)
The recipient clicks the confirmation URL. The route:
1. Validates the crypto token against the lead/contact database.
2. Upon success, permanently updates \`double_opt_in_boolean = true\`.
3. Clears the token to prevent replay attacks and logs the callback \`double_opt_in_ip\`.

### 3. CSV Data Imports (\`ImportLeadsDialog.tsx\`)
If an admin tries to bulk import \`emails\` but fails to map a column for \`optInBoolean\`, the wizard throws a **Compliance Warning**. Admins are permitted to bypass this, but must explicitly acknowledge the risk. Leads imported without opt-in will be blocked by downstream dispatchers.

### 4. Campaign Protection (\`OutreachCampaignWizard.tsx\`)
The final safety net occurs right before dispatching an AI outreach campaign. If an admin attempts to send an \`EMAIL\` channel sequence to leads where \`double_opt_in_boolean\` is false, the system flags the lead in red and disables the Launch button unless a manual override is checked.`;

  await prisma.docArticle.upsert({
    where: { slug: 'email-compliance-architecture' },
    update: {
      title: 'Email Compliance Architecture',
      category: 'Architecture',
      content: content,
    },
    create: {
      title: 'Email Compliance Architecture',
      slug: 'email-compliance-architecture',
      category: 'Architecture',
      content: content,
      order: 10,
    },
  });

  console.log('Documentation inserted successfully.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
