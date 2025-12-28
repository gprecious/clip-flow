import type { MediaFile, MediaFolder, TranscriptionSegment } from '@/context/MediaContext';
import type { DirectoryNode } from '@/lib/tauri';

/**
 * Mock transcription segments
 */
export const mockSegments: TranscriptionSegment[] = [
  { start: 0, end: 5.5, text: 'Hello world, this is a test.' },
  { start: 5.5, end: 10.2, text: 'This is the second segment.' },
  { start: 10.2, end: 15.0, text: 'And this is the final segment.' },
];

/**
 * Mock media file in pending state
 */
export const mockPendingFile: MediaFile = {
  id: '/test/path/video.mp4',
  name: 'video.mp4',
  path: '/test/path/video.mp4',
  size: 1024 * 1024 * 100, // 100MB
  extension: 'mp4',
  modified: Date.now(),
  status: 'pending',
  progress: 0,
};

/**
 * Mock media file in extracting state
 */
export const mockExtractingFile: MediaFile = {
  ...mockPendingFile,
  id: '/test/path/extracting.mp4',
  name: 'extracting.mp4',
  path: '/test/path/extracting.mp4',
  status: 'extracting',
  progress: 30,
};

/**
 * Mock media file in transcribing state
 */
export const mockTranscribingFile: MediaFile = {
  ...mockPendingFile,
  id: '/test/path/transcribing.mp4',
  name: 'transcribing.mp4',
  path: '/test/path/transcribing.mp4',
  status: 'transcribing',
  progress: 60,
};

/**
 * Mock media file in completed state
 */
export const mockCompletedFile: MediaFile = {
  ...mockPendingFile,
  id: '/test/path/completed.mp4',
  name: 'completed.mp4',
  path: '/test/path/completed.mp4',
  status: 'completed',
  progress: 100,
  transcription: {
    segments: mockSegments,
    fullText: mockSegments.map((s) => s.text).join(' '),
    language: 'en',
    duration: 15,
  },
};

/**
 * Mock media file in error state
 */
export const mockErrorFile: MediaFile = {
  ...mockPendingFile,
  id: '/test/path/error.mp4',
  name: 'error.mp4',
  path: '/test/path/error.mp4',
  status: 'error',
  progress: 0,
  error: 'Transcription failed: Model not found',
};

/**
 * Mock audio file
 */
export const mockAudioFile: MediaFile = {
  id: '/test/path/audio.mp3',
  name: 'audio.mp3',
  path: '/test/path/audio.mp3',
  size: 1024 * 1024 * 10, // 10MB
  extension: 'mp3',
  modified: Date.now(),
  status: 'pending',
  progress: 0,
};

/**
 * Mock empty folder
 */
export const mockEmptyFolder: MediaFolder = {
  id: '/test/empty',
  name: 'empty',
  path: '/test/empty',
  files: [],
  subfolders: [],
  isExpanded: true,
};

/**
 * Mock folder with files
 */
export const mockFolderWithFiles: MediaFolder = {
  id: '/test/path',
  name: 'path',
  path: '/test/path',
  files: [mockPendingFile, mockCompletedFile],
  subfolders: [],
  isExpanded: true,
};

/**
 * Mock nested folder structure
 */
export const mockNestedFolder: MediaFolder = {
  id: '/test/root',
  name: 'root',
  path: '/test/root',
  files: [mockPendingFile],
  subfolders: [
    {
      id: '/test/root/subfolder1',
      name: 'subfolder1',
      path: '/test/root/subfolder1',
      files: [mockCompletedFile],
      subfolders: [],
      isExpanded: false,
    },
    {
      id: '/test/root/subfolder2',
      name: 'subfolder2',
      path: '/test/root/subfolder2',
      files: [mockAudioFile],
      subfolders: [],
      isExpanded: true,
    },
  ],
  isExpanded: true,
};

/**
 * Mock DirectoryNode from Tauri (raw scan result)
 */
export const mockDirectoryNode: DirectoryNode = {
  path: '/test/path',
  name: 'path',
  is_dir: true,
  size: 0,
  modified: Date.now(),
  extension: null,
  children: [
    {
      path: '/test/path/video.mp4',
      name: 'video.mp4',
      is_dir: false,
      size: 1024 * 1024 * 100,
      modified: Date.now(),
      extension: 'mp4',
      children: [],
    },
    {
      path: '/test/path/audio.mp3',
      name: 'audio.mp3',
      is_dir: false,
      size: 1024 * 1024 * 10,
      modified: Date.now(),
      extension: 'mp3',
      children: [],
    },
  ],
};

/**
 * Mock nested DirectoryNode
 */
export const mockNestedDirectoryNode: DirectoryNode = {
  path: '/test/root',
  name: 'root',
  is_dir: true,
  size: 0,
  modified: Date.now(),
  extension: null,
  children: [
    {
      path: '/test/root/video.mp4',
      name: 'video.mp4',
      is_dir: false,
      size: 1024 * 1024 * 100,
      modified: Date.now(),
      extension: 'mp4',
      children: [],
    },
    {
      path: '/test/root/subfolder',
      name: 'subfolder',
      is_dir: true,
      size: 0,
      modified: Date.now(),
      extension: null,
      children: [
        {
          path: '/test/root/subfolder/audio.mp3',
          name: 'audio.mp3',
          is_dir: false,
          size: 1024 * 1024 * 10,
          modified: Date.now(),
          extension: 'mp3',
          children: [],
        },
      ],
    },
  ],
};

/**
 * Create a mock media file with custom properties
 */
export function createMockMediaFile(overrides: Partial<MediaFile> = {}): MediaFile {
  return {
    ...mockPendingFile,
    id: `/test/path/${overrides.name ?? 'file.mp4'}`,
    path: `/test/path/${overrides.name ?? 'file.mp4'}`,
    ...overrides,
  };
}

/**
 * Create a mock folder with custom files
 */
export function createMockFolder(
  name: string,
  files: MediaFile[] = [],
  subfolders: MediaFolder[] = []
): MediaFolder {
  return {
    id: `/test/${name}`,
    name,
    path: `/test/${name}`,
    files,
    subfolders,
    isExpanded: true,
  };
}
