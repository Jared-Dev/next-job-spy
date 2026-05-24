export enum ESettingKey {
  AnthropicApiKey = 'anthropic_api_key',
  AnthropicAdminApiKey = 'anthropic_admin_api_key',
  AiModel = 'ai_model',
  AiMaxTokens = 'ai_max_tokens',
  DefaultTemplateId = 'default_template_id',
  SourceConfigs = 'source_configs',
  AutoRefreshIntervalMin = 'auto_refresh_interval_min',
  LastRefreshAt = 'last_refresh_at',
  /**
   * Screening cascade toggles. `undefined` (key absent) = user hasn't been
   * gated yet; the /jobs page forces a choice on first visit.
   */
  ScreeningEmbeddingEnabled = 'screening_embedding_enabled',
  ScreeningLocalEnabled = 'screening_local_enabled',
  /** Cosine threshold for the embedding screen. Stored as a string of a float in [0, 1]. */
  ScreeningEmbeddingThreshold = 'screening_embedding_threshold',
  /** Which local model variant to download. See ELocalModelVariant. */
  ScreeningLocalModelVariant = 'screening_local_model_variant',
  /**
   * After how many days we re-verify a posting is still live before
   * spending compute on it (HEAD/GET against the original URL). Stored
   * as an integer string; default 7.
   */
  ScreeningLivenessDays = 'screening_liveness_days',
  /** When true, the embedding threshold + batch size are managed by
   *  the auto-tune algorithm after every local verdict. */
  ScreeningAutoTuneEnabled = 'screening_auto_tune_enabled',
  /** Dynamic embedding batch size. Managed by auto-tune when enabled;
   *  user-controlled when not. Defaults to 25. */
  ScreeningEmbeddingBatchSize = 'screening_embedding_batch_size',
  /** Auto-tune internal state (JSON: verdictCount, thresholdHistory,
   *  confidence, lastBatchSize, lastRecomputedAt). Opaque to UI. */
  ScreeningAutoTuneState = 'screening_auto_tune_state',
  /** Verdicts auto-tune needs before it can declare convergence and
   *  open the embedding batch to full size. Default 100. */
  ScreeningAutoTuneMinVerdicts = 'screening_auto_tune_min_verdicts',
  /** Number of parallel local LLM worker instances. Each worker
   *  loads the full model independently; memory cost scales with
   *  this. Range 1-4; default 1 (single worker, safest). */
  ScreeningLocalParallelism = 'screening_local_parallelism',
}
