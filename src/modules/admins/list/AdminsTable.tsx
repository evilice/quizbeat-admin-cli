import {
  Box,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
} from '@mui/material';
import { ActionIconButton } from '../../../shared/ui/ActionIconButton.tsx';
import type { StaffRole } from '../../session/parse-access-token.ts';
import {
  ROLE_LABELS,
  STAFF_ROLES,
  adminStatusLabel,
} from '../admin-display.ts';
import type { Admin } from '../admins-store.ts';

const LOCK_RESET_ICON_PATH =
  'M13 3c-4.97 0-9 4.03-9 9H1l4 4 4-4H6c0-3.86 3.14-7 7-7s7 3.14 7 7-3.14 7-7 7c-1.9 0-3.62-.76-4.88-1.99L6.7 18.42C8.32 20.01 10.55 21 13 21c4.97 0 9-4.03 9-9s-4.03-9-9-9m2 8v-1c0-1.1-.9-2-2-2s-2 .9-2 2v1c-.55 0-1 .45-1 1v3c0 .55.45 1 1 1h4c.55 0 1-.45 1-1v-3c0-.55-.45-1-1-1m-1 0h-2v-1c0-.55.45-1 1-1s1 .45 1 1z';

const PERSON_OFF_ICON_PATH =
  'M8.65 5.82C9.36 4.72 10.6 4 12 4c2.21 0 4 1.79 4 4 0 1.4-.72 2.64-1.82 3.35zM20 17.17c-.02-1.1-.63-2.11-1.61-2.62-.54-.28-1.13-.54-1.77-.76zm1.19 4.02L2.81 2.81 1.39 4.22l8.89 8.89c-1.81.23-3.39.79-4.67 1.45-1 .51-1.61 1.54-1.61 2.66V20h13.17l2.61 2.61z';

const HOW_TO_REG_ICON_PATH =
  'm9 17 3-2.94c-.39-.04-.68-.06-1-.06-2.67 0-8 1.34-8 4v2h9zm2-5c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4m4.47 8.5L12 17l1.4-1.41 2.07 2.08 5.13-5.17 1.4 1.41z';

type AdminsTableProps = {
  items: readonly Admin[];
  actionPending: boolean;
  onRoleChange: (admin: Admin, role: StaffRole) => void | Promise<void>;
  onResetPassword: (admin: Admin) => void;
  onDeactivate: (admin: Admin) => void;
  onActivate: (admin: Admin) => void | Promise<void>;
};

export const AdminsTable = ({
  items,
  actionPending,
  onRoleChange,
  onResetPassword,
  onDeactivate,
  onActivate,
}: AdminsTableProps) => {
  return (
    <Table>
      <TableHead>
        <TableRow>
          <TableCell>Email</TableCell>
          <TableCell>Роль</TableCell>
          <TableCell>Статус</TableCell>
          <TableCell align="right">Действия</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {items.map((admin) => (
          <AdminRow
            key={admin.id}
            admin={admin}
            actionPending={actionPending}
            onRoleChange={onRoleChange}
            onResetPassword={onResetPassword}
            onDeactivate={onDeactivate}
            onActivate={onActivate}
          />
        ))}
      </TableBody>
    </Table>
  );
};

type AdminRowProps = {
  admin: Admin;
  actionPending: boolean;
  onRoleChange: (admin: Admin, role: StaffRole) => void | Promise<void>;
  onResetPassword: (admin: Admin) => void;
  onDeactivate: (admin: Admin) => void;
  onActivate: (admin: Admin) => void | Promise<void>;
};

const AdminRow = ({
  admin,
  actionPending,
  onRoleChange,
  onResetPassword,
  onDeactivate,
  onActivate,
}: AdminRowProps) => {
  return (
    <TableRow>
      <TableCell>{admin.email}</TableCell>
      <TableCell>
        {admin.isActive ? (
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel id={`admin-role-${admin.id}`}>
              Роль сотрудника
            </InputLabel>
            <Select<StaffRole>
              labelId={`admin-role-${admin.id}`}
              label="Роль сотрудника"
              value={admin.role}
              disabled={actionPending}
              onChange={(event) => {
                void onRoleChange(admin, event.target.value);
              }}
            >
              {STAFF_ROLES.map((staffRole) => (
                <MenuItem key={staffRole} value={staffRole}>
                  {ROLE_LABELS[staffRole]}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        ) : (
          ROLE_LABELS[admin.role]
        )}
      </TableCell>
      <TableCell>{adminStatusLabel(admin.isActive)}</TableCell>
      <TableCell align="right">
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 0.5 }}>
          <ActionIconButton
            label="Сбросить пароль"
            disabled={actionPending}
            path={LOCK_RESET_ICON_PATH}
            onClick={() => {
              onResetPassword(admin);
            }}
          />
          {admin.isActive ? (
            <ActionIconButton
              label="Деактивировать"
              disabled={actionPending}
              path={PERSON_OFF_ICON_PATH}
              onClick={() => {
                onDeactivate(admin);
              }}
            />
          ) : (
            <ActionIconButton
              label="Активировать"
              disabled={actionPending}
              path={HOW_TO_REG_ICON_PATH}
              fillRule="evenodd"
              onClick={() => {
                void onActivate(admin);
              }}
            />
          )}
        </Box>
      </TableCell>
    </TableRow>
  );
};
