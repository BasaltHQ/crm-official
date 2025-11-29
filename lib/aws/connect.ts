import { ConnectClient, StartOutboundVoiceContactCommand, StopContactCommand, DescribeContactCommand, CreateUserCommand } from "@aws-sdk/client-connect";

export type StartCallOptions = {
  instanceId?: string; // fallback to env CONNECT_INSTANCE_ID
  contactFlowId?: string; // fallback to env CONNECT_CONTACT_FLOW_ID
  destinationPhoneNumber: string; // E.164
  queueId?: string; // optional, fallback to env CONNECT_QUEUE_ID
  attributes?: Record<string, string>; // Contact attributes
  clientToken?: string; // idempotency
};

function getEnv(name: string, required = false): string | undefined {
  const v = process.env[name];
  if (required && (!v || !String(v).trim())) throw new Error(`Missing required env var: ${name}`);
  return v?.trim();
}

let _client: ConnectClient | null = null;
function client(): ConnectClient {
  if (_client) return _client;
  const region = getEnv("AWS_REGION") || "us-east-1";
  _client = new ConnectClient({ region });
  return _client;
}

export async function startOutboundCall(opts: StartCallOptions): Promise<{ contactId: string }>{
  const instanceId = opts.instanceId || getEnv("CONNECT_INSTANCE_ID", true)!;
  const contactFlowId = opts.contactFlowId || getEnv("CONNECT_CONTACT_FLOW_ID", true)!;
  const queueId = opts.queueId || getEnv("CONNECT_QUEUE_ID") || undefined;
  const attributes = opts.attributes || {};
  const dest = opts.destinationPhoneNumber;
  if (!dest || !dest.trim()) throw new Error("destinationPhoneNumber is required (E.164)");

  const cmd = new StartOutboundVoiceContactCommand({
    InstanceId: instanceId,
    ContactFlowId: contactFlowId,
    DestinationPhoneNumber: dest,
    QueueId: queueId,
    Attributes: attributes,
    ClientToken: opts.clientToken,
  });
  const res = await client().send(cmd);
  const contactId = res?.ContactId;
  if (!contactId) throw new Error("StartOutboundVoiceContact returned no ContactId");
  return { contactId };
}

export async function stopContact(instanceId?: string, contactId?: string): Promise<void> {
  const iid = instanceId || getEnv("CONNECT_INSTANCE_ID", true)!;
  if (!contactId) throw new Error("contactId is required");
  const cmd = new StopContactCommand({ InstanceId: iid, ContactId: contactId });
  await client().send(cmd);
}

export async function describeContact(instanceId?: string, contactId?: string): Promise<any> {
  const iid = instanceId || getEnv("CONNECT_INSTANCE_ID", true)!;
  if (!contactId) throw new Error("contactId is required");
  const cmd = new DescribeContactCommand({ InstanceId: iid, ContactId: contactId });
  const res = await client().send(cmd);
  return res?.Contact || res;
}

// Utility to parse comma-separated env lists
function getEnvArray(name: string): string[] | undefined {
  const v = getEnv(name);
  if (!v) return undefined;
  return v.split(',').map(s => s.trim()).filter(Boolean);
}

export type EnsureUserOptions = {
  username: string; // Amazon Connect username (recommend email)
  password: string; // must meet Connect password policy
  email: string;
  name?: string; // full name (split into first/last)
  securityProfileIds?: string[]; // fallback to env CONNECT_SECURITY_PROFILE_IDS or CONNECT_SECURITY_PROFILE_ID
  routingProfileId?: string; // fallback to env CONNECT_ROUTING_PROFILE_ID
  instanceId?: string; // fallback to env CONNECT_INSTANCE_ID
};

// Creates a Connect user with SOFT_PHONE settings; returns the new UserId
export async function ensureConnectUser(opts: EnsureUserOptions): Promise<{ userId: string }> {
  const instanceId = opts.instanceId || getEnv("CONNECT_INSTANCE_ID", true)!;
  const routingProfileId = opts.routingProfileId || getEnv("CONNECT_ROUTING_PROFILE_ID", true)!;
  const envSecList = getEnvArray("CONNECT_SECURITY_PROFILE_IDS");
  const envSecSingle = getEnv("CONNECT_SECURITY_PROFILE_ID");
  const securityProfileIds = opts.securityProfileIds || (envSecList && envSecList.length ? envSecList : envSecSingle ? [envSecSingle] : undefined);
  if (!securityProfileIds || securityProfileIds.length === 0) {
    throw new Error("Missing CONNECT_SECURITY_PROFILE_ID(S) in env or options");
  }

  const fullName = opts.name || opts.username || opts.email;
  const [firstName, ...rest] = (fullName || "").split(" ");
  const lastName = rest.join(" ") || "User";

  const cmd = new CreateUserCommand({
    InstanceId: instanceId,
    Username: opts.username,
    Password: opts.password,
    IdentityInfo: {
      FirstName: firstName || "User",
      LastName: lastName || "User",
      Email: opts.email,
    },
    PhoneConfig: {
      PhoneType: "SOFT_PHONE",
      AutoAccept: false,
      AfterContactWorkTimeLimit: 60,
    },
    SecurityProfileIds: securityProfileIds,
    RoutingProfileId: routingProfileId,
  });

  const res = await client().send(cmd);
  const userId = (res as any)?.UserId;
  if (!userId) throw new Error("CreateUser returned no UserId");
  return { userId };
}
