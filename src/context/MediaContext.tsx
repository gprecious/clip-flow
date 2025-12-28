import {
  createContext,
  useContext,
  useReducer,
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
} from 'react';
import {
  scanMediaDirectoryTree,
  startWatchingDirectory,
  stopWatchingDirectory,
  onFileChange,
  type DirectoryNode,
  type FileChangeEvent,
} from '@/lib/tauri';

// Types
export interface TranscriptionSegment {
  start: number;
  end: number;
  text: string;
}

export interface MediaFile {
  id: string;
  name: string;
  path: string;
  size: number;
  extension: string | null;
  modified: number | null;
  status: 'pending' | 'extracting' | 'transcribing' | 'completed' | 'error';
  progress: number;
  error?: string;
  transcription?: {
    segments: TranscriptionSegment[];
    fullText: string;
    language?: string;
    duration?: number;
  };
}

export interface MediaFolder {
  id: string;
  name: string;
  path: string;
  files: MediaFile[];
  subfolders: MediaFolder[];
  isExpanded: boolean;
}

interface MediaState {
  rootPath: string | null;
  rootFolder: MediaFolder | null;
  selectedFileId: string | null;
  isLoading: boolean;
  error: string | null;
  // Map of file path to transcription status (persisted separately from tree)
  fileStatuses: Record<string, Pick<MediaFile, 'status' | 'progress' | 'error' | 'transcription'>>;
}

type MediaAction =
  | { type: 'SET_ROOT_PATH'; payload: string | null }
  | { type: 'SET_ROOT_FOLDER'; payload: MediaFolder | null }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SELECT_FILE'; payload: string | null }
  | { type: 'TOGGLE_FOLDER'; payload: string }
  | { type: 'UPDATE_FILE_STATUS'; payload: { filePath: string; status: MediaFile['status']; progress?: number; error?: string } }
  | { type: 'SET_TRANSCRIPTION'; payload: { filePath: string; transcription: MediaFile['transcription'] } }
  | { type: 'ADD_FILE'; payload: { path: string; name: string; size: number; extension: string | null; modified: number | null } }
  | { type: 'REMOVE_FILE'; payload: string }
  | { type: 'RESET_ALL_TRANSCRIPTIONS' };

const initialState: MediaState = {
  rootPath: null,
  rootFolder: null,
  selectedFileId: null,
  isLoading: false,
  error: null,
  fileStatuses: {},
};

function mediaReducer(state: MediaState, action: MediaAction): MediaState {
  switch (action.type) {
    case 'SET_ROOT_PATH':
      return { ...state, rootPath: action.payload };

    case 'SET_ROOT_FOLDER':
      return { ...state, rootFolder: action.payload };

    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };

    case 'SET_ERROR':
      return { ...state, error: action.payload };

    case 'SELECT_FILE':
      return { ...state, selectedFileId: action.payload };

    case 'TOGGLE_FOLDER':
      if (!state.rootFolder) return state;
      return {
        ...state,
        rootFolder: toggleFolderRecursive(state.rootFolder, action.payload),
      };

    case 'UPDATE_FILE_STATUS':
      return {
        ...state,
        fileStatuses: {
          ...state.fileStatuses,
          [action.payload.filePath]: {
            ...state.fileStatuses[action.payload.filePath],
            status: action.payload.status,
            progress: action.payload.progress ?? state.fileStatuses[action.payload.filePath]?.progress ?? 0,
            error: action.payload.error,
          },
        },
      };

    case 'SET_TRANSCRIPTION':
      return {
        ...state,
        fileStatuses: {
          ...state.fileStatuses,
          [action.payload.filePath]: {
            ...state.fileStatuses[action.payload.filePath],
            status: 'completed',
            progress: 100,
            transcription: action.payload.transcription,
          },
        },
      };

    case 'RESET_ALL_TRANSCRIPTIONS': {
      // Reset all files with 'completed' or 'error' status back to 'pending'
      const resetStatuses: Record<string, Pick<MediaFile, 'status' | 'progress' | 'error' | 'transcription'>> = {};
      for (const [filePath, status] of Object.entries(state.fileStatuses)) {
        if (status.status === 'completed' || status.status === 'error') {
          resetStatuses[filePath] = {
            status: 'pending',
            progress: 0,
            error: undefined,
            transcription: undefined,
          };
        } else {
          resetStatuses[filePath] = status;
        }
      }
      return {
        ...state,
        fileStatuses: resetStatuses,
      };
    }

    default:
      return state;
  }
}

