import type { StaffRole } from '../session/parse-access-token.ts';

export const MIN_PASSWORD_LENGTH = 8;

export const ROLE_LABELS: Record<StaffRole, string> = {
  ADMIN: 'Админ',
  SUPER_ADMIN: 'Супер-админ',
};

export const EMPTY_ADMINS_MESSAGE = 'Никого не найдено';

export const DEACTIVATE_CONFIRM_TEXT =
  'Учётка перестанет входить и продлевать сессию. Уже выданный access доживёт до своего TTL. Активировать снова можно.';

export const adminStatusLabel = (isActive: boolean): string => {
  return isActive ? 'активен' : 'неактивен';
};

export const passwordTooShortMessage = (): string => {
  return `Пароль должен быть не короче ${MIN_PASSWORD_LENGTH} символов`;
};
