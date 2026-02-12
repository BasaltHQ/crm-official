
Object.defineProperty(exports, "__esModule", { value: true });

const {
  Decimal,
  objectEnumValues,
  makeStrictEnum,
  Public,
  getRuntime,
  skip
} = require('./runtime/index-browser.js')


const Prisma = {}

exports.Prisma = Prisma
exports.$Enums = {}

/**
 * Prisma Client JS version: 5.22.0
 * Query Engine version: 605197351a3c8bdd595af2d2a9bc3025bca48ea2
 */
Prisma.prismaVersion = {
  client: "5.22.0",
  engine: "605197351a3c8bdd595af2d2a9bc3025bca48ea2"
}

Prisma.PrismaClientKnownRequestError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientKnownRequestError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)};
Prisma.PrismaClientUnknownRequestError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientUnknownRequestError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientRustPanicError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientRustPanicError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientInitializationError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientInitializationError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientValidationError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientValidationError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.NotFoundError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`NotFoundError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.Decimal = Decimal

/**
 * Re-export of sql-template-tag
 */
Prisma.sql = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`sqltag is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.empty = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`empty is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.join = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`join is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.raw = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`raw is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.validator = Public.validator

/**
* Extensions
*/
Prisma.getExtensionContext = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`Extensions.getExtensionContext is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.defineExtension = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`Extensions.defineExtension is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}

/**
 * Shorthand utilities for JSON filtering
 */
Prisma.DbNull = objectEnumValues.instances.DbNull
Prisma.JsonNull = objectEnumValues.instances.JsonNull
Prisma.AnyNull = objectEnumValues.instances.AnyNull

Prisma.NullTypes = {
  DbNull: objectEnumValues.classes.DbNull,
  JsonNull: objectEnumValues.classes.JsonNull,
  AnyNull: objectEnumValues.classes.AnyNull
}



/**
 * Enums
 */

exports.Prisma.Crm_AccountsScalarFieldEnum = {
  id: 'id',
  v: 'v',
  createdAt: 'createdAt',
  createdBy: 'createdBy',
  updatedAt: 'updatedAt',
  updatedBy: 'updatedBy',
  annual_revenue: 'annual_revenue',
  assigned_to: 'assigned_to',
  billing_city: 'billing_city',
  billing_country: 'billing_country',
  billing_postal_code: 'billing_postal_code',
  billing_state: 'billing_state',
  billing_street: 'billing_street',
  company_id: 'company_id',
  description: 'description',
  email: 'email',
  employees: 'employees',
  fax: 'fax',
  industry: 'industry',
  member_of: 'member_of',
  name: 'name',
  office_phone: 'office_phone',
  shipping_city: 'shipping_city',
  shipping_country: 'shipping_country',
  shipping_postal_code: 'shipping_postal_code',
  shipping_state: 'shipping_state',
  shipping_street: 'shipping_street',
  status: 'status',
  type: 'type',
  vat: 'vat',
  website: 'website',
  documentsIDs: 'documentsIDs',
  watchers: 'watchers',
  team_id: 'team_id',
  assigned_department_id: 'assigned_department_id'
};

exports.Prisma.Crm_LeadsScalarFieldEnum = {
  id: 'id',
  v: 'v',
  createdAt: 'createdAt',
  createdBy: 'createdBy',
  updatedAt: 'updatedAt',
  updatedBy: 'updatedBy',
  firstName: 'firstName',
  lastName: 'lastName',
  company: 'company',
  jobTitle: 'jobTitle',
  email: 'email',
  phone: 'phone',
  description: 'description',
  lead_source: 'lead_source',
  refered_by: 'refered_by',
  campaign: 'campaign',
  status: 'status',
  type: 'type',
  assigned_to: 'assigned_to',
  accountsIDs: 'accountsIDs',
  documentsIDs: 'documentsIDs',
  outreach_status: 'outreach_status',
  outreach_sent_at: 'outreach_sent_at',
  outreach_opened_at: 'outreach_opened_at',
  outreach_followup_sent_at: 'outreach_followup_sent_at',
  outreach_meeting_link: 'outreach_meeting_link',
  outreach_meeting_booked_at: 'outreach_meeting_booked_at',
  outreach_first_message_id: 'outreach_first_message_id',
  outreach_open_token: 'outreach_open_token',
  outreach_notes: 'outreach_notes',
  pipeline_stage: 'pipeline_stage',
  outreach_transport: 'outreach_transport',
  sms_status: 'sms_status',
  sms_sent_at: 'sms_sent_at',
  last_sms_id: 'last_sms_id',
  phone_verified: 'phone_verified',
  call_status: 'call_status',
  connect_contact_id: 'connect_contact_id',
  call_recording_url: 'call_recording_url',
  call_transcript_url: 'call_transcript_url',
  azure_realtime_session_id: 'azure_realtime_session_id',
  social_twitter: 'social_twitter',
  social_facebook: 'social_facebook',
  social_linkedin: 'social_linkedin',
  project: 'project',
  team_id: 'team_id',
  assigned_department_id: 'assigned_department_id'
};

exports.Prisma.Crm_OpportunitiesScalarFieldEnum = {
  id: 'id',
  v: 'v',
  account: 'account',
  assigned_to: 'assigned_to',
  budget: 'budget',
  campaign: 'campaign',
  close_date: 'close_date',
  contact: 'contact',
  created_by: 'created_by',
  createdBy: 'createdBy',
  created_on: 'created_on',
  createdAt: 'createdAt',
  last_activity: 'last_activity',
  updatedAt: 'updatedAt',
  updatedBy: 'updatedBy',
  last_activity_by: 'last_activity_by',
  currency: 'currency',
  description: 'description',
  expected_revenue: 'expected_revenue',
  name: 'name',
  next_step: 'next_step',
  sales_stage: 'sales_stage',
  type: 'type',
  status: 'status',
  connected_documents: 'connected_documents',
  invoiceIDs: 'invoiceIDs',
  connected_contacts: 'connected_contacts',
  team_id: 'team_id',
  assigned_department_id: 'assigned_department_id'
};

exports.Prisma.Crm_campaignsScalarFieldEnum = {
  id: 'id',
  v: 'v',
  name: 'name',
  description: 'description',
  status: 'status'
};

exports.Prisma.Crm_Outreach_CampaignsScalarFieldEnum = {
  id: 'id',
  v: 'v',
  name: 'name',
  description: 'description',
  status: 'status',
  user: 'user',
  team_id: 'team_id',
  assigned_users: 'assigned_users',
  project: 'project',
  pool: 'pool',
  prompt_override: 'prompt_override',
  signature_html: 'signature_html',
  signature_meta: 'signature_meta',
  resource_links: 'resource_links',
  meeting_link: 'meeting_link',
  channels: 'channels',
  total_leads: 'total_leads',
  emails_sent: 'emails_sent',
  emails_opened: 'emails_opened',
  sms_sent: 'sms_sent',
  sms_delivered: 'sms_delivered',
  calls_initiated: 'calls_initiated',
  meetings_booked: 'meetings_booked',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  launchedAt: 'launchedAt',
  completedAt: 'completedAt'
};

exports.Prisma.Crm_Outreach_ItemsScalarFieldEnum = {
  id: 'id',
  v: 'v',
  campaign: 'campaign',
  lead: 'lead',
  channel: 'channel',
  status: 'status',
  research_data: 'research_data',
  subject: 'subject',
  body_text: 'body_text',
  body_html: 'body_html',
  message_id: 'message_id',
  tracking_token: 'tracking_token',
  createdAt: 'createdAt',
  sentAt: 'sentAt',
  deliveredAt: 'deliveredAt',
  openedAt: 'openedAt',
  clickedAt: 'clickedAt',
  repliedAt: 'repliedAt',
  error_message: 'error_message',
  retry_count: 'retry_count'
};

exports.Prisma.Crm_Opportunities_Sales_StagesScalarFieldEnum = {
  id: 'id',
  v: 'v',
  name: 'name',
  probability: 'probability',
  order: 'order'
};

exports.Prisma.Crm_Opportunities_TypeScalarFieldEnum = {
  id: 'id',
  v: 'v',
  name: 'name',
  order: 'order'
};

exports.Prisma.Crm_ContactsScalarFieldEnum = {
  id: 'id',
  v: 'v',
  account: 'account',
  assigned_to: 'assigned_to',
  birthday: 'birthday',
  created_by: 'created_by',
  createdBy: 'createdBy',
  created_on: 'created_on',
  cratedAt: 'cratedAt',
  last_activity: 'last_activity',
  updatedAt: 'updatedAt',
  updatedBy: 'updatedBy',
  last_activity_by: 'last_activity_by',
  description: 'description',
  email: 'email',
  email_unsubscribed: 'email_unsubscribed',
  personal_email: 'personal_email',
  first_name: 'first_name',
  last_name: 'last_name',
  office_phone: 'office_phone',
  mobile_phone: 'mobile_phone',
  website: 'website',
  position: 'position',
  status: 'status',
  social_twitter: 'social_twitter',
  social_facebook: 'social_facebook',
  social_linkedin: 'social_linkedin',
  social_skype: 'social_skype',
  social_instagram: 'social_instagram',
  social_youtube: 'social_youtube',
  social_tiktok: 'social_tiktok',
  type: 'type',
  tags: 'tags',
  notes: 'notes',
  opportunitiesIDs: 'opportunitiesIDs',
  accountsIDs: 'accountsIDs',
  documentsIDs: 'documentsIDs',
  team_id: 'team_id',
  assigned_department_id: 'assigned_department_id'
};

exports.Prisma.Crm_ContractsScalarFieldEnum = {
  id: 'id',
  v: 'v',
  title: 'title',
  value: 'value',
  startDate: 'startDate',
  endDate: 'endDate',
  renewalReminderDate: 'renewalReminderDate',
  customerSignedDate: 'customerSignedDate',
  companySignedDate: 'companySignedDate',
  description: 'description',
  account: 'account',
  assigned_to: 'assigned_to',
  createdAt: 'createdAt',
  createdBy: 'createdBy',
  updatedAt: 'updatedAt',
  updatedBy: 'updatedBy',
  status: 'status',
  type: 'type',
  team_id: 'team_id'
};

exports.Prisma.BoardsScalarFieldEnum = {
  id: 'id',
  v: 'v',
  description: 'description',
  favourite: 'favourite',
  favouritePosition: 'favouritePosition',
  icon: 'icon',
  position: 'position',
  title: 'title',
  user: 'user',
  visibility: 'visibility',
  sharedWith: 'sharedWith',
  createdAt: 'createdAt',
  createdBy: 'createdBy',
  updatedAt: 'updatedAt',
  updatedBy: 'updatedBy',
  brand_logo_url: 'brand_logo_url',
  brand_primary_color: 'brand_primary_color',
  status: 'status',
  require_approval: 'require_approval',
  target_industries: 'target_industries',
  target_geos: 'target_geos',
  target_titles: 'target_titles',
  campaign_brief: 'campaign_brief',
  messaging_tone: 'messaging_tone',
  key_value_props: 'key_value_props',
  meeting_link: 'meeting_link',
  signature_template: 'signature_template',
  watchers: 'watchers',
  team_id: 'team_id'
};

exports.Prisma.ProjectMemberScalarFieldEnum = {
  id: 'id',
  project: 'project',
  user: 'user',
  role: 'role',
  assignedAt: 'assignedAt',
  assignedBy: 'assignedBy'
};

exports.Prisma.EmployeesScalarFieldEnum = {
  id: 'id',
  v: 'v',
  avatar: 'avatar',
  email: 'email',
  name: 'name',
  salary: 'salary',
  status: 'status',
  team_id: 'team_id'
};

exports.Prisma.ImageUploadScalarFieldEnum = {
  id: 'id'
};

exports.Prisma.MyAccountScalarFieldEnum = {
  id: 'id',
  v: 'v',
  company_name: 'company_name',
  is_person: 'is_person',
  email: 'email',
  email_accountant: 'email_accountant',
  phone_prefix: 'phone_prefix',
  phone: 'phone',
  mobile_prefix: 'mobile_prefix',
  mobile: 'mobile',
  fax_prefix: 'fax_prefix',
  fax: 'fax',
  website: 'website',
  street: 'street',
  city: 'city',
  state: 'state',
  zip: 'zip',
  country: 'country',
  country_code: 'country_code',
  billing_street: 'billing_street',
  billing_city: 'billing_city',
  billing_state: 'billing_state',
  billing_zip: 'billing_zip',
  billing_country: 'billing_country',
  billing_country_code: 'billing_country_code',
  currency: 'currency',
  currency_symbol: 'currency_symbol',
  VAT_number: 'VAT_number',
  TAX_number: 'TAX_number',
  bank_name: 'bank_name',
  bank_account: 'bank_account',
  bank_code: 'bank_code',
  bank_IBAN: 'bank_IBAN',
  bank_SWIFT: 'bank_SWIFT'
};

exports.Prisma.InvoicesScalarFieldEnum = {
  id: 'id',
  v: 'v',
  date_created: 'date_created',
  last_updated: 'last_updated',
  last_updated_by: 'last_updated_by',
  date_received: 'date_received',
  date_of_case: 'date_of_case',
  date_tax: 'date_tax',
  date_due: 'date_due',
  description: 'description',
  document_type: 'document_type',
  favorite: 'favorite',
  variable_symbol: 'variable_symbol',
  constant_symbol: 'constant_symbol',
  specific_symbol: 'specific_symbol',
  order_number: 'order_number',
  internal_number: 'internal_number',
  invoice_number: 'invoice_number',
  invoice_amount: 'invoice_amount',
  invoice_file_mimeType: 'invoice_file_mimeType',
  invoice_file_url: 'invoice_file_url',
  invoice_items: 'invoice_items',
  invoice_type: 'invoice_type',
  invoice_currency: 'invoice_currency',
  invoice_language: 'invoice_language',
  partner: 'partner',
  partner_street: 'partner_street',
  partner_city: 'partner_city',
  partner_zip: 'partner_zip',
  partner_country: 'partner_country',
  partner_country_code: 'partner_country_code',
  partner_business_street: 'partner_business_street',
  partner_business_city: 'partner_business_city',
  partner_business_zip: 'partner_business_zip',
  partner_business_country: 'partner_business_country',
  partner_business_country_code: 'partner_business_country_code',
  partner_VAT_number: 'partner_VAT_number',
  partner_TAX_number: 'partner_TAX_number',
  partner_TAX_local_number: 'partner_TAX_local_number',
  partner_phone_prefix: 'partner_phone_prefix',
  partner_phone_number: 'partner_phone_number',
  partner_fax_prefix: 'partner_fax_prefix',
  partner_fax_number: 'partner_fax_number',
  partner_email: 'partner_email',
  partner_website: 'partner_website',
  partner_is_person: 'partner_is_person',
  partner_bank: 'partner_bank',
  partner_account_number: 'partner_account_number',
  partner_account_bank_number: 'partner_account_bank_number',
  partner_IBAN: 'partner_IBAN',
  partner_SWIFT: 'partner_SWIFT',
  partner_BIC: 'partner_BIC',
  rossum_status: 'rossum_status',
  rossum_annotation_id: 'rossum_annotation_id',
  rossum_annotation_url: 'rossum_annotation_url',
  rossum_document_id: 'rossum_document_id',
  rossum_document_url: 'rossum_document_url',
  rossum_annotation_json_url: 'rossum_annotation_json_url',
  rossum_annotation_xml_url: 'rossum_annotation_xml_url',
  money_s3_url: 'money_s3_url',
  status: 'status',
  payment_status: 'payment_status',
  surge_payment_id: 'surge_payment_id',
  surge_payment_link: 'surge_payment_link',
  mercury_invoice_id: 'mercury_invoice_id',
  invoice_state_id: 'invoice_state_id',
  assigned_user_id: 'assigned_user_id',
  assigned_account_id: 'assigned_account_id',
  visibility: 'visibility',
  connected_documents: 'connected_documents',
  opportunityIDs: 'opportunityIDs',
  projectOpportunityIDs: 'projectOpportunityIDs',
  team_id: 'team_id'
};

exports.Prisma.Invoice_StatesScalarFieldEnum = {
  id: 'id',
  name: 'name'
};

exports.Prisma.DocumentsScalarFieldEnum = {
  id: 'id',
  v: 'v',
  date_created: 'date_created',
  createdAt: 'createdAt',
  last_updated: 'last_updated',
  updatedAt: 'updatedAt',
  document_name: 'document_name',
  created_by_user: 'created_by_user',
  createdBy: 'createdBy',
  description: 'description',
  document_type: 'document_type',
  favourite: 'favourite',
  document_file_mimeType: 'document_file_mimeType',
  document_file_url: 'document_file_url',
  hash: 'hash',
  status: 'status',
  visibility: 'visibility',
  tags: 'tags',
  key: 'key',
  size: 'size',
  assigned_user: 'assigned_user',
  connected_documents: 'connected_documents',
  invoiceIDs: 'invoiceIDs',
  opportunityIDs: 'opportunityIDs',
  contactsIDs: 'contactsIDs',
  tasksIDs: 'tasksIDs',
  crm_accounts_tasksIDs: 'crm_accounts_tasksIDs',
  leadsIDs: 'leadsIDs',
  accountsIDs: 'accountsIDs',
  document_system_type: 'document_system_type',
  team_id: 'team_id'
};

exports.Prisma.Documents_TypesScalarFieldEnum = {
  id: 'id',
  v: 'v',
  name: 'name'
};

exports.Prisma.SectionsScalarFieldEnum = {
  id: 'id',
  v: 'v',
  board: 'board',
  title: 'title',
  position: 'position'
};

exports.Prisma.Crm_Industry_TypeScalarFieldEnum = {
  id: 'id',
  v: 'v',
  name: 'name'
};

exports.Prisma.ModulStatusScalarFieldEnum = {
  id: 'id',
  name: 'name',
  isVisible: 'isVisible'
};

exports.Prisma.TasksScalarFieldEnum = {
  id: 'id',
  v: 'v',
  content: 'content',
  createdAt: 'createdAt',
  createdBy: 'createdBy',
  updatedAt: 'updatedAt',
  updatedBy: 'updatedBy',
  dueDateAt: 'dueDateAt',
  lastEditedAt: 'lastEditedAt',
  position: 'position',
  priority: 'priority',
  section: 'section',
  tags: 'tags',
  title: 'title',
  likes: 'likes',
  user: 'user',
  documentIDs: 'documentIDs',
  accountId: 'accountId',
  opportunityId: 'opportunityId',
  contactId: 'contactId',
  leadId: 'leadId',
  taskStatus: 'taskStatus',
  team_id: 'team_id'
};

exports.Prisma.Crm_Accounts_TasksScalarFieldEnum = {
  id: 'id',
  v: 'v',
  content: 'content',
  createdAt: 'createdAt',
  createdBy: 'createdBy',
  updatedAt: 'updatedAt',
  updatedBy: 'updatedBy',
  dueDateAt: 'dueDateAt',
  priority: 'priority',
  tags: 'tags',
  title: 'title',
  likes: 'likes',
  user: 'user',
  account: 'account',
  taskStatus: 'taskStatus',
  team_id: 'team_id'
};

exports.Prisma.TasksCommentsScalarFieldEnum = {
  id: 'id',
  v: 'v',
  comment: 'comment',
  createdAt: 'createdAt',
  task: 'task',
  user: 'user',
  assigned_crm_account_task: 'assigned_crm_account_task'
};

exports.Prisma.TodoListScalarFieldEnum = {
  id: 'id',
  createdAt: 'createdAt',
  description: 'description',
  title: 'title',
  url: 'url',
  user: 'user'
};

exports.Prisma.RoleScalarFieldEnum = {
  id: 'id',
  name: 'name',
  permissions: 'permissions',
  description: 'description'
};

exports.Prisma.UsersScalarFieldEnum = {
  id: 'id',
  v: 'v',
  account_name: 'account_name',
  avatar: 'avatar',
  email: 'email',
  is_account_admin: 'is_account_admin',
  is_admin: 'is_admin',
  roleId: 'roleId',
  created_on: 'created_on',
  lastLoginAt: 'lastLoginAt',
  name: 'name',
  password: 'password',
  username: 'username',
  phone: 'phone',
  userStatus: 'userStatus',
  userLanguage: 'userLanguage',
  mustChangePassword: 'mustChangePassword',
  watching_boardsIDs: 'watching_boardsIDs',
  watching_accountsIDs: 'watching_accountsIDs',
  meeting_link: 'meeting_link',
  signature_html: 'signature_html',
  signature_updated_at: 'signature_updated_at',
  signature_meta: 'signature_meta',
  resource_links: 'resource_links',
  outreach_prompt_default: 'outreach_prompt_default',
  outreach_prompt_updated_at: 'outreach_prompt_updated_at',
  outreach_prompt_meta: 'outreach_prompt_meta',
  calendar_selected_ids: 'calendar_selected_ids',
  default_calendar_id: 'default_calendar_id',
  calendar_colors: 'calendar_colors',
  team_id: 'team_id',
  team_role: 'team_role',
  department_id: 'department_id',
  assigned_modules: 'assigned_modules',
  custom_role_id: 'custom_role_id'
};

exports.Prisma.TeamScalarFieldEnum = {
  id: 'id',
  name: 'name',
  slug: 'slug',
  logo_url: 'logo_url',
  owner_id: 'owner_id',
  created_at: 'created_at',
  updated_at: 'updated_at',
  team_type: 'team_type',
  parent_id: 'parent_id',
  signature_theme: 'signature_theme',
  subscription_plan: 'subscription_plan',
  plan_id: 'plan_id',
  status: 'status',
  suspension_reason: 'suspension_reason',
  renewal_date: 'renewal_date'
};

exports.Prisma.CustomRoleScalarFieldEnum = {
  id: 'id',
  name: 'name',
  description: 'description',
  team_id: 'team_id',
  modules: 'modules',
  created_at: 'created_at',
  updated_at: 'updated_at'
};

exports.Prisma.PlanScalarFieldEnum = {
  id: 'id',
  name: 'name',
  slug: 'slug',
  description: 'description',
  price: 'price',
  currency: 'currency',
  max_users: 'max_users',
  max_storage: 'max_storage',
  max_credits: 'max_credits',
  billing_cycle: 'billing_cycle',
  grace_period_days: 'grace_period_days',
  features: 'features',
  isActive: 'isActive',
  created_at: 'created_at',
  updated_at: 'updated_at'
};

exports.Prisma.System_Modules_EnabledScalarFieldEnum = {
  id: 'id',
  v: 'v',
  name: 'name',
  enabled: 'enabled',
  position: 'position'
};

exports.Prisma.SecondBrain_notionsScalarFieldEnum = {
  id: 'id',
  v: 'v',
  user: 'user',
  notion_api_key: 'notion_api_key',
  notion_db_id: 'notion_db_id'
};

exports.Prisma.OpenAi_keysScalarFieldEnum = {
  id: 'id',
  v: 'v',
  user: 'user',
  organization_id: 'organization_id',
  api_key: 'api_key'
};

exports.Prisma.Gmail_TokensScalarFieldEnum = {
  id: 'id',
  v: 'v',
  user: 'user',
  provider: 'provider',
  access_token: 'access_token',
  refresh_token: 'refresh_token',
  scope: 'scope',
  expiry_date: 'expiry_date',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.Microsoft_TokensScalarFieldEnum = {
  id: 'id',
  v: 'v',
  user: 'user',
  provider: 'provider',
  access_token: 'access_token',
  refresh_token: 'refresh_token',
  scope: 'scope',
  expiry_date: 'expiry_date',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.TeamEmailConfigScalarFieldEnum = {
  id: 'id',
  team_id: 'team_id',
  provider: 'provider',
  from_name: 'from_name',
  from_email: 'from_email',
  aws_access_key_id: 'aws_access_key_id',
  aws_secret_access_key: 'aws_secret_access_key',
  aws_region: 'aws_region',
  resend_api_key: 'resend_api_key',
  sendgrid_api_key: 'sendgrid_api_key',
  mailgun_api_key: 'mailgun_api_key',
  mailgun_domain: 'mailgun_domain',
  mailgun_region: 'mailgun_region',
  postmark_api_token: 'postmark_api_token',
  smtp_host: 'smtp_host',
  smtp_port: 'smtp_port',
  smtp_user: 'smtp_user',
  smtp_password: 'smtp_password',
  verification_status: 'verification_status',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.SystemServicesScalarFieldEnum = {
  id: 'id',
  v: 'v',
  name: 'name',
  serviceUrl: 'serviceUrl',
  serviceId: 'serviceId',
  serviceKey: 'serviceKey',
  servicePassword: 'servicePassword',
  servicePort: 'servicePort',
  description: 'description'
};

exports.Prisma.Oauth_Authorization_CodesScalarFieldEnum = {
  id: 'id',
  code: 'code',
  userId: 'userId',
  clientId: 'clientId',
  redirectUri: 'redirectUri',
  scope: 'scope',
  codeChallenge: 'codeChallenge',
  challengeMethod: 'challengeMethod',
  expiresAt: 'expiresAt',
  used: 'used',
  createdAt: 'createdAt'
};

exports.Prisma.AiModelScalarFieldEnum = {
  id: 'id',
  v: 'v',
  name: 'name',
  modelId: 'modelId',
  provider: 'provider',
  description: 'description',
  inputPrice: 'inputPrice',
  outputPrice: 'outputPrice',
  maxContext: 'maxContext',
  defaultMarkup: 'defaultMarkup',
  isActive: 'isActive',
  isDefault: 'isDefault',
  created_on: 'created_on'
};

exports.Prisma.SystemAiConfigScalarFieldEnum = {
  id: 'id',
  provider: 'provider',
  apiKey: 'apiKey',
  baseUrl: 'baseUrl',
  configuration: 'configuration',
  defaultModelId: 'defaultModelId',
  isActive: 'isActive'
};

exports.Prisma.TeamAiConfigScalarFieldEnum = {
  id: 'id',
  team_id: 'team_id',
  provider: 'provider',
  modelId: 'modelId',
  useSystemKey: 'useSystemKey',
  apiKey: 'apiKey'
};

exports.Prisma.TeamSmsConfigScalarFieldEnum = {
  id: 'id',
  team_id: 'team_id',
  brand_registration_id: 'brand_registration_id',
  brand_status: 'brand_status',
  brand_name: 'brand_name',
  brand_ein: 'brand_ein',
  brand_vertical: 'brand_vertical',
  brand_company_type: 'brand_company_type',
  brand_website_url: 'brand_website_url',
  brand_street: 'brand_street',
  brand_city: 'brand_city',
  brand_state: 'brand_state',
  brand_postal_code: 'brand_postal_code',
  brand_country_code: 'brand_country_code',
  brand_contact_email: 'brand_contact_email',
  brand_contact_phone: 'brand_contact_phone',
  brand_support_email: 'brand_support_email',
  brand_support_phone: 'brand_support_phone',
  campaign_registration_id: 'campaign_registration_id',
  campaign_status: 'campaign_status',
  campaign_use_case: 'campaign_use_case',
  campaign_description: 'campaign_description',
  campaign_message_flow: 'campaign_message_flow',
  campaign_sample_messages: 'campaign_sample_messages',
  campaign_help_message: 'campaign_help_message',
  campaign_opt_out_message: 'campaign_opt_out_message',
  phone_number_id: 'phone_number_id',
  phone_number: 'phone_number',
  phone_number_arn: 'phone_number_arn',
  phone_number_status: 'phone_number_status',
  sms_enabled: 'sms_enabled',
  monthly_budget: 'monthly_budget',
  daily_limit: 'daily_limit',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  brand_submitted_at: 'brand_submitted_at',
  brand_approved_at: 'brand_approved_at',
  campaign_submitted_at: 'campaign_submitted_at',
  campaign_approved_at: 'campaign_approved_at'
};

exports.Prisma.TeamCaptchaConfigScalarFieldEnum = {
  id: 'id',
  team_id: 'team_id',
  site_key: 'site_key',
  secret_key: 'secret_key',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.Chat_SessionsScalarFieldEnum = {
  id: 'id',
  v: 'v',
  user: 'user',
  title: 'title',
  isTemporary: 'isTemporary',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.Chat_MessagesScalarFieldEnum = {
  id: 'id',
  v: 'v',
  session: 'session',
  parent: 'parent',
  role: 'role',
  content: 'content',
  createdAt: 'createdAt',
  model: 'model',
  deployment: 'deployment',
  tokenUsage: 'tokenUsage'
};

exports.Prisma.Crm_Lead_PoolsScalarFieldEnum = {
  id: 'id',
  v: 'v',
  name: 'name',
  description: 'description',
  user: 'user',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  status: 'status',
  icpConfig: 'icpConfig',
  team_id: 'team_id',
  assigned_members: 'assigned_members'
};

exports.Prisma.Crm_Lead_Gen_JobsScalarFieldEnum = {
  id: 'id',
  v: 'v',
  user: 'user',
  pool: 'pool',
  status: 'status',
  startedAt: 'startedAt',
  finishedAt: 'finishedAt',
  providers: 'providers',
  queryTemplates: 'queryTemplates',
  counters: 'counters',
  logs: 'logs'
};

exports.Prisma.Crm_Lead_Source_EventsScalarFieldEnum = {
  id: 'id',
  v: 'v',
  job: 'job',
  type: 'type',
  query: 'query',
  url: 'url',
  fetchedAt: 'fetchedAt',
  metadata: 'metadata'
};

exports.Prisma.Crm_Lead_CandidatesScalarFieldEnum = {
  id: 'id',
  v: 'v',
  pool: 'pool',
  domain: 'domain',
  companyName: 'companyName',
  homepageUrl: 'homepageUrl',
  description: 'description',
  industry: 'industry',
  techStack: 'techStack',
  score: 'score',
  freshnessAt: 'freshnessAt',
  status: 'status',
  dedupeKey: 'dedupeKey',
  provenance: 'provenance',
  accountsIDs: 'accountsIDs'
};

exports.Prisma.Crm_Contact_CandidatesScalarFieldEnum = {
  id: 'id',
  v: 'v',
  leadCandidate: 'leadCandidate',
  fullName: 'fullName',
  title: 'title',
  email: 'email',
  emailStatus: 'emailStatus',
  phone: 'phone',
  linkedinUrl: 'linkedinUrl',
  confidence: 'confidence',
  provenance: 'provenance',
  status: 'status',
  dedupeKey: 'dedupeKey'
};

exports.Prisma.Crm_Lead_Pools_LeadsScalarFieldEnum = {
  id: 'id',
  v: 'v',
  pool: 'pool',
  lead: 'lead',
  createdAt: 'createdAt'
};

exports.Prisma.Crm_Contact_Candidate_LeadsScalarFieldEnum = {
  id: 'id',
  v: 'v',
  candidate: 'candidate',
  lead: 'lead',
  createdAt: 'createdAt'
};

exports.Prisma.Crm_Global_CompaniesScalarFieldEnum = {
  id: 'id',
  v: 'v',
  domain: 'domain',
  companyName: 'companyName',
  description: 'description',
  homepageUrl: 'homepageUrl',
  industry: 'industry',
  techStack: 'techStack',
  dedupeKey: 'dedupeKey',
  firstSeen: 'firstSeen',
  lastSeen: 'lastSeen',
  provenance: 'provenance',
  status: 'status'
};

exports.Prisma.Crm_Global_PersonsScalarFieldEnum = {
  id: 'id',
  v: 'v',
  email: 'email',
  fullName: 'fullName',
  title: 'title',
  linkedinUrl: 'linkedinUrl',
  phone: 'phone',
  companyDomain: 'companyDomain',
  companyId: 'companyId',
  dedupeKey: 'dedupeKey',
  emailStatus: 'emailStatus',
  confidence: 'confidence',
  firstSeen: 'firstSeen',
  lastSeen: 'lastSeen',
  provenance: 'provenance',
  status: 'status'
};

exports.Prisma.Crm_Lead_ActivitiesScalarFieldEnum = {
  id: 'id',
  v: 'v',
  lead: 'lead',
  user: 'user',
  type: 'type',
  metadata: 'metadata',
  createdAt: 'createdAt'
};

exports.Prisma.Project_Button_SetsScalarFieldEnum = {
  id: 'id',
  v: 'v',
  project: 'project',
  owner: 'owner',
  name: 'name',
  config: 'config',
  isDefault: 'isDefault',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.Project_OpportunitiesScalarFieldEnum = {
  id: 'id',
  v: 'v',
  project: 'project',
  title: 'title',
  description: 'description',
  category: 'category',
  status: 'status',
  valueEstimate: 'valueEstimate',
  createdAt: 'createdAt',
  createdBy: 'createdBy',
  assignedTo: 'assignedTo',
  relatedTasksIDs: 'relatedTasksIDs',
  invoiceIDs: 'invoiceIDs'
};

exports.Prisma.FooterSectionScalarFieldEnum = {
  id: 'id',
  title: 'title',
  order: 'order',
  isBase: 'isBase',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.FooterLinkScalarFieldEnum = {
  id: 'id',
  text: 'text',
  url: 'url',
  order: 'order',
  sectionId: 'sectionId',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.FooterSettingScalarFieldEnum = {
  id: 'id',
  tagline: 'tagline',
  copyrightText: 'copyrightText',
  socialXUrl: 'socialXUrl',
  socialDiscordUrl: 'socialDiscordUrl',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.BlogPostScalarFieldEnum = {
  id: 'id',
  title: 'title',
  slug: 'slug',
  content: 'content',
  excerpt: 'excerpt',
  coverImage: 'coverImage',
  category: 'category',
  author: 'author',
  publishedAt: 'publishedAt',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.JobPostingScalarFieldEnum = {
  id: 'id',
  title: 'title',
  department: 'department',
  location: 'location',
  type: 'type',
  description: 'description',
  summary: 'summary',
  content: 'content',
  requirements: 'requirements',
  applyLink: 'applyLink',
  active: 'active',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.JobApplicationScalarFieldEnum = {
  id: 'id',
  jobId: 'jobId',
  jobTitle: 'jobTitle',
  name: 'name',
  email: 'email',
  phone: 'phone',
  resumeUrl: 'resumeUrl',
  coverLetter: 'coverLetter',
  linkedinUrl: 'linkedinUrl',
  portfolioUrl: 'portfolioUrl',
  status: 'status',
  jiraTicketId: 'jiraTicketId',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.DocArticleScalarFieldEnum = {
  id: 'id',
  title: 'title',
  slug: 'slug',
  category: 'category',
  content: 'content',
  videoUrl: 'videoUrl',
  resources: 'resources',
  order: 'order',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.SocialSettingsScalarFieldEnum = {
  id: 'id',
  xTwitterUrl: 'xTwitterUrl',
  discordUrl: 'discordUrl',
  linkedinUrl: 'linkedinUrl',
  instagramUrl: 'instagramUrl',
  facebookUrl: 'facebookUrl',
  youtubeUrl: 'youtubeUrl',
  tiktokUrl: 'tiktokUrl',
  githubUrl: 'githubUrl',
  telegramUrl: 'telegramUrl',
  redditUrl: 'redditUrl',
  threadsUrl: 'threadsUrl',
  mastodonUrl: 'mastodonUrl',
  emailSupport: 'emailSupport',
  emailSales: 'emailSales',
  phoneNumber: 'phoneNumber',
  appStoreUrl: 'appStoreUrl',
  playStoreUrl: 'playStoreUrl',
  newsletterEnabled: 'newsletterEnabled',
  ctaText: 'ctaText',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.SupportTicketScalarFieldEnum = {
  id: 'id',
  source: 'source',
  name: 'name',
  email: 'email',
  subject: 'subject',
  message: 'message',
  status: 'status',
  jiraTicketId: 'jiraTicketId',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.SystemActivityScalarFieldEnum = {
  id: 'id',
  userId: 'userId',
  action: 'action',
  resource: 'resource',
  details: 'details',
  createdAt: 'createdAt'
};

exports.Prisma.PageViewScalarFieldEnum = {
  id: 'id',
  path: 'path',
  userAgent: 'userAgent',
  ipHash: 'ipHash',
  city: 'city',
  country: 'country',
  createdAt: 'createdAt'
};

exports.Prisma.SystemAuthConfigScalarFieldEnum = {
  id: 'id',
  provider: 'provider',
  clientId: 'clientId',
  clientSecret: 'clientSecret',
  tenantId: 'tenantId',
  enabled: 'enabled',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.InternalMessageScalarFieldEnum = {
  id: 'id',
  v: 'v',
  sender_id: 'sender_id',
  sender_name: 'sender_name',
  sender_email: 'sender_email',
  subject: 'subject',
  body_text: 'body_text',
  body_html: 'body_html',
  status: 'status',
  priority: 'priority',
  is_starred: 'is_starred',
  parent_id: 'parent_id',
  thread_id: 'thread_id',
  labels: 'labels',
  attachment_ids: 'attachment_ids',
  team_id: 'team_id',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  sentAt: 'sentAt'
};

exports.Prisma.InternalMessageRecipientScalarFieldEnum = {
  id: 'id',
  v: 'v',
  message_id: 'message_id',
  recipient_id: 'recipient_id',
  recipient_type: 'recipient_type',
  is_read: 'is_read',
  is_starred: 'is_starred',
  is_archived: 'is_archived',
  is_deleted: 'is_deleted',
  read_at: 'read_at',
  createdAt: 'createdAt'
};

exports.Prisma.FormScalarFieldEnum = {
  id: 'id',
  v: 'v',
  name: 'name',
  description: 'description',
  slug: 'slug',
  status: 'status',
  submission_behavior: 'submission_behavior',
  success_message: 'success_message',
  redirect_url: 'redirect_url',
  primary_color: 'primary_color',
  logo_url: 'logo_url',
  custom_css: 'custom_css',
  visibility: 'visibility',
  require_captcha: 'require_captcha',
  captcha_site_key: 'captcha_site_key',
  captcha_secret_key: 'captcha_secret_key',
  notify_emails: 'notify_emails',
  webhook_url: 'webhook_url',
  auto_respond: 'auto_respond',
  auto_respond_subject: 'auto_respond_subject',
  auto_respond_body: 'auto_respond_body',
  project_id: 'project_id',
  team_id: 'team_id',
  created_by: 'created_by',
  submission_count: 'submission_count',
  view_count: 'view_count',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.FormViewScalarFieldEnum = {
  id: 'id',
  form_id: 'form_id',
  ip_address: 'ip_address',
  user_agent: 'user_agent',
  referer: 'referer',
  viewedAt: 'viewedAt'
};

exports.Prisma.FormFieldScalarFieldEnum = {
  id: 'id',
  v: 'v',
  form_id: 'form_id',
  name: 'name',
  label: 'label',
  placeholder: 'placeholder',
  help_text: 'help_text',
  field_type: 'field_type',
  options: 'options',
  is_required: 'is_required',
  min_length: 'min_length',
  max_length: 'max_length',
  pattern: 'pattern',
  lead_field_mapping: 'lead_field_mapping',
  position: 'position',
  is_visible: 'is_visible'
};

exports.Prisma.FormSubmissionScalarFieldEnum = {
  id: 'id',
  v: 'v',
  form_id: 'form_id',
  data: 'data',
  extracted_email: 'extracted_email',
  extracted_phone: 'extracted_phone',
  extracted_name: 'extracted_name',
  extracted_company: 'extracted_company',
  status: 'status',
  is_deleted: 'is_deleted',
  lead_id: 'lead_id',
  source_url: 'source_url',
  ip_hash: 'ip_hash',
  user_agent: 'user_agent',
  referrer: 'referrer',
  utm_source: 'utm_source',
  utm_medium: 'utm_medium',
  utm_campaign: 'utm_campaign',
  team_id: 'team_id',
  createdAt: 'createdAt',
  viewed_at: 'viewed_at',
  converted_at: 'converted_at'
};

exports.Prisma.MediaItemScalarFieldEnum = {
  id: 'id',
  url: 'url',
  filename: 'filename',
  mimeType: 'mimeType',
  size: 'size',
  width: 'width',
  height: 'height',
  title: 'title',
  caption: 'caption',
  altText: 'altText',
  description: 'description',
  thumbnail: 'thumbnail',
  isPublic: 'isPublic',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  userId: 'userId'
};

exports.Prisma.Crm_Message_PortalScalarFieldEnum = {
  id: 'id',
  v: 'v',
  project: 'project',
  team_id: 'team_id',
  portal_name: 'portal_name',
  portal_slug: 'portal_slug',
  logo_url: 'logo_url',
  logo_type: 'logo_type',
  project_symbol_id: 'project_symbol_id',
  primary_color: 'primary_color',
  secondary_color: 'secondary_color',
  accent_color: 'accent_color',
  welcome_message: 'welcome_message',
  theme_mode: 'theme_mode',
  dark_primary_color: 'dark_primary_color',
  dark_secondary_color: 'dark_secondary_color',
  dark_accent_color: 'dark_accent_color',
  enable_glass_effect: 'enable_glass_effect',
  background_blur: 'background_blur',
  require_registration: 'require_registration',
  show_sender_info: 'show_sender_info',
  custom_domain: 'custom_domain',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.Crm_Portal_MessageScalarFieldEnum = {
  id: 'id',
  v: 'v',
  portal: 'portal',
  outreach_item: 'outreach_item',
  subject: 'subject',
  body_text: 'body_text',
  body_html: 'body_html',
  mobile_html: 'mobile_html',
  sender_name: 'sender_name',
  sender_email: 'sender_email',
  sender_avatar: 'sender_avatar',
  sentAt: 'sentAt',
  createdAt: 'createdAt'
};

exports.Prisma.Crm_Portal_RecipientScalarFieldEnum = {
  id: 'id',
  v: 'v',
  portal: 'portal',
  lead: 'lead',
  email: 'email',
  phone: 'phone',
  access_token: 'access_token',
  pin_code: 'pin_code',
  first_name: 'first_name',
  last_name: 'last_name',
  company: 'company',
  is_registered: 'is_registered',
  is_opted_out: 'is_opted_out',
  opted_out_at: 'opted_out_at',
  last_accessed: 'last_accessed',
  access_count: 'access_count',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.Crm_Portal_Message_RecipientScalarFieldEnum = {
  id: 'id',
  v: 'v',
  message: 'message',
  recipient: 'recipient',
  sms_sent: 'sms_sent',
  sms_sent_at: 'sms_sent_at',
  sms_message_id: 'sms_message_id',
  sms_status: 'sms_status',
  first_viewed_at: 'first_viewed_at',
  view_count: 'view_count',
  createdAt: 'createdAt'
};

exports.Prisma.Crm_Portal_Message_ViewScalarFieldEnum = {
  id: 'id',
  message: 'message',
  recipient_email: 'recipient_email',
  access_token: 'access_token',
  viewed_at: 'viewed_at',
  device_type: 'device_type',
  user_agent: 'user_agent',
  ip_hash: 'ip_hash'
};

exports.Prisma.RolePermissionScalarFieldEnum = {
  id: 'id',
  team_id: 'team_id',
  role: 'role',
  scope: 'scope',
  modules: 'modules',
  updatedAt: 'updatedAt'
};

exports.Prisma.SavedReportScalarFieldEnum = {
  id: 'id',
  title: 'title',
  type: 'type',
  content: 'content',
  prompt: 'prompt',
  filters: 'filters',
  userId: 'userId',
  teamId: 'teamId',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.Crm_DealRoomsScalarFieldEnum = {
  id: 'id',
  contract_id: 'contract_id',
  slug: 'slug',
  password_protection: 'password_protection',
  valid_until: 'valid_until',
  hero_video_url: 'hero_video_url',
  welcome_message: 'welcome_message',
  interactive_pricing: 'interactive_pricing',
  allowed_addons: 'allowed_addons',
  selected_addons: 'selected_addons',
  total_views: 'total_views',
  unique_visitors: 'unique_visitors',
  last_viewed_at: 'last_viewed_at',
  engagement_score: 'engagement_score',
  is_active: 'is_active',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.Crm_DealRoom_ActivitiesScalarFieldEnum = {
  id: 'id',
  deal_room_id: 'deal_room_id',
  type: 'type',
  metadata: 'metadata',
  visitor_ip: 'visitor_ip',
  visitor_agent: 'visitor_agent',
  occurredAt: 'occurredAt'
};

exports.Prisma.Crm_WorkflowScalarFieldEnum = {
  id: 'id',
  v: 'v',
  name: 'name',
  description: 'description',
  status: 'status',
  trigger_type: 'trigger_type',
  trigger_config: 'trigger_config',
  flow_type: 'flow_type',
  object_type: 'object_type',
  record_trigger_event: 'record_trigger_event',
  record_filter: 'record_filter',
  screen_config: 'screen_config',
  nodes: 'nodes',
  edges: 'edges',
  team_id: 'team_id',
  created_by: 'created_by',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.Crm_Workflow_ExecutionScalarFieldEnum = {
  id: 'id',
  v: 'v',
  workflow_id: 'workflow_id',
  status: 'status',
  trigger_data: 'trigger_data',
  current_node: 'current_node',
  completed_nodes: 'completed_nodes',
  node_outputs: 'node_outputs',
  scheduled_at: 'scheduled_at',
  error: 'error',
  startedAt: 'startedAt',
  completedAt: 'completedAt'
};

exports.Prisma.CustomObjectDefinitionScalarFieldEnum = {
  id: 'id',
  v: 'v',
  name: 'name',
  pluralName: 'pluralName',
  apiName: 'apiName',
  description: 'description',
  icon: 'icon',
  isSystem: 'isSystem',
  isActive: 'isActive',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  createdBy: 'createdBy',
  team_id: 'team_id'
};

exports.Prisma.CustomFieldDefinitionScalarFieldEnum = {
  id: 'id',
  v: 'v',
  object_id: 'object_id',
  name: 'name',
  apiName: 'apiName',
  type: 'type',
  isRequired: 'isRequired',
  isUnique: 'isUnique',
  defaultValue: 'defaultValue',
  helpText: 'helpText',
  placeholder: 'placeholder',
  options: 'options',
  validation: 'validation',
  order: 'order',
  listColumn: 'listColumn',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.CustomRecordScalarFieldEnum = {
  id: 'id',
  v: 'v',
  object_id: 'object_id',
  data: 'data',
  name: 'name',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  createdBy: 'createdBy',
  updatedBy: 'updatedBy',
  team_id: 'team_id'
};

exports.Prisma.PageLayoutScalarFieldEnum = {
  id: 'id',
  v: 'v',
  object_id: 'object_id',
  name: 'name',
  isDefault: 'isDefault',
  sections: 'sections',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  createdBy: 'createdBy',
  team_id: 'team_id'
};

exports.Prisma.Crm_CasesScalarFieldEnum = {
  id: 'id',
  v: 'v',
  case_number: 'case_number',
  subject: 'subject',
  description: 'description',
  status: 'status',
  priority: 'priority',
  origin: 'origin',
  type: 'type',
  reason: 'reason',
  contact_id: 'contact_id',
  account_id: 'account_id',
  assigned_to: 'assigned_to',
  parent_case_id: 'parent_case_id',
  source_email_id: 'source_email_id',
  source_email_from: 'source_email_from',
  source_email_subject: 'source_email_subject',
  internal_notes: 'internal_notes',
  sla_policy_id: 'sla_policy_id',
  first_response_at: 'first_response_at',
  first_response_due: 'first_response_due',
  resolution_due: 'resolution_due',
  sla_breached: 'sla_breached',
  escalation_level: 'escalation_level',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  createdBy: 'createdBy',
  updatedBy: 'updatedBy',
  closedAt: 'closedAt',
  resolvedAt: 'resolvedAt',
  tags: 'tags',
  team_id: 'team_id',
  assigned_department_id: 'assigned_department_id'
};

exports.Prisma.Crm_Case_CommentsScalarFieldEnum = {
  id: 'id',
  v: 'v',
  case_id: 'case_id',
  body: 'body',
  is_public: 'is_public',
  is_system: 'is_system',
  email_message_id: 'email_message_id',
  author_id: 'author_id',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.CaseStatusTransitionScalarFieldEnum = {
  id: 'id',
  case_id: 'case_id',
  from_status: 'from_status',
  to_status: 'to_status',
  changed_by: 'changed_by',
  reason: 'reason',
  createdAt: 'createdAt'
};

exports.Prisma.SLA_PolicyScalarFieldEnum = {
  id: 'id',
  v: 'v',
  name: 'name',
  description: 'description',
  is_active: 'is_active',
  is_default: 'is_default',
  first_response_critical: 'first_response_critical',
  first_response_high: 'first_response_high',
  first_response_medium: 'first_response_medium',
  first_response_low: 'first_response_low',
  resolution_critical: 'resolution_critical',
  resolution_high: 'resolution_high',
  resolution_medium: 'resolution_medium',
  resolution_low: 'resolution_low',
  business_hours: 'business_hours',
  escalation_rules: 'escalation_rules',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  createdBy: 'createdBy',
  team_id: 'team_id'
};

exports.Prisma.SLA_MilestoneScalarFieldEnum = {
  id: 'id',
  v: 'v',
  policy_id: 'policy_id',
  name: 'name',
  description: 'description',
  minutes_critical: 'minutes_critical',
  minutes_high: 'minutes_high',
  minutes_medium: 'minutes_medium',
  minutes_low: 'minutes_low',
  milestone_type: 'milestone_type',
  breach_actions: 'breach_actions',
  warning_threshold: 'warning_threshold',
  order: 'order',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.SLA_MilestoneInstanceScalarFieldEnum = {
  id: 'id',
  milestone_id: 'milestone_id',
  case_id: 'case_id',
  target_date: 'target_date',
  completed_date: 'completed_date',
  is_completed: 'is_completed',
  is_violated: 'is_violated',
  warning_sent: 'warning_sent',
  createdAt: 'createdAt'
};

exports.Prisma.AgentPresenceScalarFieldEnum = {
  id: 'id',
  v: 'v',
  user_id: 'user_id',
  status: 'status',
  max_capacity: 'max_capacity',
  current_load: 'current_load',
  channels_enabled: 'channels_enabled',
  available_since: 'available_since',
  last_heartbeat: 'last_heartbeat',
  auto_offline_min: 'auto_offline_min',
  avg_handle_time_min: 'avg_handle_time_min',
  cases_resolved_today: 'cases_resolved_today',
  csat_score: 'csat_score',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  team_id: 'team_id'
};

exports.Prisma.AgentSkillScalarFieldEnum = {
  id: 'id',
  user_id: 'user_id',
  skill_name: 'skill_name',
  proficiency: 'proficiency',
  createdAt: 'createdAt',
  team_id: 'team_id'
};

exports.Prisma.RoutingConfigScalarFieldEnum = {
  id: 'id',
  v: 'v',
  team_id: 'team_id',
  strategy: 'strategy',
  priority_overrides: 'priority_overrides',
  type_skill_map: 'type_skill_map',
  fallback_user_id: 'fallback_user_id',
  auto_assign_enabled: 'auto_assign_enabled',
  auto_reassign_on_offline: 'auto_reassign_on_offline',
  max_reassign_attempts: 'max_reassign_attempts',
  last_assigned_user_id: 'last_assigned_user_id',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.KnowledgeCategoryScalarFieldEnum = {
  id: 'id',
  v: 'v',
  name: 'name',
  slug: 'slug',
  description: 'description',
  icon: 'icon',
  order: 'order',
  parent_id: 'parent_id',
  team_id: 'team_id',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.KnowledgeArticleScalarFieldEnum = {
  id: 'id',
  v: 'v',
  title: 'title',
  slug: 'slug',
  summary: 'summary',
  content: 'content',
  status: 'status',
  category_id: 'category_id',
  tags: 'tags',
  keywords: 'keywords',
  is_internal: 'is_internal',
  is_pinned: 'is_pinned',
  view_count: 'view_count',
  helpful_count: 'helpful_count',
  not_helpful_count: 'not_helpful_count',
  author_id: 'author_id',
  team_id: 'team_id',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  publishedAt: 'publishedAt'
};

exports.Prisma.KnowledgeArticleLinkScalarFieldEnum = {
  id: 'id',
  article_id: 'article_id',
  case_id: 'case_id',
  link_type: 'link_type',
  was_helpful: 'was_helpful',
  linked_by: 'linked_by',
  createdAt: 'createdAt'
};

exports.Prisma.ValidationRuleScalarFieldEnum = {
  id: 'id',
  v: 'v',
  name: 'name',
  description: 'description',
  is_active: 'is_active',
  object_type: 'object_type',
  formula: 'formula',
  error_message: 'error_message',
  trigger_on: 'trigger_on',
  order: 'order',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  createdBy: 'createdBy',
  team_id: 'team_id'
};

exports.Prisma.ApprovalProcessScalarFieldEnum = {
  id: 'id',
  v: 'v',
  name: 'name',
  description: 'description',
  status: 'status',
  object_type: 'object_type',
  entry_criteria: 'entry_criteria',
  final_approval_actions: 'final_approval_actions',
  final_rejection_actions: 'final_rejection_actions',
  allow_recall: 'allow_recall',
  lock_record: 'lock_record',
  order: 'order',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  createdBy: 'createdBy',
  team_id: 'team_id'
};

exports.Prisma.ApprovalStepScalarFieldEnum = {
  id: 'id',
  v: 'v',
  process_id: 'process_id',
  step_number: 'step_number',
  name: 'name',
  approver_type: 'approver_type',
  approver_user_id: 'approver_user_id',
  approver_role: 'approver_role',
  approval_mode: 'approval_mode',
  auto_escalate_hours: 'auto_escalate_hours',
  escalate_to_user_id: 'escalate_to_user_id',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.ApprovalRequestScalarFieldEnum = {
  id: 'id',
  v: 'v',
  process_id: 'process_id',
  record_id: 'record_id',
  record_type: 'record_type',
  status: 'status',
  current_step: 'current_step',
  submitted_by: 'submitted_by',
  submit_comment: 'submit_comment',
  record_snapshot: 'record_snapshot',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  completedAt: 'completedAt',
  team_id: 'team_id'
};

exports.Prisma.ApprovalRequestActionScalarFieldEnum = {
  id: 'id',
  request_id: 'request_id',
  step_id: 'step_id',
  actor_id: 'actor_id',
  action: 'action',
  comment: 'comment',
  reassigned_to: 'reassigned_to',
  createdAt: 'createdAt'
};

exports.Prisma.NotificationScalarFieldEnum = {
  id: 'id',
  userId: 'userId',
  title: 'title',
  message: 'message',
  type: 'type',
  link: 'link',
  isRead: 'isRead',
  createdAt: 'createdAt',
  team_id: 'team_id'
};

exports.Prisma.Crm_ProductsScalarFieldEnum = {
  id: 'id',
  name: 'name',
  sku: 'sku',
  description: 'description',
  price: 'price',
  category: 'category',
  active: 'active',
  team_id: 'team_id',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.Crm_ProductBundlesScalarFieldEnum = {
  id: 'id',
  parentProductId: 'parentProductId',
  childProductId: 'childProductId',
  quantity: 'quantity',
  isRequired: 'isRequired'
};

exports.Prisma.Crm_QuotesScalarFieldEnum = {
  id: 'id',
  title: 'title',
  quoteNumber: 'quoteNumber',
  status: 'status',
  totalAmount: 'totalAmount',
  expirationDate: 'expirationDate',
  accountId: 'accountId',
  contactId: 'contactId',
  opportunityId: 'opportunityId',
  createdBy: 'createdBy',
  team_id: 'team_id',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.Crm_QuoteItemsScalarFieldEnum = {
  id: 'id',
  quoteId: 'quoteId',
  productId: 'productId',
  quantity: 'quantity',
  unitPrice: 'unitPrice',
  discount: 'discount',
  totalPrice: 'totalPrice'
};

exports.Prisma.DashboardPreferenceScalarFieldEnum = {
  id: 'id',
  userId: 'userId',
  layout: 'layout',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.NavigationConfigScalarFieldEnum = {
  id: 'id',
  team_id: 'team_id',
  user_id: 'user_id',
  structure: 'structure',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.Tenant_IntegrationsScalarFieldEnum = {
  id: 'id',
  tenant_id: 'tenant_id',
  surge_enabled: 'surge_enabled',
  surge_api_key: 'surge_api_key',
  surge_merchant_id: 'surge_merchant_id',
  preferred_chain: 'preferred_chain',
  mercury_enabled: 'mercury_enabled',
  mercury_api_key: 'mercury_api_key',
  mercury_account_id: 'mercury_account_id',
  pandadoc_enabled: 'pandadoc_enabled',
  pandadoc_token: 'pandadoc_token',
  discord_enabled: 'discord_enabled',
  discord_webhook: 'discord_webhook',
  updatedAt: 'updatedAt'
};

exports.Prisma.Crm_SubscriptionsScalarFieldEnum = {
  id: 'id',
  v: 'v',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  tenant_id: 'tenant_id',
  account_id: 'account_id',
  surge_vault_token: 'surge_vault_token',
  customer_email: 'customer_email',
  customer_wallet: 'customer_wallet',
  discount_applied: 'discount_applied',
  plan_name: 'plan_name',
  amount: 'amount',
  currency: 'currency',
  interval: 'interval',
  billing_day: 'billing_day',
  next_billing_date: 'next_billing_date',
  status: 'status',
  last_charge_date: 'last_charge_date',
  last_charge_status: 'last_charge_status',
  last_transaction_id: 'last_transaction_id',
  metadata: 'metadata'
};

exports.Prisma.SortOrder = {
  asc: 'asc',
  desc: 'desc'
};

exports.Prisma.QueryMode = {
  default: 'default',
  insensitive: 'insensitive'
};
exports.OutreachStatus = exports.$Enums.OutreachStatus = {
  IDLE: 'IDLE',
  PENDING: 'PENDING',
  SENT: 'SENT',
  OPENED: 'OPENED',
  MEETING_LINK_CLICKED: 'MEETING_LINK_CLICKED',
  MEETING_BOOKED: 'MEETING_BOOKED',
  CLOSED: 'CLOSED'
};

exports.PipelineStage = exports.$Enums.PipelineStage = {
  Identify: 'Identify',
  Engage_AI: 'Engage_AI',
  Engage_Human: 'Engage_Human',
  Offering: 'Offering',
  Finalizing: 'Finalizing',
  Closed: 'Closed'
};

exports.crm_Opportunity_Status = exports.$Enums.crm_Opportunity_Status = {
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
  PENDING: 'PENDING',
  CLOSED: 'CLOSED'
};

exports.OutreachCampaignStatus = exports.$Enums.OutreachCampaignStatus = {
  DRAFT: 'DRAFT',
  PENDING_APPROVAL: 'PENDING_APPROVAL',
  ACTIVE: 'ACTIVE',
  PAUSED: 'PAUSED',
  COMPLETED: 'COMPLETED',
  ARCHIVED: 'ARCHIVED'
};

exports.OutreachChannelType = exports.$Enums.OutreachChannelType = {
  EMAIL: 'EMAIL',
  SMS: 'SMS',
  PHONE: 'PHONE'
};

exports.OutreachItemStatus = exports.$Enums.OutreachItemStatus = {
  PENDING: 'PENDING',
  RESEARCHING: 'RESEARCHING',
  READY: 'READY',
  SENT: 'SENT',
  DELIVERED: 'DELIVERED',
  OPENED: 'OPENED',
  CLICKED: 'CLICKED',
  REPLIED: 'REPLIED',
  BOUNCED: 'BOUNCED',
  FAILED: 'FAILED',
  SKIPPED: 'SKIPPED'
};

exports.crm_Contracts_Status = exports.$Enums.crm_Contracts_Status = {
  NOTSTARTED: 'NOTSTARTED',
  INPROGRESS: 'INPROGRESS',
  SIGNED: 'SIGNED'
};

exports.ProjectStatus = exports.$Enums.ProjectStatus = {
  DRAFT: 'DRAFT',
  READY: 'READY',
  ACTIVE: 'ACTIVE',
  COMPLETED: 'COMPLETED',
  ARCHIVED: 'ARCHIVED'
};

exports.DocumentSystemType = exports.$Enums.DocumentSystemType = {
  INVOICE: 'INVOICE',
  RECEIPT: 'RECEIPT',
  CONTRACT: 'CONTRACT',
  OFFER: 'OFFER',
  OTHER: 'OTHER'
};

exports.taskStatus = exports.$Enums.taskStatus = {
  ACTIVE: 'ACTIVE',
  PENDING: 'PENDING',
  COMPLETE: 'COMPLETE'
};

exports.ActiveStatus = exports.$Enums.ActiveStatus = {
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
  PENDING: 'PENDING'
};

exports.Language = exports.$Enums.Language = {
  cz: 'cz',
  en: 'en',
  de: 'de',
  uk: 'uk'
};

exports.TeamType = exports.$Enums.TeamType = {
  ORGANIZATION: 'ORGANIZATION',
  DEPARTMENT: 'DEPARTMENT'
};

exports.SubscriptionPlan = exports.$Enums.SubscriptionPlan = {
  FREE: 'FREE',
  TEAM: 'TEAM',
  ENTERPRISE: 'ENTERPRISE'
};

exports.TeamStatus = exports.$Enums.TeamStatus = {
  ACTIVE: 'ACTIVE',
  PENDING: 'PENDING',
  SUSPENDED: 'SUSPENDED'
};

exports.BillingCycle = exports.$Enums.BillingCycle = {
  MONTHLY: 'MONTHLY',
  YEARLY: 'YEARLY',
  LIFETIME: 'LIFETIME',
  ONE_TIME: 'ONE_TIME'
};

exports.EmailProvider = exports.$Enums.EmailProvider = {
  AWS_SES: 'AWS_SES',
  RESEND: 'RESEND',
  SENDGRID: 'SENDGRID',
  MAILGUN: 'MAILGUN',
  POSTMARK: 'POSTMARK',
  SMTP: 'SMTP'
};

exports.AiProvider = exports.$Enums.AiProvider = {
  OPENAI: 'OPENAI',
  AZURE: 'AZURE',
  ANTHROPIC: 'ANTHROPIC',
  GOOGLE: 'GOOGLE',
  GROK: 'GROK',
  DEEPSEEK: 'DEEPSEEK',
  PERPLEXITY: 'PERPLEXITY',
  MISTRAL: 'MISTRAL'
};

exports.TenDlcRegistrationStatus = exports.$Enums.TenDlcRegistrationStatus = {
  PENDING: 'PENDING',
  SUBMITTED: 'SUBMITTED',
  APPROVED: 'APPROVED',
  DENIED: 'DENIED',
  REQUIRES_UPDATE: 'REQUIRES_UPDATE'
};

exports.LeadGenJobStatus = exports.$Enums.LeadGenJobStatus = {
  QUEUED: 'QUEUED',
  RUNNING: 'RUNNING',
  PAUSED: 'PAUSED',
  STOPPED: 'STOPPED',
  SUCCESS: 'SUCCESS',
  FAILED: 'FAILED'
};

exports.LeadCandidateStatus = exports.$Enums.LeadCandidateStatus = {
  NEW: 'NEW',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  CONVERTED: 'CONVERTED'
};

exports.EmailVerificationStatus = exports.$Enums.EmailVerificationStatus = {
  VALID: 'VALID',
  RISKY: 'RISKY',
  INVALID: 'INVALID',
  CATCH_ALL: 'CATCH_ALL',
  UNKNOWN: 'UNKNOWN'
};

exports.ProjectOpportunityCategory = exports.$Enums.ProjectOpportunityCategory = {
  FEATURE_BUILDOUT: 'FEATURE_BUILDOUT',
  COMMISSIONED_WORK: 'COMMISSIONED_WORK',
  OTHER: 'OTHER'
};

exports.ProjectOpportunityStatus = exports.$Enums.ProjectOpportunityStatus = {
  OPEN: 'OPEN',
  WON: 'WON',
  LOST: 'LOST',
  ARCHIVED: 'ARCHIVED'
};

exports.InternalMessageStatus = exports.$Enums.InternalMessageStatus = {
  DRAFT: 'DRAFT',
  SENT: 'SENT',
  READ: 'READ',
  ARCHIVED: 'ARCHIVED',
  DELETED: 'DELETED'
};

exports.InternalMessagePriority = exports.$Enums.InternalMessagePriority = {
  LOW: 'LOW',
  NORMAL: 'NORMAL',
  HIGH: 'HIGH',
  URGENT: 'URGENT'
};

exports.FormStatus = exports.$Enums.FormStatus = {
  DRAFT: 'DRAFT',
  ACTIVE: 'ACTIVE',
  PAUSED: 'PAUSED',
  ARCHIVED: 'ARCHIVED'
};

exports.SubmissionBehavior = exports.$Enums.SubmissionBehavior = {
  MESSAGE: 'MESSAGE',
  REDIRECT: 'REDIRECT'
};

exports.FormVisibility = exports.$Enums.FormVisibility = {
  PUBLIC: 'PUBLIC',
  PRIVATE: 'PRIVATE'
};

exports.FormFieldType = exports.$Enums.FormFieldType = {
  TEXT: 'TEXT',
  TEXTAREA: 'TEXTAREA',
  EMAIL: 'EMAIL',
  PHONE: 'PHONE',
  NUMBER: 'NUMBER',
  SELECT: 'SELECT',
  MULTI_SELECT: 'MULTI_SELECT',
  CHECKBOX: 'CHECKBOX',
  RADIO: 'RADIO',
  DATE: 'DATE',
  TIME: 'TIME',
  DATETIME: 'DATETIME',
  FILE: 'FILE',
  HIDDEN: 'HIDDEN',
  CONSENT: 'CONSENT'
};

exports.FormSubmissionStatus = exports.$Enums.FormSubmissionStatus = {
  NEW: 'NEW',
  VIEWED: 'VIEWED',
  CONVERTED: 'CONVERTED',
  SPAM: 'SPAM',
  ARCHIVED: 'ARCHIVED'
};

exports.PortalThemeMode = exports.$Enums.PortalThemeMode = {
  LIGHT: 'LIGHT',
  DARK: 'DARK',
  AUTO: 'AUTO'
};

exports.WorkflowStatus = exports.$Enums.WorkflowStatus = {
  DRAFT: 'DRAFT',
  ACTIVE: 'ACTIVE',
  PAUSED: 'PAUSED',
  ARCHIVED: 'ARCHIVED'
};

exports.ExecutionStatus = exports.$Enums.ExecutionStatus = {
  RUNNING: 'RUNNING',
  WAITING: 'WAITING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED'
};

exports.CustomFieldType = exports.$Enums.CustomFieldType = {
  TEXT: 'TEXT',
  TEXTAREA: 'TEXTAREA',
  NUMBER: 'NUMBER',
  CURRENCY: 'CURRENCY',
  DATE: 'DATE',
  DATETIME: 'DATETIME',
  BOOLEAN: 'BOOLEAN',
  SELECT: 'SELECT',
  MULTI_SELECT: 'MULTI_SELECT',
  EMAIL: 'EMAIL',
  URL: 'URL',
  PHONE: 'PHONE',
  LOOKUP: 'LOOKUP',
  FORMULA: 'FORMULA'
};

exports.CaseStatus = exports.$Enums.CaseStatus = {
  NEW: 'NEW',
  OPEN: 'OPEN',
  IN_PROGRESS: 'IN_PROGRESS',
  WAITING_ON_CUSTOMER: 'WAITING_ON_CUSTOMER',
  WAITING_ON_THIRD_PARTY: 'WAITING_ON_THIRD_PARTY',
  ESCALATED: 'ESCALATED',
  RESOLVED: 'RESOLVED',
  CLOSED: 'CLOSED'
};

exports.CasePriority = exports.$Enums.CasePriority = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  CRITICAL: 'CRITICAL'
};

exports.CaseOrigin = exports.$Enums.CaseOrigin = {
  EMAIL: 'EMAIL',
  PHONE: 'PHONE',
  WEB: 'WEB',
  CHAT: 'CHAT',
  SOCIAL: 'SOCIAL',
  PORTAL: 'PORTAL',
  INTERNAL: 'INTERNAL'
};

exports.CaseType = exports.$Enums.CaseType = {
  QUESTION: 'QUESTION',
  PROBLEM: 'PROBLEM',
  INCIDENT: 'INCIDENT',
  FEATURE_REQUEST: 'FEATURE_REQUEST',
  TASK: 'TASK'
};

exports.AgentStatus = exports.$Enums.AgentStatus = {
  ONLINE: 'ONLINE',
  AWAY: 'AWAY',
  BUSY: 'BUSY',
  OFFLINE: 'OFFLINE'
};

exports.ChannelType = exports.$Enums.ChannelType = {
  CASE: 'CASE',
  CHAT: 'CHAT',
  PHONE_CALL: 'PHONE_CALL',
  EMAIL_INBOUND: 'EMAIL_INBOUND',
  SOCIAL_MESSAGE: 'SOCIAL_MESSAGE'
};

exports.RoutingStrategy = exports.$Enums.RoutingStrategy = {
  ROUND_ROBIN: 'ROUND_ROBIN',
  LEAST_BUSY: 'LEAST_BUSY',
  SKILL_BASED: 'SKILL_BASED',
  PRIORITY_QUEUE: 'PRIORITY_QUEUE'
};

exports.KBArticleStatus = exports.$Enums.KBArticleStatus = {
  DRAFT: 'DRAFT',
  PUBLISHED: 'PUBLISHED',
  ARCHIVED: 'ARCHIVED'
};

exports.ApprovalProcessStatus = exports.$Enums.ApprovalProcessStatus = {
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
  DRAFT: 'DRAFT'
};

exports.ApprovalRequestStatus = exports.$Enums.ApprovalRequestStatus = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  RECALLED: 'RECALLED'
};

exports.ApprovalAction = exports.$Enums.ApprovalAction = {
  APPROVE: 'APPROVE',
  REJECT: 'REJECT',
  RECALL: 'RECALL',
  REASSIGN: 'REASSIGN'
};

exports.Prisma.ModelName = {
  crm_Accounts: 'crm_Accounts',
  crm_Leads: 'crm_Leads',
  crm_Opportunities: 'crm_Opportunities',
  crm_campaigns: 'crm_campaigns',
  crm_Outreach_Campaigns: 'crm_Outreach_Campaigns',
  crm_Outreach_Items: 'crm_Outreach_Items',
  crm_Opportunities_Sales_Stages: 'crm_Opportunities_Sales_Stages',
  crm_Opportunities_Type: 'crm_Opportunities_Type',
  crm_Contacts: 'crm_Contacts',
  crm_Contracts: 'crm_Contracts',
  Boards: 'Boards',
  ProjectMember: 'ProjectMember',
  Employees: 'Employees',
  ImageUpload: 'ImageUpload',
  MyAccount: 'MyAccount',
  Invoices: 'Invoices',
  invoice_States: 'invoice_States',
  Documents: 'Documents',
  Documents_Types: 'Documents_Types',
  Sections: 'Sections',
  crm_Industry_Type: 'crm_Industry_Type',
  modulStatus: 'modulStatus',
  Tasks: 'Tasks',
  crm_Accounts_Tasks: 'crm_Accounts_Tasks',
  tasksComments: 'tasksComments',
  TodoList: 'TodoList',
  Role: 'Role',
  Users: 'Users',
  Team: 'Team',
  CustomRole: 'CustomRole',
  Plan: 'Plan',
  system_Modules_Enabled: 'system_Modules_Enabled',
  secondBrain_notions: 'secondBrain_notions',
  openAi_keys: 'openAi_keys',
  gmail_Tokens: 'gmail_Tokens',
  microsoft_Tokens: 'microsoft_Tokens',
  TeamEmailConfig: 'TeamEmailConfig',
  systemServices: 'systemServices',
  oauth_Authorization_Codes: 'oauth_Authorization_Codes',
  AiModel: 'AiModel',
  SystemAiConfig: 'SystemAiConfig',
  TeamAiConfig: 'TeamAiConfig',
  TeamSmsConfig: 'TeamSmsConfig',
  TeamCaptchaConfig: 'TeamCaptchaConfig',
  chat_Sessions: 'chat_Sessions',
  chat_Messages: 'chat_Messages',
  crm_Lead_Pools: 'crm_Lead_Pools',
  crm_Lead_Gen_Jobs: 'crm_Lead_Gen_Jobs',
  crm_Lead_Source_Events: 'crm_Lead_Source_Events',
  crm_Lead_Candidates: 'crm_Lead_Candidates',
  crm_Contact_Candidates: 'crm_Contact_Candidates',
  crm_Lead_Pools_Leads: 'crm_Lead_Pools_Leads',
  crm_Contact_Candidate_Leads: 'crm_Contact_Candidate_Leads',
  crm_Global_Companies: 'crm_Global_Companies',
  crm_Global_Persons: 'crm_Global_Persons',
  crm_Lead_Activities: 'crm_Lead_Activities',
  Project_Button_Sets: 'Project_Button_Sets',
  Project_Opportunities: 'Project_Opportunities',
  FooterSection: 'FooterSection',
  FooterLink: 'FooterLink',
  FooterSetting: 'FooterSetting',
  BlogPost: 'BlogPost',
  JobPosting: 'JobPosting',
  JobApplication: 'JobApplication',
  DocArticle: 'DocArticle',
  SocialSettings: 'SocialSettings',
  SupportTicket: 'SupportTicket',
  SystemActivity: 'SystemActivity',
  PageView: 'PageView',
  SystemAuthConfig: 'SystemAuthConfig',
  InternalMessage: 'InternalMessage',
  InternalMessageRecipient: 'InternalMessageRecipient',
  Form: 'Form',
  FormView: 'FormView',
  FormField: 'FormField',
  FormSubmission: 'FormSubmission',
  MediaItem: 'MediaItem',
  crm_Message_Portal: 'crm_Message_Portal',
  crm_Portal_Message: 'crm_Portal_Message',
  crm_Portal_Recipient: 'crm_Portal_Recipient',
  crm_Portal_Message_Recipient: 'crm_Portal_Message_Recipient',
  crm_Portal_Message_View: 'crm_Portal_Message_View',
  RolePermission: 'RolePermission',
  SavedReport: 'SavedReport',
  crm_DealRooms: 'crm_DealRooms',
  crm_DealRoom_Activities: 'crm_DealRoom_Activities',
  crm_Workflow: 'crm_Workflow',
  crm_Workflow_Execution: 'crm_Workflow_Execution',
  CustomObjectDefinition: 'CustomObjectDefinition',
  CustomFieldDefinition: 'CustomFieldDefinition',
  CustomRecord: 'CustomRecord',
  PageLayout: 'PageLayout',
  crm_Cases: 'crm_Cases',
  crm_Case_Comments: 'crm_Case_Comments',
  CaseStatusTransition: 'CaseStatusTransition',
  SLA_Policy: 'SLA_Policy',
  SLA_Milestone: 'SLA_Milestone',
  SLA_MilestoneInstance: 'SLA_MilestoneInstance',
  AgentPresence: 'AgentPresence',
  AgentSkill: 'AgentSkill',
  RoutingConfig: 'RoutingConfig',
  KnowledgeCategory: 'KnowledgeCategory',
  KnowledgeArticle: 'KnowledgeArticle',
  KnowledgeArticleLink: 'KnowledgeArticleLink',
  ValidationRule: 'ValidationRule',
  ApprovalProcess: 'ApprovalProcess',
  ApprovalStep: 'ApprovalStep',
  ApprovalRequest: 'ApprovalRequest',
  ApprovalRequestAction: 'ApprovalRequestAction',
  Notification: 'Notification',
  crm_Products: 'crm_Products',
  crm_ProductBundles: 'crm_ProductBundles',
  crm_Quotes: 'crm_Quotes',
  crm_QuoteItems: 'crm_QuoteItems',
  DashboardPreference: 'DashboardPreference',
  NavigationConfig: 'NavigationConfig',
  Tenant_Integrations: 'Tenant_Integrations',
  crm_Subscriptions: 'crm_Subscriptions'
};

/**
 * This is a stub Prisma Client that will error at runtime if called.
 */
class PrismaClient {
  constructor() {
    return new Proxy(this, {
      get(target, prop) {
        let message
        const runtime = getRuntime()
        if (runtime.isEdge) {
          message = `PrismaClient is not configured to run in ${runtime.prettyName}. In order to run Prisma Client on edge runtime, either:
- Use Prisma Accelerate: https://pris.ly/d/accelerate
- Use Driver Adapters: https://pris.ly/d/driver-adapters
`;
        } else {
          message = 'PrismaClient is unable to run in this browser environment, or has been bundled for the browser (running in `' + runtime.prettyName + '`).'
        }
        
        message += `
If this is unexpected, please open an issue: https://pris.ly/prisma-prisma-bug-report`

        throw new Error(message)
      }
    })
  }
}

exports.PrismaClient = PrismaClient

Object.assign(exports, Prisma)
