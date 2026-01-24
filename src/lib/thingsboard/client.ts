import type {
  ThingsboardAuthResponse,
  ThingsboardDevice,
  ThingsboardDeviceProfile,
  ThingsboardPageData,
  ThingsboardTelemetry,
  ThingsboardUser,
} from "./types";

const TB_BASE_URL = process.env.THINGSBOARD_URL;

function getTokenExpiry(token: string): number {
  try {
    const payload = token.split(".")[1];
    const decoded = JSON.parse(Buffer.from(payload, "base64").toString());
    return decoded.exp ? decoded.exp * 1000 : 0;
  } catch {
    return 0;
  }
}

export class ThingsboardClient {
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private tokenExpiry: number = 0;

  constructor(tokens?: { accessToken: string; refreshToken: string }) {
    if (tokens) {
      this.accessToken = tokens.accessToken;
      this.refreshToken = tokens.refreshToken;
      this.tokenExpiry = getTokenExpiry(tokens.accessToken);
    }
  }

  async login(
    username: string,
    password: string
  ): Promise<ThingsboardAuthResponse> {
    const response = await fetch(`${TB_BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Authentication failed: ${error}`);
    }

    const data = await response.json();
    this.setTokens(data.token, data.refreshToken);
    return data;
  }

  async refreshAccessToken(): Promise<string> {
    if (!this.refreshToken) {
      throw new Error("No refresh token available");
    }

    const response = await fetch(`${TB_BASE_URL}/api/auth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: this.refreshToken }),
    });

    if (!response.ok) {
      throw new Error("Token refresh failed");
    }

    const data = await response.json();
    this.setTokens(data.token, data.refreshToken);
    return data.token;
  }

  async getCurrentUser(): Promise<ThingsboardUser> {
    return this.authenticatedRequest("/api/auth/user");
  }

  async getDevices(
    params: {
      pageSize?: number;
      page?: number;
      type?: string;
      textSearch?: string;
    } = {}
  ): Promise<ThingsboardPageData<ThingsboardDevice>> {
    const query = new URLSearchParams({
      pageSize: String(params.pageSize || 100),
      page: String(params.page || 0),
      ...(params.type && { type: params.type }),
      ...(params.textSearch && { textSearch: params.textSearch }),
    });

    return this.authenticatedRequest(`/api/tenant/devices?${query}`);
  }

  async getDevice(deviceId: string): Promise<ThingsboardDevice> {
    return this.authenticatedRequest(`/api/device/${deviceId}`);
  }

  async getDeviceAttributes(
    deviceId: string,
    scope: "SERVER_SCOPE" | "SHARED_SCOPE" | "CLIENT_SCOPE" = "SERVER_SCOPE"
  ) {
    return this.authenticatedRequest(
      `/api/plugins/telemetry/DEVICE/${deviceId}/values/attributes/${scope}`
    );
  }

  async getLatestTelemetry(
    deviceId: string,
    keys?: string[]
  ): Promise<ThingsboardTelemetry> {
    const query = keys ? `?keys=${keys.join(",")}` : "";
    return this.authenticatedRequest(
      `/api/plugins/telemetry/DEVICE/${deviceId}/values/timeseries${query}`
    );
  }

  async getHistoricalTelemetry(
    deviceId: string,
    keys: string[],
    startTs: number,
    endTs: number,
    interval?: number,
    agg?: "MIN" | "MAX" | "AVG" | "SUM" | "COUNT" | "NONE"
  ): Promise<ThingsboardTelemetry> {
    const params = new URLSearchParams({
      keys: keys.join(","),
      startTs: String(startTs),
      endTs: String(endTs),
      ...(interval && { interval: String(interval) }),
      ...(agg && { agg }),
    });

    return this.authenticatedRequest(
      `/api/plugins/telemetry/DEVICE/${deviceId}/values/timeseries?${params}`
    );
  }

  /**
   * Run an entity data query using ThingsBoard's entitiesQuery/find endpoint.
   */
  async findEntityData<T>(query: unknown): Promise<T> {
    return this.authenticatedRequest("/api/entitiesQuery/find", {
      method: "POST",
      body: JSON.stringify(query),
    });
  }

  /**
   * Count entities matching query criteria using ThingsBoard's entitiesQuery API.
   * Much more efficient than fetching all entities and counting client-side.
   */
  async countEntitiesByQuery(query: {
    entityFilter: {
      type: string;
      entityType?: string;
      [key: string]: unknown;
    };
    keyFilters?: Array<{
      key: {
        type: string;
        key: string;
      };
      valueType: string;
      predicate: {
        operation: string;
        value: {
          defaultValue: unknown;
          dynamicValue?: unknown;
        };
        type: string;
      };
    }>;
  }): Promise<number> {
    return this.authenticatedRequest("/api/entitiesQuery/count", {
      method: "POST",
      body: JSON.stringify(query),
    });
  }

  /**
   * Count all devices of a specific entity type
   */
  async countDevices(): Promise<number> {
    return this.countEntitiesByQuery({
      entityFilter: {
        type: "entityType",
        entityType: "DEVICE",
      },
    });
  }

  /**
   * Count devices with a specific attribute value
   */
  async countDevicesByAttribute(
    attributeKey: string,
    attributeValue: boolean | string | number,
    attributeType: "SERVER_SCOPE" | "SHARED_SCOPE" | "CLIENT_SCOPE" | "ATTRIBUTE" = "SERVER_SCOPE"
  ): Promise<number> {
    const valueType =
      typeof attributeValue === "boolean"
        ? "BOOLEAN"
        : typeof attributeValue === "number"
          ? "NUMERIC"
          : "STRING";

    const keyType =
      attributeType === "SERVER_SCOPE"
        ? "SERVER_ATTRIBUTE"
        : attributeType === "SHARED_SCOPE"
          ? "SHARED_ATTRIBUTE"
          : attributeType === "CLIENT_SCOPE"
            ? "CLIENT_ATTRIBUTE"
            : "ATTRIBUTE";

    return this.countEntitiesByQuery({
      entityFilter: {
        type: "entityType",
        entityType: "DEVICE",
      },
      keyFilters: [
        {
          key: {
            type: keyType,
            key: attributeKey,
          },
          valueType,
          predicate: {
            operation: "EQUAL",
            value: {
              defaultValue: attributeValue,
              dynamicValue: null,
            },
            type: valueType,
          },
        },
      ],
    });
  }

  /**
   * Count devices that haven't communicated within the specified number of days.
   * Uses the lastActivityTime server attribute.
   */
  async countStaleDevices(staleDays: number): Promise<number> {
    const cutoffTime = Date.now() - staleDays * 24 * 60 * 60 * 1000;

    return this.countEntitiesByQuery({
      entityFilter: {
        type: "entityType",
        entityType: "DEVICE",
      },
      keyFilters: [
        {
          key: {
            type: "SERVER_ATTRIBUTE",
            key: "lastActivityTime",
          },
          valueType: "NUMERIC",
          predicate: {
            operation: "LESS",
            value: {
              defaultValue: cutoffTime,
              dynamicValue: null,
            },
            type: "NUMERIC",
          },
        },
      ],
    });
  }

  /**
   * Count devices active since a specific timestamp using lastActivityTime.
   */
  async countDevicesByLastActivityTime(sinceTimestamp: number): Promise<number> {
    return this.countEntitiesByQuery({
      entityFilter: {
        type: "entityType",
        entityType: "DEVICE",
      },
      keyFilters: [
        {
          key: {
            type: "SERVER_ATTRIBUTE",
            key: "lastActivityTime",
          },
          valueType: "NUMERIC",
          predicate: {
            operation: "GREATER",
            value: {
              defaultValue: sinceTimestamp,
              dynamicValue: null,
            },
            type: "NUMERIC",
          },
        },
      ],
    });
  }

  /**
   * Get all device profiles for the tenant
   */
  async getDeviceProfiles(
    params: { pageSize?: number; page?: number } = {}
  ): Promise<ThingsboardPageData<ThingsboardDeviceProfile>> {
    const query = new URLSearchParams({
      pageSize: String(params.pageSize || 100),
      page: String(params.page || 0),
    });

    return this.authenticatedRequest(`/api/deviceProfiles?${query}`);
  }

  /**
   * Find devices where lastMidReceived is older than the stale threshold.
   * Note: This does NOT include devices missing the attribute entirely.
   * Use findDevicesMissingLastMidReceived() for those.
   */
  async findStaleDevices(params: {
    staleDays: number;
    pageSize?: number;
    page?: number;
  }): Promise<{
    data: Array<{
      entityId: { id: string; entityType: string };
      name: string;
      type: string;
      deviceProfileId?: string;
      lastMidReceived?: number;
    }>;
    totalElements: number;
    totalPages: number;
    hasNext: boolean;
  }> {
    const cutoffTime = Date.now() - params.staleDays * 24 * 60 * 60 * 1000;
    const pageSize = params.pageSize || 1000;
    const page = params.page || 0;

    const response = await this.authenticatedRequest<{
      data: Array<{
        entityId: { id: string; entityType: string };
        latest: {
          ENTITY_FIELD?: Record<string, { ts: number; value: string }>;
          SERVER_ATTRIBUTE?: Record<string, { ts: number; value: number }>;
        };
      }>;
      totalElements: number;
      totalPages: number;
      hasNext: boolean;
    }>("/api/entitiesQuery/find", {
      method: "POST",
      body: JSON.stringify({
        entityFilter: {
          type: "entityType",
          resolveMultiple: true,
          entityType: "DEVICE",
        },
        keyFilters: [
          {
            key: {
              type: "SERVER_ATTRIBUTE",
              key: "lastMidReceived",
            },
            valueType: "NUMERIC",
            predicate: {
              operation: "LESS",
              value: {
                defaultValue: cutoffTime,
                dynamicValue: null,
              },
              type: "NUMERIC",
            },
          },
        ],
        entityFields: [
          { type: "ENTITY_FIELD", key: "name" },
          { type: "ENTITY_FIELD", key: "type" },
          { type: "ENTITY_FIELD", key: "deviceProfileId" },
        ],
        latestValues: [
          { type: "SERVER_ATTRIBUTE", key: "lastMidReceived" },
        ],
        pageLink: {
          page,
          pageSize,
          sortOrder: {
            key: { key: "name", type: "ENTITY_FIELD" },
            direction: "ASC",
          },
        },
      }),
    });

    // Transform response to simpler format
    return {
      data: response.data.map((item) => ({
        entityId: item.entityId,
        name: item.latest.ENTITY_FIELD?.name?.value || "",
        type: item.latest.ENTITY_FIELD?.type?.value || "",
        deviceProfileId: item.latest.ENTITY_FIELD?.deviceProfileId?.value,
        lastMidReceived: item.latest.SERVER_ATTRIBUTE?.lastMidReceived?.value,
      })),
      totalElements: response.totalElements,
      totalPages: response.totalPages,
      hasNext: response.hasNext,
    };
  }

  /**
   * Find devices that do not have the lastMidReceived attribute at all.
   * These are considered stale because they've never reported.
   */
  async findDevicesMissingLastMidReceived(params: {
    pageSize?: number;
    page?: number;
    excludeDeviceIds?: Set<string>;
  }): Promise<{
    data: Array<{
      entityId: { id: string; entityType: string };
      name: string;
      type: string;
      deviceProfileId?: string;
    }>;
    totalElements: number;
    totalPages: number;
    hasNext: boolean;
  }> {
    const pageSize = params.pageSize || 1000;
    const page = params.page || 0;

    // Query all devices with lastMidReceived attribute requested
    const response = await this.authenticatedRequest<{
      data: Array<{
        entityId: { id: string; entityType: string };
        latest: {
          ENTITY_FIELD?: Record<string, { ts: number; value: string }>;
          SERVER_ATTRIBUTE?: Record<string, { ts: number; value: number }>;
        };
      }>;
      totalElements: number;
      totalPages: number;
      hasNext: boolean;
    }>("/api/entitiesQuery/find", {
      method: "POST",
      body: JSON.stringify({
        entityFilter: {
          type: "entityType",
          resolveMultiple: true,
          entityType: "DEVICE",
        },
        entityFields: [
          { type: "ENTITY_FIELD", key: "name" },
          { type: "ENTITY_FIELD", key: "type" },
          { type: "ENTITY_FIELD", key: "deviceProfileId" },
        ],
        latestValues: [
          { type: "SERVER_ATTRIBUTE", key: "lastMidReceived" },
        ],
        pageLink: {
          page,
          pageSize,
          sortOrder: {
            key: { key: "name", type: "ENTITY_FIELD" },
            direction: "ASC",
          },
        },
      }),
    });

    // Filter to only devices missing the lastMidReceived attribute
    const devicesWithoutAttribute = response.data.filter((item) => {
      const hasAttribute = item.latest.SERVER_ATTRIBUTE?.lastMidReceived?.value !== undefined;
      const isExcluded = params.excludeDeviceIds?.has(item.entityId.id);
      return !hasAttribute && !isExcluded;
    });

    return {
      data: devicesWithoutAttribute.map((item) => ({
        entityId: item.entityId,
        name: item.latest.ENTITY_FIELD?.name?.value || "",
        type: item.latest.ENTITY_FIELD?.type?.value || "",
        deviceProfileId: item.latest.ENTITY_FIELD?.deviceProfileId?.value,
      })),
      // Note: totalElements reflects the filtered count for this page only
      // The caller should aggregate across all pages
      totalElements: devicesWithoutAttribute.length,
      totalPages: response.totalPages,
      hasNext: response.hasNext,
    };
  }

  /**
   * Find all devices (including active ones) using the entitiesQuery/find API.
   * Returns devices with their lastMidReceived attribute.
   */
  async findAllDevicesWithActivity(params: {
    pageSize?: number;
    page?: number;
  }): Promise<{
    data: Array<{
      entityId: { id: string; entityType: string };
      name: string;
      type: string;
      deviceProfileId?: string;
      lastMidReceived?: number;
    }>;
    totalElements: number;
    totalPages: number;
    hasNext: boolean;
  }> {
    const pageSize = params.pageSize || 1000;
    const page = params.page || 0;

    const response = await this.authenticatedRequest<{
      data: Array<{
        entityId: { id: string; entityType: string };
        latest: {
          ENTITY_FIELD?: Record<string, { ts: number; value: string }>;
          SERVER_ATTRIBUTE?: Record<string, { ts: number; value: number }>;
        };
      }>;
      totalElements: number;
      totalPages: number;
      hasNext: boolean;
    }>("/api/entitiesQuery/find", {
      method: "POST",
      body: JSON.stringify({
        entityFilter: {
          type: "entityType",
          resolveMultiple: true,
          entityType: "DEVICE",
        },
        entityFields: [
          { type: "ENTITY_FIELD", key: "name" },
          { type: "ENTITY_FIELD", key: "type" },
          { type: "ENTITY_FIELD", key: "deviceProfileId" },
        ],
        latestValues: [
          { type: "SERVER_ATTRIBUTE", key: "lastMidReceived" },
        ],
        pageLink: {
          page,
          pageSize,
          sortOrder: {
            key: { key: "name", type: "ENTITY_FIELD" },
            direction: "ASC",
          },
        },
      }),
    });

    // Transform response to simpler format
    return {
      data: response.data.map((item) => ({
        entityId: item.entityId,
        name: item.latest.ENTITY_FIELD?.name?.value || "",
        type: item.latest.ENTITY_FIELD?.type?.value || "",
        deviceProfileId: item.latest.ENTITY_FIELD?.deviceProfileId?.value,
        lastMidReceived: item.latest.SERVER_ATTRIBUTE?.lastMidReceived?.value,
      })),
      totalElements: response.totalElements,
      totalPages: response.totalPages,
      hasNext: response.hasNext,
    };
  }

  getWebSocketUrl(): string {
    const wsProtocol = TB_BASE_URL?.startsWith("https") ? "wss" : "ws";
    const baseUrl = TB_BASE_URL?.replace(/^https?/, wsProtocol);
    return `${baseUrl}/api/ws/plugins/telemetry?token=${this.accessToken}`;
  }

  getTokens() {
    return {
      accessToken: this.accessToken,
      refreshToken: this.refreshToken,
    };
  }

  private setTokens(accessToken: string, refreshToken: string) {
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
    this.tokenExpiry = Date.now() + 9000 * 1000;
  }

  private async authenticatedRequest<T>(
    path: string,
    options: RequestInit = {}
  ): Promise<T> {
    if (!this.accessToken) {
      throw new Error("Not authenticated");
    }

    const now = Date.now();
    if (this.tokenExpiry > 0 && now >= this.tokenExpiry - 60000) {
      console.log("ThingsBoard token expired or expiring soon, refreshing...");
      await this.refreshAccessToken();
    }

    const response = await fetch(`${TB_BASE_URL}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        "X-Authorization": `Bearer ${this.accessToken}`,
        ...options.headers,
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        console.log("ThingsBoard returned 401, attempting token refresh...");
        try {
          await this.refreshAccessToken();
          return this.authenticatedRequest(path, options);
        } catch (refreshError) {
          throw new Error(`ThingsBoard authentication failed: ${refreshError instanceof Error ? refreshError.message : "Token refresh failed"}`);
        }
      }
      const errorText = await response.text().catch(() => "");
      throw new Error(`ThingsBoard API error: ${response.status} - ${errorText}`);
    }

    return response.json();
  }
}

export function createThingsboardClient(tokens?: {
  accessToken: string;
  refreshToken: string;
}) {
  return new ThingsboardClient(tokens);
}
