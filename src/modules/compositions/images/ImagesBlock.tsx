import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Typography,
} from '@mui/material';
import {
  useRef,
  useState,
  type ChangeEvent,
  type PointerEventHandler,
  type KeyboardEventHandler,
} from 'react';
import { messagesFromError } from '../../../shared/api/api-error.ts';
import { MAX_IMAGE_FILES, type CompositionImage } from './images-store.ts';
import { useAttemptThrottle } from '../../../shared/hooks/use-attempt-throttle.ts';
import { useRootStore } from '../../../shared/store/root-store-context.tsx';
import { ErrorMessages } from '../../../shared/ui/ErrorMessages.tsx';
import { imagesInOrder, nextImageIds } from './image-order.ts';
import { visuallyHiddenInputSx } from '../../../shared/ui/visually-hidden-input.ts';

const HINT =
  'Можно загрузить jpg, png или webp. Ориентир размера — 10 МБ на файл. Тип и размер проверяет сервер.';

const URL_REFRESH_INTERVAL_MS = 60_000;
const TOO_MANY = 'За один раз можно загрузить не больше 10 файлов';

export function ImagesBlock({
  compositionId,
  initialImages,
}: {
  compositionId: string;
  initialImages: CompositionImage[];
}) {
  const { images: imagesStore } = useRootStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mayRefreshUrl = useAttemptThrottle(URL_REFRESH_INTERVAL_MS);
  const [images, setImages] = useState(initialImages);
  const [files, setFiles] = useState<File[]>([]);
  const [messages, setMessages] = useState<readonly string[]>([]);
  const [busy, setBusy] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<CompositionImage | null>(
    null,
  );
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );
  const tooMany = files.length > MAX_IMAGE_FILES;

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const list = event.target.files;
    const next = list === null ? [] : Array.from(list);
    setFiles(next);
    setMessages(next.length > MAX_IMAGE_FILES ? [TOO_MANY] : []);
  }

  async function upload() {
    if (files.length === 0 || files.length > MAX_IMAGE_FILES) {
      return;
    }

    setBusy(true);
    setMessages([]);
    try {
      await imagesStore.uploadImages(compositionId, files);
      setFiles([]);
      if (fileInputRef.current !== null) {
        fileInputRef.current.value = '';
      }
      const listed = await imagesStore.listImages(compositionId);
      setImages(listed);
    } catch (error) {
      setMessages(messagesFromError(error));
    } finally {
      setBusy(false);
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    const overId = event.over === null ? null : String(event.over.id);
    const next = nextImageIds(
      images.map((image) => image.id),
      String(event.active.id),
      overId,
    );
    if (next === null || next.length !== images.length || next.length === 0) {
      return;
    }
    void persistOrder(next);
  }

  async function persistOrder(nextIds: readonly string[]) {
    const previous = images;
    setImages(imagesInOrder(previous, nextIds));
    setMessages([]);
    setBusy(true);
    try {
      const updated = await imagesStore.reorderImages(compositionId, nextIds);
      setImages(updated);
    } catch (error) {
      setImages(previous);
      setMessages(messagesFromError(error));
    } finally {
      setBusy(false);
    }
  }

  async function confirmDelete() {
    if (deleteTarget === null) {
      return;
    }
    const imageId = deleteTarget.id;
    setBusy(true);
    setMessages([]);
    let removed = false;
    try {
      await imagesStore.removeImage(compositionId, imageId);
      removed = true;
      setDeleteTarget(null);
    } catch (error) {
      setMessages(messagesFromError(error));
      setBusy(false);
      return;
    }

    try {
      const listed = await imagesStore.listImages(compositionId);
      setImages(listed);
    } catch (error) {
      if (removed) {
        setImages((current) => current.filter((image) => image.id !== imageId));
      }
      setMessages(messagesFromError(error));
    } finally {
      setBusy(false);
    }
  }

  function handlePreviewError(imageId: string) {
    if (!mayRefreshUrl(imageId)) {
      return;
    }
    void imagesStore
      .listImages(compositionId)
      .then((listed) => {
        setImages(listed);
      })
      .catch((error: unknown) => {
        setMessages(messagesFromError(error));
      });
  }

  return (
    <Box
      data-testid="images-block"
      sx={{ display: 'flex', flexDirection: 'column', gap: 1, maxWidth: 720 }}
    >
      <Typography variant="h6" component="h2">
        Изображения
      </Typography>
      <Typography variant="body2">{HINT}</Typography>
      <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
        <Button
          component="label"
          variant="outlined"
          disabled={busy}
          sx={{ position: 'relative' }}
        >
          Выбрать файлы
          <Box
            component="input"
            ref={fileInputRef}
            type="file"
            multiple
            accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
            aria-label="Файлы изображений"
            onChange={handleFileChange}
            sx={visuallyHiddenInputSx}
          />
        </Button>
        <Button
          variant="contained"
          disabled={files.length === 0 || tooMany || busy}
          onClick={() => {
            void upload();
          }}
        >
          Загрузить изображения
        </Button>
        {files.length > 0 ? (
          <Typography variant="body2">
            {files.length === 1
              ? files[0]?.name
              : `Выбрано файлов: ${String(files.length)}`}
          </Typography>
        ) : null}
      </Box>
      {images.length === 0 ? (
        <Typography>Изображений нет</Typography>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={images.map((image) => image.id)}
            strategy={verticalListSortingStrategy}
          >
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {images.map((image, index) => (
                <SortableImage
                  key={image.id}
                  image={image}
                  index={index}
                  disabled={busy}
                  onDelete={() => {
                    setDeleteTarget(image);
                  }}
                  onPreviewError={() => {
                    handlePreviewError(image.id);
                  }}
                />
              ))}
            </Box>
          </SortableContext>
        </DndContext>
      )}
      <ErrorMessages messages={messages} />
      <Dialog
        open={deleteTarget !== null}
        onClose={() => {
          if (!busy) {
            setDeleteTarget(null);
          }
        }}
      >
        <DialogTitle>Удалить изображение?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Изображение исчезнет безвозвратно. Восстановить его нельзя.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setDeleteTarget(null);
            }}
            disabled={busy}
          >
            Отмена
          </Button>
          <Button
            variant="contained"
            color="warning"
            disabled={busy}
            onClick={() => {
              void confirmDelete();
            }}
          >
            Удалить
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

