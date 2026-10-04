import { Box, Tab, Tabs } from '@mui/material';
import type { ReactNode } from 'react';
import type { CompositionCardTab } from './use-composition-card.ts';

const TABS: { id: CompositionCardTab; label: string }[] = [
  { id: 'general', label: 'Общее' },
  { id: 'audio', label: 'Аудио' },
  { id: 'images', label: 'Изображения' },
  { id: 'notes', label: 'Заметки' },
];

type CompositionCardTabsProps = {
  value: CompositionCardTab;
  onChange: (tab: CompositionCardTab) => void;
  general: ReactNode;
  audio: ReactNode;
  images: ReactNode;
  notes: ReactNode;
};

export const CompositionCardTabs = ({
  value,
  onChange,
  general,
  audio,
  images,
  notes,
}: CompositionCardTabsProps) => {
  const panels: Record<CompositionCardTab, ReactNode> = {
    general,
    audio,
    images,
    notes,
  };

  return (
    <Box>
      <Tabs
        value={value}
        onChange={(_event, next: CompositionCardTab) => {
          onChange(next);
        }}
        variant="scrollable"
        scrollButtons="auto"
        aria-label="Разделы композиции"
      >
        {TABS.map((item) => (
          <Tab
            key={item.id}
            value={item.id}
            label={item.label}
            id={`composition-tab-${item.id}`}
            aria-controls={`composition-tabpanel-${item.id}`}
          />
        ))}
      </Tabs>
      {TABS.map((item) => {
        const active = value === item.id;
        return (
          <Box
            key={item.id}
            role="tabpanel"
            id={`composition-tabpanel-${item.id}`}
            aria-labelledby={`composition-tab-${item.id}`}
            hidden={!active}
            sx={{
              display: active ? 'flex' : 'none',
              flexDirection: 'column',
              gap: 4,
              pt: 3,
            }}
          >
            {panels[item.id]}
          </Box>
        );
      })}
    </Box>
  );
};
