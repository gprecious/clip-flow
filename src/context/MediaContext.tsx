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

// Storage keys
const MEDIA_ROOT_PATH_KEY = 'clip-flow-media-root-path';
const MEDIA_FILE_STATUSES_KEY = 'clip-flow-media-file-statuses';

// Type for stored file statuses
type FileStatusMap = Record<string, Pick<MediaFile, 'status' | 'progress' | 'error' | 'transcription' | 'summary' | 'summaryStatus' | 'summaryError'>>;

// Storage utility functions
function getStoredRootPath(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(MEDIA_ROOT_PATH_KEY);
  } catch (error) {
    console.error('[MediaContext] Failed to get stored root path:', error);
    return null;
  }
}

function getStoredFileStatuses(): FileStatusMap {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(MEDIA_FILE_STATUSES_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (error) {
    console.error('[MediaContext] Failed to parse stored file statuses:', error);
  }
  return {};
}

function saveRootPath(path: string | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (path) {
      localStorage.setItem(MEDIA_ROOT_PATH_KEY, path);
    } else {
      localStorage.removeItem(MEDIA_ROOT_PATH_KEY);
    }
  } catch (error) {
    console.error('[MediaContext] Failed to save root path:', error);
  }
}

function saveFileStatuses(statuses: FileStatusMap): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(MEDIA_FILE_STATUSES_KEY, JSON.stringify(statuses));
  } catch (error) {
    if (error instanceof DOMException && error.name === 'QuotaExceededError') {
      console.warn('[MediaContext] localStorage quota exceeded');
    }
    console.error('[MediaContext] Failed to save file statuses:', error);
  }
}

// Types
export interface TranscriptionSegment {
  start: number;
  end: number;
  text: string;
}

export interface TranscriptionMetadata {
  provider: 'local' | 'openai';
  model: string;
  transcribedAt: number;
}

export interface SummaryMetadata {
  provider: 'ollama' | 'openai' | 'claude';
  model: string;
  summarizedAt: number;
}

export interface Summary {
  text: string;
  language: string;
  metadata: SummaryMetadata;
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
    metadata?: TranscriptionMetadata;
  };
  summary?: Summary;
  summaryStatus?: 'pending' | 'summarizing' | 'completed' | 'error';
  summaryError?: string;
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
  // Map of file path to transcription/summary status (persisted separately from tree)
  fileStatuses: FileStatusMap;
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
  | { type: 'RESET_ALL_TRANSCRIPTIONS' }
  | { type: 'SET_FILE_STATUSES'; payload: FileStatusMap }
  | { type: 'SET_SUMMARY'; payload: { filePath: string; summary: Summary } }
  | { type: 'UPDATE_SUMMARY_STATUS'; payload: { filePath: string; status: MediaFile['summaryStatus']; error?: string } }
  | { type: 'CLEAR_SUMMARY'; payload: { filePath: string } }
  | { type: 'RESUMMARIZE'; payload: { filePath: string } };

// Load stored data on initialization
const storedRootPath = getStoredRootPath();
const storedFileStatuses = getStoredFileStatuses();

