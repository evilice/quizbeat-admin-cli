import { Typography } from '@mui/material';

export function ErrorMessages({
  messages,
}: {
  messages: readonly string[];
}) {
  return (
    <>
      {messages.map((message, index) => (
        <Typography key={`${index}:${message}`} color="error">
          {message}
        </Typography>
      ))}
    </>
  );
}
