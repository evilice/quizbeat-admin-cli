import { Autocomplete, Box, Chip, TextField } from '@mui/material';
import {
  ActionIconButton,
  ARROW_DOWN_ICON_PATH,
  ARROW_UP_ICON_PATH,
  DELETE_ICON_PATH,
} from '../../../shared/ui/ActionIconButton.tsx';
import { ErrorMessages } from '../../../shared/ui/ErrorMessages.tsx';
import type { CompositionArtist } from '../../artists/artists-store.ts';
import {
  buildArtistOptions,
  isCreateArtistOption,
  useArtistsField,
  type ArtistOption,
} from './use-artists-field.ts';

type ArtistsFieldProps = {
  value: CompositionArtist[];
  onChange: (artists: CompositionArtist[]) => void;
  onCreatingChange?: (creating: boolean) => void;
};

const createOptionLabel = (option: ArtistOption): string => {
  return isCreateArtistOption(option)
    ? `Создать «${option.name}»`
    : option.name;
};

export const ArtistsField = ({
  value,
  onChange,
  onCreatingChange,
}: ArtistsFieldProps) => {
  const {
    inputValue,
    options,
    loading,
    messages,
    handleChange,
    handleInputChange,
    removeArtist,
    moveArtist,
  } = useArtistsField(value, onChange, onCreatingChange);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <Autocomplete<ArtistOption, true, false, false>
        multiple
        disableCloseOnSelect
        options={options}
        value={value}
        inputValue={inputValue}
        loading={loading}
        loadingText="Загрузка…"
        noOptionsText="Ничего не найдено"
        filterOptions={(candidates, state) => {
          return buildArtistOptions(candidates, state.inputValue);
        }}
        getOptionLabel={createOptionLabel}
        getOptionKey={(option) => {
          return isCreateArtistOption(option)
            ? `create:${option.name}`
            : option.id;
        }}
        isOptionEqualToValue={(option, selected) => {
          return (
            !isCreateArtistOption(option) &&
            !isCreateArtistOption(selected) &&
            option.id === selected.id
          );
        }}
        onInputChange={(_, next, reason) => {
          handleInputChange(next, reason);
        }}
        onChange={(_, next) => {
          handleChange(next);
        }}
        renderOption={(props, option) => {
          const { key, ...optionProps } = props;
          return (
            <Box component="li" key={key} {...optionProps}>
              {createOptionLabel(option)}
            </Box>
          );
        }}
        renderValue={(selected, getItemProps) => {
          return selected.map((artist, index) => {
            if (isCreateArtistOption(artist)) {
              return null;
            }
            const itemProps = getItemProps({ index });
            return (
              <Box
                key={itemProps.key}
                className={itemProps.className}
                data-item-index={itemProps['data-item-index']}
                tabIndex={itemProps.tabIndex}
                sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}
              >
                <Chip size="small" label={artist.name} />
                <ActionIconButton
                  label="Выше"
                  ariaLabel={`Выше: ${artist.name}`}
                  path={ARROW_UP_ICON_PATH}
                  disabled={index === 0}
                  onClick={() => {
                    moveArtist(index, -1);
                  }}
                />
                <ActionIconButton
                  label="Ниже"
                  ariaLabel={`Ниже: ${artist.name}`}
                  path={ARROW_DOWN_ICON_PATH}
                  disabled={index === selected.length - 1}
                  onClick={() => {
                    moveArtist(index, 1);
                  }}
                />
                <ActionIconButton
                  label="Убрать"
                  ariaLabel={`Убрать: ${artist.name}`}
                  path={DELETE_ICON_PATH}
                  onClick={() => {
                    removeArtist(artist.id);
                  }}
                />
              </Box>
            );
          });
        }}
        renderInput={(params) => (
          <TextField {...params} label="Исполнители" autoComplete="off" />
        )}
      />
      <ErrorMessages messages={messages} />
    </Box>
  );
};
