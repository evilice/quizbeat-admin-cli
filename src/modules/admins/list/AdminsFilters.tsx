import {
  Box,
  Button,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  TextField,
} from '@mui/material';
import { ROLE_LABELS, STAFF_ROLES } from '../admin-display.ts';
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
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <TextField
        fullWidth
        label="Поиск по email"
        value={search}
        onChange={(event) => {
          onSearchChange(event.target.value);
        }}
      />
      <FormControl fullWidth>
        <InputLabel id="admins-role-filter-label">Роль</InputLabel>
        <Select<RoleFilter>
          labelId="admins-role-filter-label"
          label="Роль"
          value={roleFilter}
          onChange={(event) => {
            onRoleFilterChange(event.target.value);
          }}
        >
          <MenuItem value="all">Все</MenuItem>
          {STAFF_ROLES.map((staffRole) => (
            <MenuItem key={staffRole} value={staffRole}>
              {ROLE_LABELS[staffRole]}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
      <FormControl fullWidth>
        <InputLabel id="admins-activity-filter-label">Активность</InputLabel>
        <Select<ActivityFilter>
          labelId="admins-activity-filter-label"
          label="Активность"
          value={activityFilter}
          onChange={(event) => {
            onActivityFilterChange(event.target.value);
          }}
        >
          <MenuItem value="all">Все</MenuItem>
          <MenuItem value="active">Только активные</MenuItem>
          <MenuItem value="inactive">Только неактивные</MenuItem>
        </Select>
      </FormControl>
      <Button fullWidth variant="contained" onClick={onCreate}>
        Создать
      </Button>
    </Box>
  );
};
