import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, Button, Progress, Input, Tabs, type TabItem } from '@/components/ui';
import {
  // Whisper
  getModelsStatus,
  downloadModel,
  deleteModel,
  checkWhisperAvailable,
  installWhisperCpp,
  onModelDownloadProgress,
  onWhisperInstallProgress,
  type ModelStatus,
  type DownloadProgress,
  type WhisperInstallProgress,
  // API Keys
  getApiKeyStatus,
  storeApiKey,
  deleteApiKey,
  getApiKeyMasked,
  validateOpenaiKey,
  // Ollama
  checkOllama,
  listOllamaModels,
  pullOllamaModel,
  deleteOllamaModel,
  type OllamaModel,
} from '@/lib/tauri';

type TranscriptionProvider = 'local' | 'openai';
type LLMProvider = 'ollama' | 'openai' | 'claude';

export function ModelsPage() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('transcription');

  const tabItems: TabItem[] = [
    {
      key: 'transcription',
      label: t('models.transcription', 'Transcription'),
      content: <TranscriptionSection />,
    },
    {
      key: 'llm',
      label: t('models.llm', 'LLM'),
      content: <LLMSection />,
    },
  ];

  return (
    <div className="h-full overflow-y-auto">
      <Tabs items={tabItems} activeKey={activeTab} onChange={setActiveTab} />
    </div>
  );
}

// =============================================================================
// Transcription Section (Whisper)
// =============================================================================

