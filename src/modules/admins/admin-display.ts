import type { StaffRole } from '../session/parse-access-token.ts';

export const MIN_PASSWORD_LENGTH = 8;

export const STAFF_ROLES: readonly StaffRole[] = ['ADMIN', 'SUPER_ADMIN'];

export const ROLE_LABELS: Record<StaffRole, string> = {
  ADMIN: 'Админ',
  SUPER_ADMIN: 'Супер-админ',
};

export const EMPTY_ADMINS_MESSAGE = 'Никого не найдено';

export const DEACTIVATE_CONFIRM_TEXT =
  'Учётка перестанет входить и продлевать сессию. Уже выданный access доживёт до своего TTL. Активировать снова можно.';

export const PASSWORD_RESET_NOTICE = 'Пароль задан';

export const SELF_ROLE_CHANGED_NOTICE =
  'Роль изменена. Токен текущей сессии обновится при следующем продлении, до этого сервер может отвечать отказом.';

export const adminStatusLabel = (isActive: boolean): string => {
  return isActive ? 'активен' : 'неактивен';
};

export const passwordTooShortMessage = (): string => {
  return `Пароль должен быть не короче ${MIN_PASSWORD_LENGTH} символов`;
};
