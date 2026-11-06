export type Role = "check-in" | "scorer" | "organizer";
export type Category =
  "tickets" | "giving" | "activities" | "bonuses" | "eating";
export type TeamRecord = {
  id: string;
  name: string;
  displayName: string;
  accentColor: string;
};
export type Rule = {
  id: string;
  label: string;
  points: number;
  mondayPoints?: number;
  mondayCap?: number | null;
  cents: number;
  enabled: boolean;
  category: Category;
  revision: number;
};
export type LedgerEntry = {
  id: string;
  teamId: string;
  category: Category;
  points: number;
  source: string;
  rule: string;
  ruleRevision: number;
  quantity: number;
  day: string;
  operator: string;
  reason: string;
  createdAt: string;
  reversalOf?: string;
};
export type Receipt = {
  id: string;
  teamId: string | null;
  cents: number;
  category: "donation" | "activity";
  source: string;
  operator: string;
  createdAt: string;
  reversedAt?: string;
  donationRate?: number;
  sequence?: number;
};
export type Order = {
  id: string;
  requestKey: string;
  fingerprint: string;
  email: string;
  source: "cash" | "test" | "legacy" | "stripe";
  sellerBrotherId?: string | null;
  sellerRaw?: string;
  sellerRevision?: number;
  sellerCorrected?: boolean;
  importReview?: string[];
  status:
    | "pending"
    | "paid"
    | "partially-refunded"
    | "refunded"
    | "disputed"
    | "expired";
  baseCents: number;
  feeCents: number;
  taxCents: number;
  totalCents: number;
  refundedBaseCents: number;
  refundedFeeCents: number;
  refundedTaxCents?: number;
  createdAt: string;
  quoteExpiresAt: string;
  tokenHash: string;
  tokenBox: string;
  ticketIds: string[];
  providerRef?: string;
  disputePreviousStatus?: Order["status"];
  disputeRevision?: number;
  terms?: { version: string; acceptedAt: string; digest: string };
  privacyAnonymizedAt?: string;
};
export type EventTicket = {
  id: string;
  orderId: string;
  name: string;
  teamId: string | null;
  tier: "basic" | "meat";
  baseCents: number;
  points: number;
  ruleRevision: number;
  tokenHash: string;
  tokenBox: string;
  valid: boolean;
  checkedInAt: string | null;
  checkedInBy: string | null;
  refunded: boolean;
  createdAt: string;
};
export type Award = {
  id: string;
  contest: string;
  teamId: string;
  points: number;
  revision: number;
  createdAt: string;
  operator: string;
  reason: string;
  reviewRequired?: boolean;
  retiredAt?: string;
  evidence?: string;
};
export type Audit = {
  id: string;
  operator: string;
  action: string;
  subject: string;
  reason: string;
  createdAt: string;
};
export type Job = {
  id: string;
  orderId: string;
  status: "queued" | "sending" | "sent" | "failed";
  attempts: number;
  nextAttemptAt: string;
  leaseUntil?: string;
  sentAt?: string;
  providerRef?: string;
  lastError?: string;
  leaseId?: string;
  provider?: "brevo" | "resend";
  deliveryStatus?: "accepted" | "delivered" | "bounced" | "deferred";
  deliveryUpdatedAt?: string;
  uncertain?: boolean;
  sendStarted?: boolean;
};
export type Staff = {
  id: string;
  name: string;
  role: Role;
  passwordHash: string;
  active: boolean;
};
export type Session = {
  id: string;
  staffId: string;
  expiresAt: string;
  revoked: boolean;
};
export type Submission = {
  id: string;
  fingerprint: string;
  createdAt: string;
  resultId: string;
};
export type LoginAttempt = { id: string; count: number; resetsAt: string };
export type Settings = {
  id: string;
  revision: number;
  offlineSalesEnabled: boolean;
  updatedAt: string;
  packetVersion?: number;
  chapterRepresentatives?: { teamId: string; name: string; contact: string }[];
};
export type Brother = {
  id: string;
  name: string;
  aliases: string[];
  active: boolean;
  revision: number;
};
export type RecordedEntry = {
  id: string;
  teamId: string | null;
  ruleId: string;
  quantity: number;
  points: number;
  day: string;
  reference: string;
  food: boolean;
  ruleRevision?: number;
  policyVersion?: number;
  tagsVerified?: boolean;
  participant?: string;
  hangMillis?: number;
  reversedAt?: string;
};
export type Attribution = {
  id: string;
  kind: "receipt" | "entry";
  allocations: { brotherId: string; units: number }[];
  revision: number;
};
export type CheckoutAttempt = {
  id: string;
  orderId: string;
  mode: "embedded" | "hosted";
  catalog?: Record<string, { quantity: number; cents: number }>;
  feePolicy?: string;
  origin?: string;
  paymentLinkId?: string;
  taxInclusive?: boolean;
  pricingMode?: "all_in" | "order_fee";
  includedFeeCents?: number;
  sessionId?: string;
  paymentId?: string;
  chargeId?: string;
  processorFeeCents?: number;
  status: "creating" | "open" | "complete" | "expired";
  createdAt: string;
  nextCheckAt: string;
  leaseUntil?: string;
  accountId: string;
  livemode: boolean;
  error?: string;
};
export type ProviderEvent = {
  id: string;
  verified?: {
    accountId: string;
    livemode: boolean;
    paymentId?: string;
    chargeId?: string;
  };
  objectId: string;
  type: string;
  status: "pending" | "processed" | "review";
  createdAt: string;
  attempts: number;
  nextAttemptAt: string;
  leaseUntil?: string;
  error?: string;
};
export type RemoteRefund = {
  id: string;
  orderId: string;
  ticketIds: string[];
  feeCents: number;
  taxCents?: number;
  amountCents: number;
  reason: string;
  status: "requested" | "pending" | "succeeded" | "failed" | "review";
  providerId?: string;
  createdAt: string;
};
export type EmailEvent = {
  id: string;
  providerRef: string;
  emailHash: string;
  status: "accepted" | "delivered" | "bounced" | "deferred";
  occurredAt: string;
  processed: boolean;
};
export type State = {
  teams: TeamRecord[];
  rules: Rule[];
  ledger: LedgerEntry[];
  receipts: Receipt[];
  orders: Order[];
  tickets: EventTicket[];
  awards: Award[];
  audit: Audit[];
  jobs: Job[];
  staff: Staff[];
  sessions: Session[];
  submissions: Submission[];
  attempts: LoginAttempt[];
  settings: Settings[];
  brothers: Brother[];
  entries: RecordedEntry[];
  attributions: Attribution[];
  checkouts: CheckoutAttempt[];
  providerEvents: ProviderEvent[];
  refunds: RemoteRefund[];
  emailEvents: EmailEvent[];
};
export const collections = [
  "teams",
  "rules",
  "ledger",
  "receipts",
  "orders",
  "tickets",
  "awards",
  "audit",
  "jobs",
  "staff",
  "sessions",
  "submissions",
  "attempts",
  "settings",
  "brothers",
  "entries",
  "attributions",
  "checkouts",
  "providerEvents",
  "refunds",
  "emailEvents",
] as const satisfies readonly (keyof State)[];
export function emptyState(): State {
  return Object.fromEntries(
    collections.map((key) => [key, []]),
  ) as unknown as State;
}