function SortableImage({
  image,
  index,
  disabled,
  onDelete,
  onPreviewError,
}: {
  image: CompositionImage;
  index: number;
  disabled: boolean;
  onDelete: () => void;
  onPreviewError: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
  } = useSortable({ id: image.id, disabled });

  return (
    <Box
      ref={setNodeRef}
      data-image-index={String(index)}
      data-image-id={image.id}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      sx={{ display: 'flex', gap: 2, alignItems: 'center' }}
    >
      <Box
        component="img"
        src={image.fileUrl}
        alt={`Изображение ${String(image.order + 1)}`}
        data-testid={`image-preview-${image.id}`}
        onError={onPreviewError}
        sx={{ width: 96, height: 96, objectFit: 'cover' }}
      />
      <Box
        component="button"
        type="button"
        ref={setActivatorNodeRef}
        {...attributes}
        onKeyDown={
          listeners?.onKeyDown as
            KeyboardEventHandler<HTMLButtonElement> | undefined
        }
        onPointerDown={
          listeners?.onPointerDown as
            PointerEventHandler<HTMLButtonElement> | undefined
        }
        aria-label={`Переместить изображение ${image.id}`}
        disabled={disabled}
      >
        Переместить
      </Box>
      <Button
        size="small"
        color="warning"
        disabled={disabled}
        aria-label={`Удалить изображение ${image.id}`}
        onClick={onDelete}
      >
        Удалить
      </Button>
    </Box>
  );
}
