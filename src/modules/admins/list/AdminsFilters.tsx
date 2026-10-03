import {
  Box,
  Button,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  TextField,
} from '@mui/material';
import { ROLE_LABELS } from '../admin-display.ts';
import type { ActivityFilter, RoleFilter } from './use-admins-list.ts';

type AdminsFiltersProps = {
  search: string;
  roleFilter: RoleFilter;
  activityFilter: ActivityFilter;
  onSearchChange: (value: string) => void;
  onRoleFilterChange: (value: RoleFilter) => void;
  onActivityFilterChange: (value: ActivityFilter) => void;
  onCreate: () => void;
};

export const AdminsFilters = ({
  search,
  roleFilter,
  activityFilter,
  onSearchChange,
  onRoleFilterChange,
  onActivityFilterChange,
  onCreate,
}: AdminsFiltersProps) => {
  return (
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
          onSearchChange(event.target.value);
        }}
      />
      <FormControl sx={{ minWidth: 180 }}>
        <InputLabel id="admins-role-filter-label">Роль</InputLabel>
        <Select
          labelId="admins-role-filter-label"
          label="Роль"
          value={roleFilter}
          onChange={(event) => {
            onRoleFilterChange(event.target.value as RoleFilter);
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
            onActivityFilterChange(event.target.value as ActivityFilter);
          }}
        >
          <MenuItem value="all">Все</MenuItem>
          <MenuItem value="active">Только активные</MenuItem>
          <MenuItem value="inactive">Только неактивные</MenuItem>
        </Select>
      </FormControl>
      <Button variant="contained" onClick={onCreate}>
        Создать
      </Button>
    </Box>
  );
};
