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
    <Box
      sx={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 2,
        alignItems: 'flex-start',
      }}
    >
      <TextField
        label="Поиск по названию"
        value={search}
        onChange={(event) => {
          onSearchChange(event.target.value);
        }}
      />
      <Button variant="contained" onClick={onCreate}>
        Создать
      </Button>
    </Box>
  );
};
