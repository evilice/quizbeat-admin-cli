import { Box, Button, TextField } from '@mui/material';

type ArtistsFiltersProps = {
  search: string;
  onSearchChange: (value: string) => void;
  onCreate: () => void;
};

export const ArtistsFilters = ({
  search,
  onSearchChange,
  onCreate,
}: ArtistsFiltersProps) => {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <TextField
        fullWidth
        label="Поиск по имени"
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
