import { useCallback, useState, type DragEvent, type ChangeEvent } from 'react';
import { cn } from '@/lib/utils/cn';

export interface FileDropzoneProps {
  accept?: string;
  multiple?: boolean;
  maxSize?: number;
  onDrop: (files: File[]) => void;
  onError?: (error: string) => void;
  disabled?: boolean;
  className?: string;
  title?: string;
  subtitle?: string;
}

export function FileDropzone({
  accept,
  multiple = false,
  maxSize,
  onDrop,
  onError,
  disabled = false,
  className,
  title = 'Drop files here',
  subtitle = 'or click to browse',
}: FileDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);

  const validateFiles = useCallback(
    (files: File[]): File[] => {
      const validFiles: File[] = [];

      for (const file of files) {
        if (maxSize && file.size > maxSize) {
          onError?.(`File "${file.name}" exceeds maximum size of ${formatBytes(maxSize)}`);
          continue;
        }

        if (accept) {
          const acceptedTypes = accept.split(',').map((t) => t.trim());
          const fileType = file.type;
          const fileExtension = `.${file.name.split('.').pop()?.toLowerCase()}`;

          const isAccepted = acceptedTypes.some(
            (type) =>
              type === fileType ||
              type === fileExtension ||
              (type.endsWith('/*') && fileType.startsWith(type.replace('/*', '/')))
          );

          if (!isAccepted) {
            onError?.(`File "${file.name}" is not an accepted file type`);
            continue;
          }
        }

        validFiles.push(file);
      }

      return validFiles;
    },
    [accept, maxSize, onError]
  );

  const handleDragEnter = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      if (disabled) return;

      const files = Array.from(e.dataTransfer.files);
      const filesToProcess = multiple ? files : files.slice(0, 1);
      const validFiles = validateFiles(filesToProcess);

      if (validFiles.length > 0) {
        onDrop(validFiles);
      }
    },
    [disabled, multiple, onDrop, validateFiles]
  );

  const handleFileInput = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      if (disabled || !e.target.files) return;

      const files = Array.from(e.target.files);
      const validFiles = validateFiles(files);

      if (validFiles.length > 0) {
        onDrop(validFiles);
      }

      e.target.value = '';
    },
    [disabled, onDrop, validateFiles]
  );

  return (
    <div
      className={cn(
        'relative border-2 border-dashed rounded-xl transition-colors duration-200',
        'flex flex-col items-center justify-center p-8 text-center',
        isDragging
          ? 'border-primary-500 bg-primary-50 dark:bg-primary-950/20'
          : 'border-neutral-300 dark:border-neutral-600 hover:border-neutral-400 dark:hover:border-neutral-500',
        disabled && 'opacity-50 cursor-not-allowed',
        !disabled && 'cursor-pointer',
        className
      )}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <input
        type="file"
        accept={accept}
        multiple={multiple}
        onChange={handleFileInput}
        disabled={disabled}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
      />

      <div className="mb-4">
        <svg
          className={cn(
            'w-12 h-12',
            isDragging ? 'text-primary-500' : 'text-neutral-400 dark:text-neutral-500'
          )}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
          />
        </svg>
      </div>

      <p
        className={cn(
          'text-base font-medium',
          isDragging
            ? 'text-primary-600 dark:text-primary-400'
            : 'text-neutral-700 dark:text-neutral-300'
        )}
      >
        {title}
      </p>
      <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">{subtitle}</p>

      {accept && (
        <p className="mt-3 text-xs text-neutral-400 dark:text-neutral-500">
          Supported: {accept.split(',').join(', ')}
        </p>
      )}
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
