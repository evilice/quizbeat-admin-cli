import {
  Box,
  Button,
  Chip,
  FormControl,
  InputLabel,
  MenuItem,
  OutlinedInput,
  Select,
  TextField,
} from '@mui/material';
import { STATUS_LABELS, tagDisplayName } from '../composition-display.ts';
import type { Tag } from '../../tags/tags-store.ts';
import type { StatusFilter } from './use-compositions-list.ts';

type CompositionsFiltersProps = {
  search: string;
  statusFilter: StatusFilter;
  selectedTagIds: string[];
  tagOptions: Tag[];
  onSearchChange: (value: string) => void;
  onStatusFilterChange: (value: StatusFilter) => void;
  onTagsFilterChange: (value: string[]) => void;
  onCreate: () => void;
};

export const CompositionsFilters = ({
  search,
  statusFilter,
  selectedTagIds,
  tagOptions,
  onSearchChange,
  onStatusFilterChange,
  onTagsFilterChange,
  onCreate,
}: CompositionsFiltersProps) => {
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
        label="Поиск по названию или автору"
        value={search}
        onChange={(event) => {
          onSearchChange(event.target.value);
        }}
      />
      <FormControl sx={{ minWidth: 180 }}>
        <InputLabel id="compositions-status-filter-label">Статус</InputLabel>
        <Select<StatusFilter>
          labelId="compositions-status-filter-label"
          label="Статус"
          value={statusFilter}
          onChange={(event) => {
            onStatusFilterChange(event.target.value);
          }}
        >
          <MenuItem value="all">Все</MenuItem>
          <MenuItem value="DRAFT">{STATUS_LABELS.DRAFT}</MenuItem>
          <MenuItem value="PUBLISHED">{STATUS_LABELS.PUBLISHED}</MenuItem>
        </Select>
      </FormControl>
      <FormControl sx={{ minWidth: 240 }}>
        <InputLabel id="compositions-tags-filter-label">Теги</InputLabel>
        <Select
          labelId="compositions-tags-filter-label"
          label="Теги"
          multiple
          value={selectedTagIds}
          input={<OutlinedInput label="Теги" />}
          onChange={(event) => {
            const value = event.target.value;
            onTagsFilterChange(
              typeof value === 'string' ? value.split(',') : value,
            );
          }}
          renderValue={(selected) => (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
              {selected.map((id) => {
                const tag = tagOptions.find((item) => item.id === id);
                return (
                  <Chip
                    key={id}
                    size="small"
                    label={tag ? tagDisplayName(tag) : id}
                  />
                );
              })}
            </Box>
          )}
        >
          {tagOptions.map((tag) => (
            <MenuItem key={tag.id} value={tag.id}>
              {tagDisplayName(tag)}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
      <Button variant="contained" onClick={onCreate}>
        Создать
      </Button>
    </Box>
  );
};
