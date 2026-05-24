/**
 * Pick for the on-device Stage-3 reasoning model. We deliberately hide
 * the underlying model name from the UI; users care about size and
 * trade-off, not vendor.
 *
 * Smaller  ≈ 900MB:  faster screening, may miss some misfits. Good
 *                    fallback for low-end or no-WebGPU machines.
 * Stronger ≈ 2.3GB:  catches more, marginally slower with a capable
 *                    GPU. Recommended default; local hardware is
 *                    usually capable enough that the bigger model is
 *                    worth its extra accuracy.
 */
export enum ELocalModelVariant {
  Smaller = 'smaller',
  Stronger = 'stronger',
}
