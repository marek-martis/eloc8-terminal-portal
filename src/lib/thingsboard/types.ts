export interface ThingsboardAuthResponse {
  token: string;
  refreshToken: string;
}

export interface ThingsboardUser {
  id: { id: string; entityType: string };
  email: string;
  firstName: string;
  lastName: string;
  authority: "SYS_ADMIN" | "TENANT_ADMIN" | "CUSTOMER_USER";
  tenantId: { id: string; entityType: string };
  customerId?: { id: string; entityType: string };
}

export interface ThingsboardDevice {
  id: { id: string; entityType: string };
  name: string;
  type: string;
  label?: string;
  deviceProfileId?: { id: string; entityType: string };
  tenantId: { id: string; entityType: string };
  customerId?: { id: string; entityType: string };
  additionalInfo?: {
    description?: string;
    [key: string]: unknown;
  };
  createdTime: number;
}

export interface ThingsboardTelemetry {
  [key: string]: Array<{
    ts: number;
    value: string | number | boolean;
  }>;
}

export interface ThingsboardAttribute {
  key: string;
  value: string | number | boolean | object;
  lastUpdateTs: number;
}

export interface ThingsboardPageData<T> {
  data: T[];
  totalPages: number;
  totalElements: number;
  hasNext: boolean;
}

// WebSocket subscription types
export interface WsSubscriptionCmd {
  cmdId: number;
  entityType: "DEVICE" | "ASSET";
  entityId: string;
  scope?:
    | "LATEST_TELEMETRY"
    | "SHARED_SCOPE"
    | "CLIENT_SCOPE"
    | "SERVER_SCOPE";
  keys?: string[];
  timeWindow?: number;
  startTs?: number;
  endTs?: number;
}

export interface WsAuthCmd {
  authCmd: {
    cmdId: number;
    token: string;
  };
}

export interface WsSubscribeCmd {
  tsSubCmds?: WsSubscriptionCmd[];
  attrSubCmds?: WsSubscriptionCmd[];
}

export interface WsUnsubscribeCmd {
  tsSubCmds?: Array<{ cmdId: number; entityType: string; entityId: string }>;
}

export interface WsDataUpdate {
  subscriptionId: number;
  data: ThingsboardTelemetry;
}

export interface ThingsboardDeviceProfile {
  id: { id: string; entityType: string };
  name: string;
  type: "DEFAULT";
  description?: string;
  default?: boolean;
  tenantId: { id: string; entityType: string };
  createdTime: number;
}
