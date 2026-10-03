import {
  Box,
  Button,
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
import type { StaffRole } from '../../session/parse-access-token.ts';
import {
  ROLE_LABELS,
  STAFF_ROLES,
  adminStatusLabel,
} from '../admin-display.ts';
import type { Admin } from '../admins-store.ts';

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
          <TableCell>Действия</TableCell>
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
      <TableCell>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          <Button
            disabled={actionPending}
            onClick={() => {
              onResetPassword(admin);
            }}
          >
            Сбросить пароль
          </Button>
          {admin.isActive ? (
            <Button
              disabled={actionPending}
              onClick={() => {
                onDeactivate(admin);
              }}
            >
              Деактивировать
            </Button>
          ) : (
            <Button
              disabled={actionPending}
              onClick={() => {
                void onActivate(admin);
              }}
            >
              Активировать
            </Button>
          )}
        </Box>
      </TableCell>
    </TableRow>
  );
};
