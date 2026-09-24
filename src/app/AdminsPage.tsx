import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { observer } from 'mobx-react-lite';
import { useEffect, useState } from 'react';
import { ApiError } from '../api/api-error.ts';
import {
  type Admin,
  type ListAdminsParams,
  type PaginatedAdmins,
} from '../stores/admins-store.ts';
import type { StaffRole } from '../stores/parse-access-token.ts';
import { useRootStore } from '../stores/root-store-context.tsx';
import { CreateAdminDialog } from './CreateAdminDialog.tsx';
import { ErrorMessages } from './ErrorMessages.tsx';

type RoleFilter = 'all' | StaffRole;
type ActivityFilter = 'all' | 'active' | 'inactive';

const ROLE_LABELS: Record<StaffRole, string> = {
  ADMIN: 'Админ',
  SUPER_ADMIN: 'Супер-админ',
};

const EMPTY_LIST_MESSAGE = 'Никого не найдено';

const DEACTIVATE_CONFIRM_TEXT =
  'Учётка перестанет входить и продлевать сессию. Уже выданный access доживёт до своего TTL. Активировать снова можно.';

export const AdminsPage = observer(function AdminsPage() {
  const { admins, session } = useRootStore();
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');
  const [activityFilter, setActivityFilter] = useState<ActivityFilter>('all');
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<PaginatedAdmins | null>(null);
  const [messages, setMessages] = useState<readonly string[]>([]);
  const [loading, setLoading] = useState(false);
  const [listVersion, setListVersion] = useState(0);
  const [createOpen, setCreateOpen] = useState(false);
  const [deactivateTarget, setDeactivateTarget] = useState<Admin | null>(null);
  const [actionPending, setActionPending] = useState(false);

  useEffect(() => {
    let cancelled = false;

    setLoading(true);
    setMessages([]);

    const params: ListAdminsParams = { page };
    if (search !== '') {
      params.search = search;
    }
    if (roleFilter !== 'all') {
      params.role = roleFilter;
    }
    if (activityFilter === 'active') {
      params.isActive = true;
    } else if (activityFilter === 'inactive') {
      params.isActive = false;
    }

    void admins
      .list(params)
      .then((pageResult) => {
        if (cancelled) {
          return;
        }
        setResult(pageResult);
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }
        setResult(null);
        if (error instanceof ApiError) {
          setMessages(error.messages);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [admins, search, roleFilter, activityFilter, page, listVersion]);

  const hasError = messages.length > 0;
  const items = result?.items ?? [];
  const total = result?.total ?? 0;
  const limit = result?.limit ?? 20;
  const currentPage = result?.page ?? page;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const showEmpty =
    !loading && !hasError && result !== null && items.length === 0;
  // Таблицаца остаётся при ошибке действия (409): result не сбрасываем.
  // При 403 списка result = null, items пусты — таблицы нет.
  const showTable = items.length > 0;

  function reloadList() {
    setListVersion((current) => current + 1);
  }

  async function handleRoleChange(admin: Admin, nextRole: StaffRole) {
    if (nextRole === admin.role || actionPending) {
      return;
    }
    setActionPending(true);
    setMessages([]);
    try {
      await admins.update(admin.id, { role: nextRole });
      reloadList();
    } catch (error) {
      if (error instanceof ApiError) {
        setMessages(error.messages);
      }
    } finally {
      setActionPending(false);
    }
  }

  async function handleActivate(admin: Admin) {
    if (actionPending) {
      return;
    }
    setActionPending(true);
    setMessages([]);
    try {
      await admins.update(admin.id, { isActive: true });
      reloadList();
    } catch (error) {
      if (error instanceof ApiError) {
        setMessages(error.messages);
      }
    } finally {
      setActionPending(false);
    }
  }

  async function handleConfirmDeactivate() {
    if (deactivateTarget === null || actionPending) {
      return;
    }
    const targetId = deactivateTarget.id;
    setActionPending(true);
    setMessages([]);
    try {
      await admins.deactivate(targetId);
      if (targetId === session.id) {
        session.forgetRefresh();
      }
      setDeactivateTarget(null);
      reloadList();
    } catch (error) {
      if (error instanceof ApiError) {
        setMessages(error.messages);
      }
    } finally {
      setActionPending(false);
    }
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Box
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 2,
          alignItems: 'flex-start',
        }}
      >
        <TextField
          label="Поиск по email"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
        />
        <FormControl sx={{ minWidth: 180 }}>
          <InputLabel id="admins-role-filter-label">Роль</InputLabel>
          <Select
            labelId="admins-role-filter-label"
            label="Роль"
            value={roleFilter}
            onChange={(event) => {
              setRoleFilter(event.target.value as RoleFilter);
              setPage(1);
            }}
          >
            <MenuItem value="all">Все</MenuItem>
            <MenuItem value="ADMIN">{ROLE_LABELS.ADMIN}</MenuItem>
            <MenuItem value="SUPER_ADMIN">{ROLE_LABELS.SUPER_ADMIN}</MenuItem>
          </Select>
        </FormControl>
        <FormControl sx={{ minWidth: 220 }}>
          <InputLabel id="admins-activity-filter-label">Активность</InputLabel>
          <Select
            labelId="admins-activity-filter-label"
            label="Активность"
            value={activityFilter}
            onChange={(event) => {
              setActivityFilter(event.target.value as ActivityFilter);
              setPage(1);
            }}
          >
            <MenuItem value="all">Все</MenuItem>
            <MenuItem value="active">Только активные</MenuItem>
            <MenuItem value="inactive">Только неактивные</MenuItem>
          </Select>
        </FormControl>
        <Button
          variant="contained"
          onClick={() => {
            setCreateOpen(true);
          }}
        >
          Создать
        </Button>
      </Box>

      <CreateAdminDialog
        open={createOpen}
        onClose={() => {
          setCreateOpen(false);
        }}
        onCreated={() => {
          setCreateOpen(false);
          reloadList();
        }}
      />

      <Dialog
        open={deactivateTarget !== null}
        onClose={() => {
          if (!actionPending) {
            setDeactivateTarget(null);
          }
        }}
      >
        <DialogTitle>
          Деактивировать {deactivateTarget?.email ?? ''}?
        </DialogTitle>
        <DialogContent>
          <DialogContentText>{DEACTIVATE_CONFIRM_TEXT}</DialogContentText>
          <ErrorMessages messages={messages} />
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setDeactivateTarget(null);
            }}
            disabled={actionPending}
          >
            Отмена
          </Button>
          <Button
            variant="contained"
            color="warning"
            onClick={() => {
              void handleConfirmDeactivate();
            }}
            disabled={actionPending}
          >
            Деактивировать
          </Button>
        </DialogActions>
      </Dialog>

      <ErrorMessages messages={messages} />

      {showEmpty ? <Typography>{EMPTY_LIST_MESSAGE}</Typography> : null}

      {showTable ? (
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
              <TableRow key={admin.id}>
                <TableCell>{admin.email}</TableCell>
                <TableCell>
                  {admin.isActive ? (
                    <FormControl size="small" sx={{ minWidth: 160 }}>
                      <InputLabel id={`admin-role-${admin.id}`}>
                        Роль сотрудника
                      </InputLabel>
                      <Select
                        labelId={`admin-role-${admin.id}`}
                        label="Роль сотрудника"
                        value={admin.role}
                        disabled={actionPending}
                        onChange={(event) => {
                          void handleRoleChange(
                            admin,
                            event.target.value as StaffRole,
                          );
                        }}
                      >
                        <MenuItem value="ADMIN">{ROLE_LABELS.ADMIN}</MenuItem>
                        <MenuItem value="SUPER_ADMIN">
                          {ROLE_LABELS.SUPER_ADMIN}
                        </MenuItem>
                      </Select>
                    </FormControl>
                  ) : (
                    ROLE_LABELS[admin.role]
                  )}
                </TableCell>
                <TableCell>
                  {admin.isActive ? 'активен' : 'неактивен'}
                </TableCell>
                <TableCell>
                  {admin.isActive ? (
                    <Button
                      disabled={actionPending}
                      onClick={() => {
                        setDeactivateTarget(admin);
                      }}
                    >
                      Деактивировать
                    </Button>
                  ) : (
                    <Button
                      disabled={actionPending}
                      onClick={() => {
                        void handleActivate(admin);
                      }}
                    >
                      Активировать
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : null}

      {showTable || (!hasError && result !== null && total > 0) ? (
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <Button
            disabled={currentPage <= 1 || loading}
            onClick={() => {
              setPage((current) => Math.max(1, current - 1));
            }}
          >
            Предыдущая страница
          </Button>
          <Typography>
            Страница {currentPage} из {totalPages}
          </Typography>
          <Button
            disabled={currentPage >= totalPages || loading}
            onClick={() => {
              setPage((current) => current + 1);
            }}
          >
            Следующая страница
          </Button>
        </Box>
      ) : null}
    </Box>
  );
});
