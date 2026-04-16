export interface ServiceRequest {
  data: Record<string, unknown>;
}

export interface ServiceResponse {
  responseCode: string;
  message?: string;
  [key: string]: unknown;
}

export interface ServiceDefinition {
  packageName: string;
  serviceId: string;
  execute: (request: ServiceRequest) => Promise<ServiceResponse>;
  responseCodes?: {
    success?: string[];
    failure?: string[];
  };
}
