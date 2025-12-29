import { useTranslation } from 'react-i18next';
import { useMedia, type MediaFile, type MediaFolder } from '@/context/MediaContext';
import { cn } from '@/lib/utils/cn';
import { Spinner } from '@/components/ui';

type FileStatusMap = Record<string, Pick<MediaFile, 'status' | 'progress' | 'error' | 'transcription' | 'summary' | 'summaryStatus' | 'summaryError'>>;

interface FileTreeProps {
  className?: string;
}

export function FileTree({ className }: FileTreeProps) {
  const { t } = useTranslation();
  const { state, selectFile, toggleFolder } = useMedia();

  if (!state.rootFolder) {
    return (
      <div className={cn('flex flex-col h-full', className)}>
        <div className="flex-1 flex items-center justify-center p-4">
          <p className="text-sm text-neutral-500 dark:text-neutral-400 text-center">
            {t('fileTree.noFolder', 'No folder selected')}
          </p>
        </div>
      </div>
    );
  }

  const totalFiles = countFiles(state.rootFolder);

  return (
    <div className={cn('flex flex-col h-full', className)}>
      <div className="px-3 py-2 border-b border-neutral-200 dark:border-neutral-700">
        <h3 className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
          {t('fileTree.title', 'Files')} ({totalFiles})
        </h3>
      </div>
      <div className="flex-1 overflow-y-auto py-2">
        {/* Render files at root level */}
        {state.rootFolder.files.map((file) => (
          <FileItem
            key={file.id}
            file={file}
            fileStatuses={state.fileStatuses}
            isSelected={file.path === state.selectedFileId}
            onSelect={() => selectFile(file.path)}
            depth={0}
          />
        ))}
        {/* Render subfolders */}
        {state.rootFolder.subfolders.map((folder) => (
          <FolderItem
            key={folder.id}
            folder={folder}
            selectedFileId={state.selectedFileId}
            fileStatuses={state.fileStatuses}
            toggleFolder={toggleFolder}
            onSelectFile={selectFile}
            depth={0}
          />
        ))}
        {totalFiles === 0 && (
          <p className="px-3 py-4 text-sm text-neutral-500 dark:text-neutral-400 text-center">
            {t('fileTree.empty', 'No media files found in this folder.')}
          </p>
        )}
      </div>
    </div>
  );
}

function countFiles(folder: MediaFolder): number {
  let count = folder.files.length;
  for (const subfolder of folder.subfolders) {
    count += countFiles(subfolder);
  }
  return count;
}

interface FolderItemProps {
  folder: MediaFolder;
  selectedFileId: string | null;
  fileStatuses: FileStatusMap;
  toggleFolder: (folderId: string) => void;
  onSelectFile: (filePath: string) => void;
  depth: number;
}

function FolderItem({
  folder,
  selectedFileId,
  fileStatuses,
  toggleFolder,
  onSelectFile,
  depth,
}: FolderItemProps) {
  const fileCount = countFiles(folder);

  return (
    <div>
      <button
        onClick={() => toggleFolder(folder.id)}
        className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
        style={{ paddingLeft: `${12 + depth * 16}px` }}
      >
        <svg
          className={cn(
            'w-4 h-4 text-neutral-500 transition-transform flex-shrink-0',
            folder.isExpanded && 'rotate-90'
          )}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        <svg
          className="w-4 h-4 text-yellow-500 flex-shrink-0"
          fill="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path d="M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z" />
        </svg>
        <span className="flex-1 text-left truncate">{folder.name}</span>
        <span className="text-xs text-neutral-400">{fileCount}</span>
      </button>
      {folder.isExpanded && (
        <div>
          {/* Render files in this folder */}
          {folder.files.map((file) => (
            <FileItem
              key={file.id}
              file={file}
              fileStatuses={fileStatuses}
              isSelected={file.path === selectedFileId}
              onSelect={() => onSelectFile(file.path)}
              depth={depth + 1}
            />
          ))}
          {/* Render nested subfolders */}
          {folder.subfolders.map((subfolder) => (
            <FolderItem
              key={subfolder.id}
              folder={subfolder}
              selectedFileId={selectedFileId}
              fileStatuses={fileStatuses}
              toggleFolder={toggleFolder}
              onSelectFile={onSelectFile}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface FileItemProps {
  file: MediaFile;
  fileStatuses: FileStatusMap;
  isSelected: boolean;
  onSelect: () => void;
  depth: number;
}

function FileItem({ file, fileStatuses, isSelected, onSelect, depth }: FileItemProps) {
  const videoExtensions = ['mp4', 'mkv', 'avi', 'mov', 'webm', 'flv', 'wmv'];
  const audioExtensions = ['mp3', 'wav', 'm4a', 'flac', 'aac', 'ogg', 'wma'];

  const ext = file.extension?.toLowerCase() || '';
  const isVideo = videoExtensions.includes(ext);
  const isAudio = audioExtensions.includes(ext);

  // Get real-time status from fileStatuses (updated on every action)
  const currentStatus = fileStatuses[file.path]?.status ?? file.status;

  const getStatusColor = () => {
    switch (currentStatus) {
      case 'completed':
        return 'bg-green-500';
      case 'error':
        return 'bg-red-500';
      case 'extracting':
      case 'transcribing':
        return 'bg-primary-500';
      default:
        return 'bg-neutral-400';
    }
  };

  return (
    <button
      type="button"
      className={cn(
        'w-full group flex items-center gap-2 px-3 py-1.5 cursor-pointer transition-colors text-left',
        isSelected
          ? 'bg-primary-50 dark:bg-primary-950 text-primary-600 dark:text-primary-400'
          : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800'
      )}
      style={{ paddingLeft: `${12 + (depth + 1) * 16}px` }}
      onClick={onSelect}
    >
      {/* File icon */}
      {isVideo ? (
        <svg className="w-4 h-4 text-blue-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
      ) : isAudio ? (
        <svg className="w-4 h-4 text-purple-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
        </svg>
      ) : (
        <svg className="w-4 h-4 text-neutral-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
        </svg>
      )}

      {/* File name */}
      <span className="flex-1 text-sm truncate">{file.name}</span>

      {/* Status indicator */}
      {currentStatus === 'extracting' || currentStatus === 'transcribing' ? (
        <Spinner size="sm" />
      ) : (
        <div className={cn('w-2 h-2 rounded-full flex-shrink-0', getStatusColor())} />
      )}
    </button>
  );
}

export default FileTree;
