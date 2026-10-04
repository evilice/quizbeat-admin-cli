import { Box } from '@mui/material';
import type { ReactNode } from 'react';

type ListWithFiltersProps = {
  filters: ReactNode;
  children: ReactNode;
};

export const ListWithFilters = ({
  filters,
  children,
}: ListWithFiltersProps) => {
  return (
    <Box sx={{ display: 'flex', gap: 3, alignItems: 'flex-start' }}>
      <Box
        sx={{
          flex: '1 1 auto',
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
          overflow: 'auto',
        }}
      >
        {children}
      </Box>
      <Box sx={{ flex: '0 0 320px', width: 320 }}>{filters}</Box>
    </Box>
  );
};