function toggleFolderRecursive(folder: MediaFolder, targetId: string): MediaFolder {
  if (folder.id === targetId) {
    return { ...folder, isExpanded: !folder.isExpanded };
  }
  return {
    ...folder,
    subfolders: folder.subfolders.map((sub) => toggleFolderRecursive(sub, targetId)),
  };
}

// Convert DirectoryNode to MediaFolder
function directoryNodeToFolder(node: DirectoryNode, fileStatuses: Record<string, Pick<MediaFile, 'status' | 'progress' | 'error' | 'transcription'>>): MediaFolder {
  const files: MediaFile[] = [];
  const subfolders: MediaFolder[] = [];

  for (const child of node.children) {
    if (child.is_dir) {
      subfolders.push(directoryNodeToFolder(child, fileStatuses));
    } else {
      const status = fileStatuses[child.path] || { status: 'pending', progress: 0 };
      files.push({
        id: child.path,
        name: child.name,
        path: child.path,
        size: child.size,
        extension: child.extension,
        modified: child.modified,
        status: status.status,
        progress: status.progress,
        error: status.error,
        transcription: status.transcription,
      });
    }
  }

  return {
    id: node.path,
    name: node.name,
    path: node.path,
    files,
    subfolders,
    isExpanded: true,
  };
}

// Find file by path recursively
function findFileByPath(folder: MediaFolder, path: string): MediaFile | null {
  const file = folder.files.find((f) => f.path === path);
  if (file) return file;

  for (const subfolder of folder.subfolders) {
    const found = findFileByPath(subfolder, path);
    if (found) return found;
  }
  return null;
}

// Get all files recursively
function getAllFilesFromFolder(folder: MediaFolder): MediaFile[] {
  const files = [...folder.files];
  for (const subfolder of folder.subfolders) {
    files.push(...getAllFilesFromFolder(subfolder));
  }
  return files;
}

// Merge file with latest status from fileStatuses
function mergeFileWithStatus(
  file: MediaFile,
  fileStatuses: Record<string, Pick<MediaFile, 'status' | 'progress' | 'error' | 'transcription'>>
): MediaFile {
  const status = fileStatuses[file.path];
  if (!status) return file;
  return {
    ...file,
    status: status.status,
    progress: status.progress,
    error: status.error,
    transcription: status.transcription,
  };
}

interface MediaContextValue {
  state: MediaState;
  setRootDirectory: (path: string) => Promise<void>;
  clearRootDirectory: () => Promise<void>;
  refreshDirectory: () => Promise<void>;
  selectFile: (filePath: string | null) => void;
  toggleFolder: (folderId: string) => void;
  updateFileStatus: (filePath: string, status: MediaFile['status'], progress?: number, error?: string) => void;
  setTranscription: (filePath: string, transcription: MediaFile['transcription']) => void;
  resetAllTranscriptions: () => void;
  getSelectedFile: () => MediaFile | null;
  getAllFiles: () => MediaFile[];
}

const MediaContext = createContext<MediaContextValue | undefined>(undefined);

interface MediaProviderProps {
  children: ReactNode;
}

