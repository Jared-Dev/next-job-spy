export enum EJobSort {
  /**
   * Ranking. Primary: Claude fit score desc, nulls last. Falls back to
   * embedding score so jobs still waiting on full scoring rank by the
   * cheaper signal we already have, instead of dropping to the bottom.
   */
  Ranking = 'ranking',
  NewestDiscovered = 'newest-discovered',
  PostedDate = 'posted-date',
  Company = 'company',
}
