import { Box, IconButton, SvgIcon, Tooltip } from '@mui/material';

export const EDIT_ICON_PATH =
  'M3 17.25V21h3.75L17.81 9.94l-3.75-3.75zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75z';

export const DELETE_ICON_PATH =
  'M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6zM19 4h-3.5l-1-1h-5l-1 1H5v2h14z';

export const PLAY_ICON_PATH = 'M8 5v14l11-7z';

export const STOP_ICON_PATH = 'M6 6h12v12H6z';

export const ARROW_UP_ICON_PATH =
  'M4 12l1.41 1.41L11 7.83V20h2V7.83l5.58 5.59L20 12l-8-8-8 8z';

export const ARROW_DOWN_ICON_PATH =
  'M20 12l-1.41-1.41L13 16.17V4h-2v12.17l-5.58-5.59L4 12l8 8 8-8z';

type ActionIconButtonProps = {
  label: string;
  path: string;
  disabled?: boolean;
  fillRule?: 'evenodd';
  ariaLabel?: string;
  onClick: () => void;
};

export const ActionIconButton = ({
  label,
  path,
  disabled = false,
  fillRule,
  ariaLabel,
  onClick,
}: ActionIconButtonProps) => {
  return (
    <Tooltip title={label}>
      <Box component="span" sx={{ display: 'inline-flex' }}>
        <IconButton
          aria-label={ariaLabel ?? label}
          size="small"
          disabled={disabled}
          onClick={onClick}
        >
          <SvgIcon>
            <path d={path} fillRule={fillRule} />
          </SvgIcon>
        </IconButton>
      </Box>
    </Tooltip>
  );
};