export function MediaProvider({ children }: MediaProviderProps) {
  const [state, dispatch] = useReducer(mediaReducer, initialState);
  const refreshRef = useRef<(() => Promise<void>) | undefined>(undefined);

  const refreshDirectory = useCallback(async () => {
    if (!state.rootPath) return;

    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      const tree = await scanMediaDirectoryTree(state.rootPath);
      const folder = directoryNodeToFolder(tree, state.fileStatuses);
      dispatch({ type: 'SET_ROOT_FOLDER', payload: folder });
      dispatch({ type: 'SET_ERROR', payload: null });
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: error instanceof Error ? error.message : 'Failed to scan directory' });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, [state.rootPath, state.fileStatuses]);

  // Keep ref updated with latest refreshDirectory
  useEffect(() => {
    refreshRef.current = refreshDirectory;
  }, [refreshDirectory]);

  // Set up file change listener
  useEffect(() => {
    if (!state.rootPath) return;

    let unsubscribe: (() => void) | undefined;

    const setupListener = async () => {
      try {
        unsubscribe = await onFileChange((event: FileChangeEvent) => {
          console.log('File change detected:', event);
          // Refresh directory on file changes
          refreshRef.current?.();
        });
      } catch (error) {
        console.error('Failed to set up file change listener:', error);
      }
    };

    setupListener();

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [state.rootPath]);

  const setRootDirectory = useCallback(async (path: string) => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      dispatch({ type: 'SET_ROOT_PATH', payload: path });

      // Scan directory
      const tree = await scanMediaDirectoryTree(path);
      const folder = directoryNodeToFolder(tree, state.fileStatuses);
      dispatch({ type: 'SET_ROOT_FOLDER', payload: folder });

      // Start watching for changes
      await startWatchingDirectory(path);

      dispatch({ type: 'SET_ERROR', payload: null });
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: error instanceof Error ? error.message : 'Failed to set directory' });
      dispatch({ type: 'SET_ROOT_PATH', payload: null });
      dispatch({ type: 'SET_ROOT_FOLDER', payload: null });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, [state.fileStatuses]);

  const clearRootDirectory = useCallback(async () => {
    try {
      await stopWatchingDirectory();
    } catch (error) {
      console.error('Failed to stop watching:', error);
    }
    dispatch({ type: 'SET_ROOT_PATH', payload: null });
    dispatch({ type: 'SET_ROOT_FOLDER', payload: null });
    dispatch({ type: 'SELECT_FILE', payload: null });
  }, []);

  const selectFile = useCallback((filePath: string | null) => {
    dispatch({ type: 'SELECT_FILE', payload: filePath });
  }, []);

  const toggleFolder = useCallback((folderId: string) => {
    dispatch({ type: 'TOGGLE_FOLDER', payload: folderId });
  }, []);

  const updateFileStatus = useCallback(
    (filePath: string, status: MediaFile['status'], progress?: number, error?: string) => {
      dispatch({ type: 'UPDATE_FILE_STATUS', payload: { filePath, status, progress, error } });
    },
    []
  );

  const setTranscription = useCallback(
    (filePath: string, transcription: MediaFile['transcription']) => {
      dispatch({ type: 'SET_TRANSCRIPTION', payload: { filePath, transcription } });
    },
    []
  );

  const resetAllTranscriptions = useCallback(() => {
    console.log('[MediaContext] Resetting all transcriptions');
    console.log('[MediaContext] Current file statuses:', Object.keys(state.fileStatuses).length, 'files');
    Object.entries(state.fileStatuses).forEach(([path, status]) => {
      console.log(`[MediaContext] File: ${path}, Status: ${status.status}`);
    });
    dispatch({ type: 'RESET_ALL_TRANSCRIPTIONS' });
  }, [state.fileStatuses]);

  const getSelectedFile = useCallback((): MediaFile | null => {
    if (!state.selectedFileId || !state.rootFolder) return null;
    const file = findFileByPath(state.rootFolder, state.selectedFileId);
    if (!file) return null;
    return mergeFileWithStatus(file, state.fileStatuses);
  }, [state.selectedFileId, state.rootFolder, state.fileStatuses]);

  const getAllFiles = useCallback((): MediaFile[] => {
    if (!state.rootFolder) return [];
    const files = getAllFilesFromFolder(state.rootFolder);
    return files.map((file) => mergeFileWithStatus(file, state.fileStatuses));
  }, [state.rootFolder, state.fileStatuses]);

  return (
    <MediaContext.Provider
      value={{
        state,
        setRootDirectory,
        clearRootDirectory,
        refreshDirectory,
        selectFile,
        toggleFolder,
        updateFileStatus,
        setTranscription,
        resetAllTranscriptions,
        getSelectedFile,
        getAllFiles,
      }}
    >
      {children}
    </MediaContext.Provider>
  );
}

export function useMedia() {
  const context = useContext(MediaContext);
  if (context === undefined) {
    throw new Error('useMedia must be used within a MediaProvider');
  }
  return context;
}