const initialState: MediaState = {
  rootPath: storedRootPath,
  rootFolder: null,
  selectedFileId: null,
  isLoading: storedRootPath !== null, // Show loading if we need to restore
  error: null,
  fileStatuses: storedFileStatuses,
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
      const resetStatuses: FileStatusMap = {};
      for (const [filePath, status] of Object.entries(state.fileStatuses)) {
        if (status.status === 'completed' || status.status === 'error') {
          resetStatuses[filePath] = {
            status: 'pending',
            progress: 0,
            error: undefined,
            transcription: undefined,
            summary: undefined,
            summaryStatus: undefined,
            summaryError: undefined,
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

    case 'SET_FILE_STATUSES':
      return {
        ...state,
        fileStatuses: action.payload,
      };

    case 'SET_SUMMARY':
      return {
        ...state,
        fileStatuses: {
          ...state.fileStatuses,
          [action.payload.filePath]: {
            ...state.fileStatuses[action.payload.filePath],
            summary: action.payload.summary,
            summaryStatus: 'completed',
            summaryError: undefined,
          },
        },
      };

    case 'UPDATE_SUMMARY_STATUS':
      return {
        ...state,
        fileStatuses: {
          ...state.fileStatuses,
          [action.payload.filePath]: {
            ...state.fileStatuses[action.payload.filePath],
            summaryStatus: action.payload.status,
            summaryError: action.payload.error,
          },
        },
      };

    case 'CLEAR_SUMMARY':
      return {
        ...state,
        fileStatuses: {
          ...state.fileStatuses,
          [action.payload.filePath]: {
            ...state.fileStatuses[action.payload.filePath],
            summary: undefined,
            summaryStatus: undefined,
            summaryError: undefined,
          },
        },
      };

    case 'RESUMMARIZE':
      return {
        ...state,
        fileStatuses: {
          ...state.fileStatuses,
          [action.payload.filePath]: {
            ...state.fileStatuses[action.payload.filePath],
            summary: undefined,
            summaryStatus: 'pending',
            summaryError: undefined,
          },
        },
      };

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
  fileStatuses: FileStatusMap
): MediaFile {
  const status = fileStatuses[file.path];
  if (!status) return file;
  return {
    ...file,
    status: status.status,
    progress: status.progress,
    error: status.error,
    transcription: status.transcription,
    summary: status.summary,
    summaryStatus: status.summaryStatus,
    summaryError: status.summaryError,
  };
}

// Extract all file paths from directory tree
function getAllPathsFromTree(node: DirectoryNode): Set<string> {
  const paths = new Set<string>();

  function traverse(n: DirectoryNode) {
    for (const child of n.children) {
      if (child.is_dir) {
        traverse(child);
      } else {
        paths.add(child.path);
      }
    }
  }

  traverse(node);
  return paths;
}

// Clean up statuses for deleted files
function cleanupDeletedFiles(
  fileStatuses: FileStatusMap,
  validPaths: Set<string>
): FileStatusMap {
  const cleaned: FileStatusMap = {};

  for (const [path, status] of Object.entries(fileStatuses)) {
    if (validPaths.has(path)) {
      cleaned[path] = status;
    } else {
      console.log('[MediaContext] Removing status for deleted file:', path);
    }
  }

  return cleaned;
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
  retranscribeFile: (filePath: string) => void;
  retranscribeAllFiles: () => void;
  getSelectedFile: () => MediaFile | null;
  getAllFiles: () => MediaFile[];
  // Summary methods
  setSummary: (filePath: string, summary: Summary) => void;
  updateSummaryStatus: (filePath: string, status: MediaFile['summaryStatus'], error?: string) => void;
  clearSummary: (filePath: string) => void;
  resummarizeFile: (filePath: string) => void;
}

const MediaContext = createContext<MediaContextValue | undefined>(undefined);

interface MediaProviderProps {
  children: ReactNode;
}

export function MediaProvider({ children }: MediaProviderProps) {
  const [state, dispatch] = useReducer(mediaReducer, initialState);
  const refreshRef = useRef<(() => Promise<void>) | undefined>(undefined);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initializedRef = useRef<boolean>(false);

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

  // Initialize from storage on mount
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    // Use initial values from storage (captured at module load time)
    const rootPath = storedRootPath;
    const fileStatuses = storedFileStatuses;

    async function initializeFromStorage() {
      if (!rootPath) {
        dispatch({ type: 'SET_LOADING', payload: false });
        return;
      }

      console.log('[MediaContext] Restoring from storage:', rootPath);

      try {
        // Scan the stored directory
        const tree = await scanMediaDirectoryTree(rootPath);

        // Get all valid file paths from scan
        const validPaths = getAllPathsFromTree(tree);

        // Clean up statuses for deleted files
        const cleanedStatuses = cleanupDeletedFiles(fileStatuses, validPaths);
        if (Object.keys(cleanedStatuses).length !== Object.keys(fileStatuses).length) {
          dispatch({ type: 'SET_FILE_STATUSES', payload: cleanedStatuses });
          saveFileStatuses(cleanedStatuses);
        }

        // Build folder tree with merged statuses
        const folder = directoryNodeToFolder(tree, cleanedStatuses);
        dispatch({ type: 'SET_ROOT_FOLDER', payload: folder });

        // Start watching directory
        await startWatchingDirectory(rootPath);

        dispatch({ type: 'SET_ERROR', payload: null });
      } catch (error) {
        console.error('[MediaContext] Failed to restore directory:', error);
        // Directory no longer exists - clear stored data
        dispatch({ type: 'SET_ROOT_PATH', payload: null });
        dispatch({ type: 'SET_ERROR', payload: 'Previously selected directory is no longer accessible' });
        saveRootPath(null);
        saveFileStatuses({});
      } finally {
        dispatch({ type: 'SET_LOADING', payload: false });
      }
    }

    initializeFromStorage();
  }, []);

  // Save rootPath immediately when it changes
  useEffect(() => {
    // Skip initial save (already in storage)
    if (!initializedRef.current) return;
    saveRootPath(state.rootPath);
  }, [state.rootPath]);

  // Save fileStatuses with debouncing
  useEffect(() => {
    // Skip initial save (already in storage)
    if (!initializedRef.current) return;

    // Clear any pending save
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Debounce the save (1 second delay)
    saveTimeoutRef.current = setTimeout(() => {
      saveFileStatuses(state.fileStatuses);
    }, 1000);

    // Cleanup on unmount
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [state.fileStatuses]);

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
    dispatch({ type: 'SET_FILE_STATUSES', payload: {} });

    // Clear storage
    saveRootPath(null);
    saveFileStatuses({});
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
    dispatch({ type: 'RESET_ALL_TRANSCRIPTIONS' });
  }, []);

  const retranscribeFile = useCallback((filePath: string) => {
    dispatch({
      type: 'UPDATE_FILE_STATUS',
      payload: {
        filePath,
        status: 'pending',
        progress: 0,
        error: undefined,
      },
    });
    // Also clear summary when retranscribing
    dispatch({ type: 'CLEAR_SUMMARY', payload: { filePath } });
  }, []);

  const retranscribeAllFiles = useCallback(() => {
    if (!state.rootFolder) return;
    const files = getAllFilesFromFolder(state.rootFolder);
    for (const file of files) {
      dispatch({
        type: 'UPDATE_FILE_STATUS',
        payload: {
          filePath: file.path,
          status: 'pending',
          progress: 0,
          error: undefined,
        },
      });
      // Also clear summary when retranscribing
      dispatch({ type: 'CLEAR_SUMMARY', payload: { filePath: file.path } });
    }
  }, [state.rootFolder]);

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

  // Summary methods
  const setSummary = useCallback(
    (filePath: string, summary: Summary) => {
      dispatch({ type: 'SET_SUMMARY', payload: { filePath, summary } });
    },
    []
  );

  const updateSummaryStatus = useCallback(
    (filePath: string, status: MediaFile['summaryStatus'], error?: string) => {
      dispatch({ type: 'UPDATE_SUMMARY_STATUS', payload: { filePath, status, error } });
    },
    []
  );

  const clearSummary = useCallback((filePath: string) => {
    dispatch({ type: 'CLEAR_SUMMARY', payload: { filePath } });
  }, []);

  const resummarizeFile = useCallback((filePath: string) => {
    // Single atomic action to clear summary and set status to pending
    dispatch({ type: 'RESUMMARIZE', payload: { filePath } });
  }, []);

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
        retranscribeFile,
        retranscribeAllFiles,
        getSelectedFile,
        getAllFiles,
        setSummary,
        updateSummaryStatus,
        clearSummary,
        resummarizeFile,
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
