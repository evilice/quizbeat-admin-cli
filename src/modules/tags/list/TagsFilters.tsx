import { Box, Button, TextField } from '@mui/material';

type TagsFiltersProps = {
  search: string;
  onSearchChange: (value: string) => void;
  onCreate: () => void;
};

export const TagsFilters = ({
  search,
  onSearchChange,
  onCreate,
}: TagsFiltersProps) => {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <TextField
        fullWidth
        label="Поиск по названию"
        value={search}
        onChange={(event) => {
          onSearchChange(event.target.value);
        }}
      />
      <Button fullWidth variant="contained" onClick={onCreate}>
        Создать
      </Button>
    </Box>
  );
};