function TranscriptionSection() {
  const { t } = useTranslation();
  const [provider, setProvider] = useState<TranscriptionProvider>('local');
  const [whisperAvailable, setWhisperAvailable] = useState<boolean | null>(null);
  const [models, setModels] = useState<ModelStatus[]>([]);
  const [downloadingModel, setDownloadingModel] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [openaiKey, setOpenaiKey] = useState('');
  const [openaiKeyMasked, setOpenaiKeyMasked] = useState<string | null>(null);
  const [openaiKeyValid, setOpenaiKeyValid] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isInstallingWhisper, setIsInstallingWhisper] = useState(false);
  const [installProgress, setInstallProgress] = useState<WhisperInstallProgress | null>(null);
  const [installError, setInstallError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [available, modelsStatus, apiStatus, masked] = await Promise.all([
        checkWhisperAvailable(),
        getModelsStatus(),
        getApiKeyStatus(),
        getApiKeyMasked('openai'),
      ]);
      setWhisperAvailable(available);
      setModels(modelsStatus);
      setOpenaiKeyMasked(masked);

      // Auto-select provider based on availability
      if (!available && apiStatus.openai) {
        setProvider('openai');
      }
    } catch (error) {
      console.error('Failed to load transcription data:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Listen for download progress
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    const setup = async () => {
      unsubscribe = await onModelDownloadProgress((progress: DownloadProgress) => {
        setDownloadProgress(progress.percent);
        if (progress.percent >= 100) {
          // Immediately update the model status in local state
          setModels((prev) =>
            prev.map((model) =>
              model.id === downloadingModel ? { ...model, installed: true } : model
            )
          );
          setDownloadingModel(null);
        }
      });
    };

    setup();
    return () => unsubscribe?.();
  }, [downloadingModel]);

  // Listen for whisper.cpp install progress
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    const setup = async () => {
      unsubscribe = await onWhisperInstallProgress((progress: WhisperInstallProgress) => {
        setInstallProgress(progress);
        if (progress.percent >= 100) {
          setIsInstallingWhisper(false);
          setInstallProgress(null);
          loadData();
        }
      });
    };

    setup();
    return () => unsubscribe?.();
  }, [loadData]);

  const handleInstallWhisper = async () => {
    console.log('[Install] Starting whisper.cpp installation...');
    setIsInstallingWhisper(true);
    setInstallProgress({ percent: 0, message: 'Starting...' });
    setInstallError(null);
    try {
      console.log('[Install] Calling installWhisperCpp()...');
      const result = await installWhisperCpp();
      console.log('[Install] Installation completed successfully:', result);
      // Manually trigger success state since event might not fire
      setIsInstallingWhisper(false);
      setInstallProgress(null);
      loadData();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('[Install] Failed to install whisper.cpp:', errorMessage);
      setIsInstallingWhisper(false);
      setInstallProgress(null);
      setInstallError(errorMessage);
    }
  };

  const handleDownload = async (modelId: string) => {
    setDownloadingModel(modelId);
    setDownloadProgress(0);
    try {
      await downloadModel(modelId);
    } catch (error) {
      console.error('Download failed:', error);
      setDownloadingModel(null);
    }
  };

  const handleDelete = async (modelId: string) => {
    try {
      await deleteModel(modelId);
      loadData();
    } catch (error) {
      console.error('Delete failed:', error);
    }
  };

  const handleSaveOpenaiKey = async () => {
    if (!openaiKey.trim()) return;
    try {
      await storeApiKey('openai', openaiKey);
      setOpenaiKey('');
      const [masked, valid] = await Promise.all([
        getApiKeyMasked('openai'),
        validateOpenaiKey(),
      ]);
      setOpenaiKeyMasked(masked);
      setOpenaiKeyValid(valid);
    } catch (error) {
      console.error('Failed to save API key:', error);
    }
  };

  const handleDeleteOpenaiKey = async () => {
    try {
      await deleteApiKey('openai');
      setOpenaiKeyMasked(null);
      setOpenaiKeyValid(null);
    } catch (error) {
      console.error('Failed to delete API key:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <p className="text-neutral-500">{t('common.loading', 'Loading...')}</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Provider Selection */}
      <Card title={t('models.transcriptionProvider', 'Transcription Provider')}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => setProvider('local')}
              className={`p-4 rounded-lg border text-left transition-colors ${
                provider === 'local'
                  ? 'bg-primary-50 dark:bg-primary-950 border-primary-200 dark:border-primary-800'
                  : 'bg-white dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-700'
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <span className={`font-medium ${
                  provider === 'local'
                    ? 'text-primary-700 dark:text-primary-300'
                    : 'text-neutral-900 dark:text-neutral-100'
                }`}>
                  {t('models.localWhisper', 'Local (whisper.cpp)')}
                </span>
                {whisperAvailable && (
                  <span className="px-2 py-0.5 text-xs bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 rounded">
                    {t('models.available', 'Available')}
                  </span>
                )}
              </div>
              <p className={`text-sm ${
                provider === 'local'
                  ? 'text-primary-600 dark:text-primary-400'
                  : 'text-neutral-500 dark:text-neutral-400'
              }`}>
                {t('models.localWhisperDesc', 'Free, runs locally on your machine')}
              </p>
            </button>

            <button
              type="button"
              onClick={() => setProvider('openai')}
              className={`p-4 rounded-lg border text-left transition-colors ${
                provider === 'openai'
                  ? 'bg-primary-50 dark:bg-primary-950 border-primary-200 dark:border-primary-800'
                  : 'bg-white dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-700'
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <span className={`font-medium ${
                  provider === 'openai'
                    ? 'text-primary-700 dark:text-primary-300'
                    : 'text-neutral-900 dark:text-neutral-100'
                }`}>
                  {t('models.openaiWhisper', 'OpenAI Whisper API')}
                </span>
                {openaiKeyMasked && (
                  <span className="px-2 py-0.5 text-xs bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 rounded">
                    {t('models.configured', 'Configured')}
                  </span>
                )}
              </div>
              <p className={`text-sm ${
                provider === 'openai'
                  ? 'text-primary-600 dark:text-primary-400'
                  : 'text-neutral-500 dark:text-neutral-400'
              }`}>
                {t('models.openaiWhisperDesc', 'Cloud-based, requires API key')}
              </p>
            </button>
          </div>
        </div>
      </Card>

      {/* Local Whisper Models */}
      {provider === 'local' && (
        <Card title={t('models.whisperModels', 'Whisper Models')}>
          {!whisperAvailable && (
            <div className="mb-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
              <p className="text-yellow-800 dark:text-yellow-200 font-medium">
                {t('models.whisperNotInstalled', 'whisper.cpp not installed')}
              </p>
              <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                {t('models.whisperInstallHint', 'Install whisper.cpp to use local transcription')}
              </p>

              {/* macOS: Show Homebrew instructions */}
              {navigator.platform.includes('Mac') ? (
                <div className="mt-3 space-y-2">
                  <p className="text-sm text-yellow-700 dark:text-yellow-300">
                    {t('models.macosInstallHint', 'Install via Homebrew:')}
                  </p>
                  <code className="block p-2 bg-yellow-100 dark:bg-yellow-900/50 rounded text-sm font-mono text-yellow-800 dark:text-yellow-200">
                    brew install whisper-cpp
                  </code>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={loadData}
                  >
                    {t('models.checkAgain', 'Check again')}
                  </Button>
                </div>
              ) : (
                /* Windows: Show install button */
                isInstallingWhisper ? (
                  <div className="mt-3">
                    <Progress value={installProgress?.percent ?? 0} size="sm" />
                    <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-1">
                      {installProgress?.message ?? 'Installing...'}
                    </p>
                  </div>
                ) : (
                  <div className="mt-3">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={handleInstallWhisper}
                    >
                      {t('models.installWhisper', 'Install whisper.cpp')}
                    </Button>
                    {installError && (
                      <div className="mt-2 p-2 bg-red-50 dark:bg-red-900/20 rounded border border-red-200 dark:border-red-800">
                        <p className="text-xs text-red-700 dark:text-red-300 font-medium">
                          {t('models.installFailed', 'Installation failed')}
                        </p>
                        <p className="text-xs text-red-600 dark:text-red-400 mt-1 font-mono break-all">
                          {installError}
                        </p>
                      </div>
                    )}
                  </div>
                )
              )}
            </div>
          )}
          <div className="space-y-3">
            {models.map((model) => (
              <div
                key={model.id}
                className="flex items-center justify-between p-4 bg-neutral-50 dark:bg-neutral-800 rounded-lg"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-neutral-900 dark:text-neutral-100">
                      {model.name}
                    </span>
                    {model.id === 'base' && (
                      <span className="px-2 py-0.5 text-xs bg-primary-100 text-primary-700 dark:bg-primary-900 dark:text-primary-300 rounded">
                        {t('models.recommended', 'Recommended')}
                      </span>
                    )}
                    {model.installed && (
                      <span className="px-2 py-0.5 text-xs bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 rounded">
                        {t('models.installed', 'Installed')}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
                    {model.size_display}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {downloadingModel === model.id ? (
                    <div className="w-32">
                      <Progress value={downloadProgress} size="sm" />
                      <p className="text-xs text-neutral-500 mt-1 text-center">
                        {Math.round(downloadProgress)}%
                      </p>
                    </div>
                  ) : model.installed ? (
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(model.id)}>
                      {t('models.remove', 'Remove')}
                    </Button>
                  ) : (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleDownload(model.id)}
                      disabled={!whisperAvailable}
                    >
                      {t('models.download', 'Download')}
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* OpenAI API Key */}
      {provider === 'openai' && (
        <Card title={t('models.openaiApiKey', 'OpenAI API Key')}>
          <div className="space-y-4">
            {openaiKeyMasked ? (
              <div className="flex items-center justify-between p-4 bg-neutral-50 dark:bg-neutral-800 rounded-lg">
                <div>
                  <p className="font-medium text-neutral-900 dark:text-neutral-100">
                    {openaiKeyMasked}
                  </p>
                  {openaiKeyValid !== null && (
                    <p className={`text-sm mt-1 ${openaiKeyValid ? 'text-green-600' : 'text-red-600'}`}>
                      {openaiKeyValid ? t('models.keyValid', 'Key is valid') : t('models.keyInvalid', 'Key is invalid')}
                    </p>
                  )}
                </div>
                <Button variant="ghost" size="sm" onClick={handleDeleteOpenaiKey}>
                  {t('models.remove', 'Remove')}
                </Button>
              </div>
            ) : (
              <div className="flex gap-2">
                <Input
                  type="password"
                  placeholder="sk-..."
                  value={openaiKey}
                  onChange={(e) => setOpenaiKey(e.target.value)}
                  className="flex-1"
                />
                <Button onClick={handleSaveOpenaiKey} disabled={!openaiKey.trim()}>
                  {t('models.save', 'Save')}
                </Button>
              </div>
            )}
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              {t('models.openaiKeyHint', 'Get your API key from platform.openai.com')}
            </p>
          </div>
        </Card>
      )}
    </div>
  );
}

// =============================================================================
// LLM Section
// =============================================================================

function LLMSection() {
  const { t } = useTranslation();
  const [provider, setProvider] = useState<LLMProvider>('ollama');
  const [ollamaRunning, setOllamaRunning] = useState<boolean | null>(null);
  const [ollamaModels, setOllamaModels] = useState<OllamaModel[]>([]);
  const [pullingModel, setPullingModel] = useState<string | null>(null);
  const [newModelName, setNewModelName] = useState('');
  const [openaiKeyMasked, setOpenaiKeyMasked] = useState<string | null>(null);
  const [claudeKeyMasked, setClaudeKeyMasked] = useState<string | null>(null);
  const [openaiKey, setOpenaiKey] = useState('');
  const [claudeKey, setClaudeKey] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [ollamaStatus, apiStatus, openaiMasked, claudeMasked] = await Promise.all([
        checkOllama().catch(() => false),
        getApiKeyStatus(),
        getApiKeyMasked('openai'),
        getApiKeyMasked('claude'),
      ]);

      setOllamaRunning(ollamaStatus);
      setOpenaiKeyMasked(openaiMasked);
      setClaudeKeyMasked(claudeMasked);

      if (ollamaStatus) {
        const models = await listOllamaModels();
        setOllamaModels(models);
      }

      // Auto-select provider based on availability
      if (!ollamaStatus) {
        if (apiStatus.openai) {
          setProvider('openai');
        } else if (apiStatus.claude) {
          setProvider('claude');
        }
      }
    } catch (error) {
      console.error('Failed to load LLM data:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handlePullModel = async () => {
    if (!newModelName.trim()) return;
    setPullingModel(newModelName);
    try {
      await pullOllamaModel(newModelName);
      setNewModelName('');
      loadData();
    } catch (error) {
      console.error('Failed to pull model:', error);
    } finally {
      setPullingModel(null);
    }
  };

  const handleDeleteOllamaModel = async (modelName: string) => {
    try {
      await deleteOllamaModel(modelName);
      loadData();
    } catch (error) {
      console.error('Failed to delete model:', error);
    }
  };

  const handleSaveApiKey = async (keyProvider: 'openai' | 'claude', key: string) => {
    if (!key.trim()) return;
    try {
      await storeApiKey(keyProvider, key);
      if (keyProvider === 'openai') {
        setOpenaiKey('');
        setOpenaiKeyMasked(await getApiKeyMasked('openai'));
      } else {
        setClaudeKey('');
        setClaudeKeyMasked(await getApiKeyMasked('claude'));
      }
    } catch (error) {
      console.error('Failed to save API key:', error);
    }
  };

  const handleDeleteApiKey = async (keyProvider: 'openai' | 'claude') => {
    try {
      await deleteApiKey(keyProvider);
      if (keyProvider === 'openai') {
        setOpenaiKeyMasked(null);
      } else {
        setClaudeKeyMasked(null);
      }
    } catch (error) {
      console.error('Failed to delete API key:', error);
    }
  };

  const formatSize = (bytes: number) => {
    const gb = bytes / (1024 * 1024 * 1024);
    return gb >= 1 ? `${gb.toFixed(1)} GB` : `${(bytes / (1024 * 1024)).toFixed(0)} MB`;
  };

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <p className="text-neutral-500">{t('common.loading', 'Loading...')}</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Provider Selection */}
      <Card title={t('models.llmProvider', 'LLM Provider')}>
        <div className="grid grid-cols-3 gap-4">
          <button
            type="button"
            onClick={() => setProvider('ollama')}
            className={`p-4 rounded-lg border text-left transition-colors ${
              provider === 'ollama'
                ? 'bg-primary-50 dark:bg-primary-950 border-primary-200 dark:border-primary-800'
                : 'bg-white dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-700'
            }`}
          >
            <div className="flex items-center gap-2 mb-2">
              <span className={`font-medium ${
                provider === 'ollama'
                  ? 'text-primary-700 dark:text-primary-300'
                  : 'text-neutral-900 dark:text-neutral-100'
              }`}>Ollama</span>
              {ollamaRunning && (
                <span className="px-2 py-0.5 text-xs bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 rounded">
                  {t('models.running', 'Running')}
                </span>
              )}
            </div>
            <p className={`text-sm ${
              provider === 'ollama'
                ? 'text-primary-600 dark:text-primary-400'
                : 'text-neutral-500 dark:text-neutral-400'
            }`}>
              {t('models.ollamaDesc', 'Free, local LLM')}
            </p>
          </button>

          <button
            type="button"
            onClick={() => setProvider('openai')}
            className={`p-4 rounded-lg border text-left transition-colors ${
              provider === 'openai'
                ? 'bg-primary-50 dark:bg-primary-950 border-primary-200 dark:border-primary-800'
                : 'bg-white dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-700'
            }`}
          >
            <div className="flex items-center gap-2 mb-2">
              <span className={`font-medium ${
                provider === 'openai'
                  ? 'text-primary-700 dark:text-primary-300'
                  : 'text-neutral-900 dark:text-neutral-100'
              }`}>OpenAI</span>
              {openaiKeyMasked && (
                <span className="px-2 py-0.5 text-xs bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 rounded">
                  {t('models.configured', 'Configured')}
                </span>
              )}
            </div>
            <p className={`text-sm ${
              provider === 'openai'
                ? 'text-primary-600 dark:text-primary-400'
                : 'text-neutral-500 dark:text-neutral-400'
            }`}>
              GPT-4o, GPT-4
            </p>
          </button>

          <button
            type="button"
            onClick={() => setProvider('claude')}
            className={`p-4 rounded-lg border text-left transition-colors ${
              provider === 'claude'
                ? 'bg-primary-50 dark:bg-primary-950 border-primary-200 dark:border-primary-800'
                : 'bg-white dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-700'
            }`}
          >
            <div className="flex items-center gap-2 mb-2">
              <span className={`font-medium ${
                provider === 'claude'
                  ? 'text-primary-700 dark:text-primary-300'
                  : 'text-neutral-900 dark:text-neutral-100'
              }`}>Claude</span>
              {claudeKeyMasked && (
                <span className="px-2 py-0.5 text-xs bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 rounded">
                  {t('models.configured', 'Configured')}
                </span>
              )}
            </div>
            <p className={`text-sm ${
              provider === 'claude'
                ? 'text-primary-600 dark:text-primary-400'
                : 'text-neutral-500 dark:text-neutral-400'
            }`}>
              Claude 3.5 Sonnet
            </p>
          </button>
        </div>
      </Card>

      {/* Ollama Models */}
      {provider === 'ollama' && (
        <Card title={t('models.ollamaModels', 'Ollama Models')}>
          {!ollamaRunning ? (
            <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
              <p className="text-yellow-800 dark:text-yellow-200 font-medium">
                {t('models.ollamaNotRunning', 'Ollama is not running')}
              </p>
              <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                {t('models.ollamaInstallHint', 'Please install and start Ollama')}
              </p>
              <Button variant="secondary" size="sm" className="mt-3" onClick={loadData}>
                {t('models.checkAgain', 'Check Again')}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {ollamaModels.length > 0 ? (
                <div className="space-y-3">
                  {ollamaModels.map((model) => (
                    <div
                      key={model.name}
                      className="flex items-center justify-between p-4 bg-neutral-50 dark:bg-neutral-800 rounded-lg"
                    >
                      <div>
                        <span className="font-medium text-neutral-900 dark:text-neutral-100">
                          {model.name}
                        </span>
                        <p className="text-sm text-neutral-500 dark:text-neutral-400">
                          {formatSize(model.size)}
                        </p>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => handleDeleteOllamaModel(model.name)}>
                        {t('models.remove', 'Remove')}
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-neutral-500 text-center py-4">
                  {t('models.noOllamaModels', 'No models installed')}
                </p>
              )}

              <div className="flex gap-2">
                <Input
                  placeholder={t('models.modelName', 'Model name (e.g., llama3.2)')}
                  value={newModelName}
                  onChange={(e) => setNewModelName(e.target.value)}
                  className="flex-1"
                />
                <Button
                  onClick={handlePullModel}
                  disabled={!newModelName.trim() || pullingModel !== null}
                  loading={pullingModel !== null}
                >
                  {t('models.pull', 'Pull')}
                </Button>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* OpenAI API Key */}
      {provider === 'openai' && (
        <Card title={t('models.openaiApiKey', 'OpenAI API Key')}>
          <div className="space-y-4">
            {openaiKeyMasked ? (
              <div className="flex items-center justify-between p-4 bg-neutral-50 dark:bg-neutral-800 rounded-lg">
                <p className="font-medium text-neutral-900 dark:text-neutral-100">
                  {openaiKeyMasked}
                </p>
                <Button variant="ghost" size="sm" onClick={() => handleDeleteApiKey('openai')}>
                  {t('models.remove', 'Remove')}
                </Button>
              </div>
            ) : (
              <div className="flex gap-2">
                <Input
                  type="password"
                  placeholder="sk-..."
                  value={openaiKey}
                  onChange={(e) => setOpenaiKey(e.target.value)}
                  className="flex-1"
                />
                <Button onClick={() => handleSaveApiKey('openai', openaiKey)} disabled={!openaiKey.trim()}>
                  {t('models.save', 'Save')}
                </Button>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Claude API Key */}
      {provider === 'claude' && (
        <Card title={t('models.claudeApiKey', 'Claude API Key')}>
          <div className="space-y-4">
            {claudeKeyMasked ? (
              <div className="flex items-center justify-between p-4 bg-neutral-50 dark:bg-neutral-800 rounded-lg">
                <p className="font-medium text-neutral-900 dark:text-neutral-100">
                  {claudeKeyMasked}
                </p>
                <Button variant="ghost" size="sm" onClick={() => handleDeleteApiKey('claude')}>
                  {t('models.remove', 'Remove')}
                </Button>
              </div>
            ) : (
              <div className="flex gap-2">
                <Input
                  type="password"
                  placeholder="sk-ant-..."
                  value={claudeKey}
                  onChange={(e) => setClaudeKey(e.target.value)}
                  className="flex-1"
                />
                <Button onClick={() => handleSaveApiKey('claude', claudeKey)} disabled={!claudeKey.trim()}>
                  {t('models.save', 'Save')}
                </Button>
              </div>
            )}
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              {t('models.claudeKeyHint', 'Get your API key from console.anthropic.com')}
            </p>
          </div>
        </Card>
      )}
    </div>
  );
}

export default ModelsPage;
