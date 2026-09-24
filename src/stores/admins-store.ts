import { makeAutoObservable } from 'mobx';
import type { ApiClient } from '../api/api-client.ts';
import { ApiError } from '../api/api-error.ts';
import type { StaffRole } from './parse-access-token.ts';

export type Admin = {
  id: string;
  email: string;
  role: StaffRole;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type PaginatedAdmins = {
  items: Admin[];
  total: number;
  page: number;
  limit: number;
};

export type ListAdminsParams = {
  search?: string;
  role?: StaffRole;
  /** `undefined` — без фильтра (все). В query уходит строкой `true`/`false`. */
  isActive?: boolean;
  page?: number;
  limit?: number;
};

export type CreateAdminInput = {
  email: string;
  password: string;
  role: StaffRole;
};

export type UpdateAdminInput = {
  role?: StaffRole;
  isActive?: boolean;
};

export class AdminsStore {
  readonly api: ApiClient;

  constructor(api: ApiClient) {
    this.api = api;
    makeAutoObservable(
      this,
      {
        api: false,
      },
      { autoBind: true },
    );
  }

  async list(params: ListAdminsParams = {}): Promise<PaginatedAdmins> {
    const query = buildListQuery(params);
    const path = query === '' ? '/admins' : `/admins?${query}`;
    const page = await this.api.requestJson<PaginatedAdmins>(path, {
      method: 'GET',
    });
    if (page === undefined) {
      throw new ApiError(null, ['Пустой ответ списка сотрудников']);
    }
    return page;
  }

  async create(input: CreateAdminInput): Promise<Admin> {
    const admin = await this.api.requestJson<Admin>('/admins', {
      method: 'POST',
      body: {
        email: input.email,
        password: input.password,
        role: input.role,
      },
    });
    if (admin === undefined) {
      throw new ApiError(null, ['Пустой ответ создания сотрудника']);
    }
    return admin;
  }

  async update(id: string, input: UpdateAdminInput): Promise<Admin> {
    const body: { role?: StaffRole; isActive?: boolean } = {};
    if (input.role !== undefined) {
      body.role = input.role;
    }
    if (input.isActive !== undefined) {
      body.isActive = input.isActive;
    }

    const admin = await this.api.requestJson<Admin>(`/admins/${id}`, {
      method: 'PATCH',
      body,
    });
    if (admin === undefined) {
      throw new ApiError(null, ['Пустой ответ правки сотрудника']);
    }
    return admin;
  }

  async deactivate(id: string): Promise<Admin> {
    const admin = await this.api.requestJson<Admin>(`/admins/${id}`, {
      method: 'DELETE',
    });
    if (admin === undefined) {
      throw new ApiError(null, ['Пустой ответ деактивации сотрудника']);
    }
    return admin;
  }

  async resetPassword(id: string, newPassword: string): Promise<void> {
    await this.api.requestJson(`/admins/${id}/password`, {
      method: 'PATCH',
      body: { newPassword },
    });
  }
}

function buildListQuery(params: ListAdminsParams): string {
  const searchParams = new URLSearchParams();

  if (params.search !== undefined && params.search !== '') {
    searchParams.set('search', params.search);
  }
  if (params.role !== undefined) {
    searchParams.set('role', params.role);
  }
  if (params.isActive !== undefined) {
    searchParams.set('isActive', params.isActive ? 'true' : 'false');
  }
  if (params.page !== undefined) {
    searchParams.set('page', String(params.page));
  }
  if (params.limit !== undefined) {
    searchParams.set('limit', String(params.limit));
  }

  return searchParams.toString();
}
