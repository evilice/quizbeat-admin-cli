import { Box, Button, Typography } from '@mui/material';

type ListPaginationProps = {
  currentPage: number;
  totalPages: number;
  loading: boolean;
  onPrevious: () => void;
  onNext: () => void;
};

export const ListPagination = ({
  currentPage,
  totalPages,
  loading,
  onPrevious,
  onNext,
}: ListPaginationProps) => {
  return (
    <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
      <Button disabled={currentPage <= 1 || loading} onClick={onPrevious}>
        Предыдущая страница
      </Button>
      <Typography>
        Страница {currentPage} из {totalPages}
      </Typography>
      <Button disabled={currentPage >= totalPages || loading} onClick={onNext}>
        Следующая страница
      </Button>
    </Box>
  );
};
