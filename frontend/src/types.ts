/** Réponse paginée standard du backend */
export type Paginated<T> = {
  data: T[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export type User = {
  id: string
  email: string
  username: string | null
  role: string
  emailVerified: boolean
}

export type ModuleItem = {
  id: string
  key: string
  title: string
  version: string
  isEnabled: boolean
}

export type ProfileInfo = {
  user: User & {
    lastLoginAt: string | null
    createdAt: string
  }
  sessions: Array<{
    id: string
    ipAddress: string | null
    userAgent: string | null
    expiresAt: string
    revokedAt: string | null
    createdAt: string
    lastUsedAt: string | null
  }>
}

export type UserSetting = {
  id: string
  key: string
  valueJson: unknown
}

export type ActivityLog = {
  id: string
  action: string
  moduleKey: string | null
  targetType: string | null
  targetId: string | null
  createdAt: string
}

export type AuditLog = {
  id: string
  action: string
  targetType: string | null
  targetId: string | null
  ipAddress: string | null
  userAgent: string | null
  createdAt: string
}

export type ErrorLog = {
  id: string
  level: string
  message: string
  contextJson: unknown
  createdAt: string
}

export type DocumentItem = {
  id: string
  name: string
  type: string
  visibility: string
  mimeType: string
  size: number
  expiresAt: string | null
  createdAt: string
}

export type VehicleItem = {
  id: string
  name: string
  type: string
  status: string
  brand: string | null
  model: string | null
  year: number | null
  registration: string | null
  vin: string | null
  mileage: number
  fuelType: string | null
  color: string | null
  power: number | null
  purchaseDate: string | null
  purchasePrice: string | null
  insuranceExpiry: string | null
  ctExpiry: string | null
  notes: string | null
  _count?: { interventions: number; alerts: number }
}

export type VehiclePart = {
  id: string
  vehicleId: string
  name: string
  quantity: number
  category: string
  status: string
  urgency: string
  priority: string
  reference: string | null
  dimension: string | null
  estimatedPrice: string | null
  realPrice: string | null
  link: string | null
  comment: string | null
  createdAt: string
  updatedAt: string
}

export type VehicleDetail = VehicleItem & {
  mileageLogs: Array<{ id: string; mileage: number; date: string }>
  interventions: Array<{
    id: string; title: string; date: string; status: string
    costAmount: string | null; mileage: number | null; notes: string | null
  }>
  alerts: Array<{ id: string; title: string; type: string; dueDate: string | null; status: string }>
  documents: Array<{
    id: string
    context: string | null
    document: { id: string; name: string; mimeType: string; visibility: string; createdAt: string; expiresAt: string | null }
  }>
  stockMovements: Array<{
    id: string; type: string; quantity: string; valueAmount: string | null
    note: string | null; createdAt: string
    stockItem: { name: string; unit: string }
  }>
}

export type PropertyItem = {
  id: string
  name: string
  type: string
  status: string
  address: string | null
  city: string | null
  postalCode: string | null
  country: string
  surface: string | null
  rooms: number | null
  purchasePrice: string | null
  estimatedValue: string | null
  notes: string | null
  _count?: { events: number }
}

export type PropertyDetail = PropertyItem & {
  events: Array<{ id: string; type: string; title: string; date: string; amount: string | null; status: string }>
  documents: Array<{
    id: string
    context: string | null
    document: { id: string; name: string; mimeType: string; visibility: string; expiresAt: string | null; createdAt: string }
  }>
}

export type ContactItem = {
  id: string
  kind: string
  displayName: string
  organization: string | null
  email: string | null
  phone: string | null
  address: string | null
  city: string | null
  postalCode: string | null
  country: string
  tagsJson: string[] | null
  notes: string | null
  _count?: { interactions: number }
}

export type ContactDetail = ContactItem & {
  interactions: Array<{ id: string; type: string; title: string; date: string; notes: string | null }>
  documents: Array<{
    id: string
    context: string | null
    document: { id: string; name: string; mimeType: string; visibility: string; expiresAt: string | null; createdAt: string }
  }>
}

export type FinancialSummary = {
  accountCount: number
  transactionCount: number
  income: number
  expense: number
  balance: number
}

export type FinancialAccount = {
  id: string
  name: string
  type: string
  currency: string
  initialBalance: string
}

export type FinancialCategory = {
  id: string
  name: string
  type: string
  color: string | null
}

export type FinancialTransaction = {
  id: string
  type: string
  amount: string
  label: string
  note: string | null
  operationDate: string
  sourceModule: string | null
  sourceType: string | null
  sourceId: string | null
  status: string
  account: FinancialAccount
  category: FinancialCategory | null
}

export type StockItemStatus = 'in-stock' | 'to-buy'

export type StockItem = {
  id: string
  name: string
  category: string
  unit: string
  quantity: string
  /** 'to-buy' = wishlist d'achat (pas encore en stock). 'in-stock' = défaut. */
  status: StockItemStatus
  location: string | null
  valueAmount: string | null
  thresholdEnabled: boolean
  threshold: string | null
  reference: string | null
  supplier: string | null
  notes: string | null
}

export type StockMovement = {
  id: string
  type: string
  quantity: string
  valueAmount: string | null
  targetType: string | null
  targetId: string | null
  note: string | null
  createdAt: string
  stockItem: { id: string; name: string; unit: string; category: string }
}

export type ToolLoan = {
  id: string
  borrowerName: string
  loanDate: string
  expectedReturnDate: string | null
  returnedAt: string | null
  notes: string | null
  createdAt: string
  stockItem: { id: string; name: string; unit: string }
}

export type AgendaDashboard = {
  openTasks: number
  overdueTasks: number
  unreadNotifications: number
  upcomingTasks: Array<{ id: string; title: string; priority: string; dueDate: string }>
}

export type TaskItem = {
  id: string
  title: string
  description: string | null
  status: string
  priority: string
  dueDate: string | null
  moduleKey: string | null
  progress: number
  subtasks: Array<{ id: string; title: string; isDone: boolean; position: number }>
}

export type NotificationItem = {
  id: string
  type: string
  title: string
  message: string | null
  importance: string
  dueDate: string | null
  isRead: boolean
}

export type SearchResult = {
  type: string
  id: string
  title: string
  subtitle: string
}

export type ReportSummary = {
  generatedAt: string
  counts: {
    vehicles: number
    contacts: number
    properties: number
    documents: number
    stockItems: number
    openTasks: number
    unreadNotifications: number
    transactions: number
  }
  finance: { income: number; expense: number; net: number }
}
