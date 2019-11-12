/**
 * Copyright (c) 2019 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { IColor } from 'browser/Types';

export function blend(bg: IColor, fg: IColor): IColor {
  const a = (fg.rgba & 0xFF) / 255;
  if (a === 1) {
    return {
      css: fg.css,
      rgba: fg.rgba
    };
  }
  const fgR = (fg.rgba >> 24) & 0xFF;
  const fgG = (fg.rgba >> 16) & 0xFF;
  const fgB = (fg.rgba >> 8) & 0xFF;
  const bgR = (bg.rgba >> 24) & 0xFF;
  const bgG = (bg.rgba >> 16) & 0xFF;
  const bgB = (bg.rgba >> 8) & 0xFF;
  const r = bgR + Math.round((fgR - bgR) * a);
  const g = bgG + Math.round((fgG - bgG) * a);
  const b = bgB + Math.round((fgB - bgB) * a);
  const css = toCss(r, g, b);
  const rgba = toRgba(r, g, b);
  return { css, rgba };
}

export function fromCss(css: string): IColor {
  return {
    css,
    rgba: (parseInt(css.slice(1), 16) << 8 | 0xFF) >>> 0
  };
}

export function toPaddedHex(c: number): string {
  const s = c.toString(16);
  return s.length < 2 ? '0' + s : s;
}

export function toCss(r: number, g: number, b: number): string {
  return `#${toPaddedHex(r)}${toPaddedHex(g)}${toPaddedHex(b)}`;
}

export function toRgba(r: number, g: number, b: number, a: number = 0xFF): number {
  // >>> 0 forces an unsigned int
  return (r << 24 | g << 16 | b << 8 | a) >>> 0;
}

/**
 * Gets the relative luminance of an RGB color, this is useful in determining the contrast ratio
 * between two colors.
 * @param rgb The color to use.
 * @see https://www.w3.org/TR/WCAG20/#relativeluminancedef
 */
export function rgbRelativeLuminance(rgb: number): number {
  return rgbRelativeLuminance2(
    (rgb >> 16) & 0xFF,
    (rgb >> 8 ) & 0xFF,
    (rgb      ) & 0xFF);
}

export function rgbRelativeLuminance2(r: number, g: number, b: number): number {
  const rs = r / 255;
  const gs = g / 255;
  const bs = b / 255;
  const rr = rs <= 0.03928 ? rs / 12.92 : Math.pow((rs + 0.055) / 1.055, 2.4);
  const rg = gs <= 0.03928 ? gs / 12.92 : Math.pow((gs + 0.055) / 1.055, 2.4);
  const rb = bs <= 0.03928 ? bs / 12.92 : Math.pow((bs + 0.055) / 1.055, 2.4);
  return rr * 0.2126 + rg * 0.7152 + rb * 0.0722;
}

/**
 * Gets the contrast ratio between two relative luminance values.
 * @param l1 The first relative luminance.
 * @param l2 The first relative luminance.
 *
 * // TODO: Is this link right?
 * @see https://www.w3.org/TR/WCAG20/#contrastratio
 */
export function contrastRatio(l1: number, l2: number): number {
  if (l1 < l2) {
    return (l2 + 0.05) / (l1 + 0.05);
  }
  return (l1 + 0.05) / (l2 + 0.05);
}

// TODO: Cache [bg][fg]: result, should probably be owned by ColorManager?

export function ensureContrastRatio(bg: IColor, fg: IColor, ratio: number): IColor | undefined {
  const bgL = rgbRelativeLuminance(bg.rgba >> 8);
  const fgL = rgbRelativeLuminance(fg.rgba >> 8);
  const cr = contrastRatio(bgL, fgL);
  if (cr < ratio) {
    if (fgL < bgL) {
      return reduceLuminance(bg, fg, ratio);
    }
    return increaseLuminance(bg, fg, ratio);
  }
  return undefined;
}

export function reduceLuminance(bg: IColor, fg: IColor, ratio: number): IColor {
  // This is a naive but fast approach to reducing luminance as converting to
  // HSL and back is expensive
  const bgR = (bg.rgba >> 24) & 0xFF;
  const bgG = (bg.rgba >> 16) & 0xFF;
  const bgB = (bg.rgba >>  8) & 0xFF;
  let fgR = (fg.rgba >> 24) & 0xFF;
  let fgG = (fg.rgba >> 16) & 0xFF;
  let fgB = (fg.rgba >>  8) & 0xFF;
  let cr = contrastRatio(rgbRelativeLuminance2(fgR, fgB, fgG), rgbRelativeLuminance2(bgR, bgG, bgB));
  while (cr < ratio && (fgR > 0 || fgG > 0 || fgB > 0)) {
    // Increase by 10% (ceil) until the ratio is hit
    fgR -= Math.max(0, Math.ceil(fgR * 0.1));
    fgG -= Math.max(0, Math.ceil(fgG * 0.1));
    fgB -= Math.max(0, Math.ceil(fgB * 0.1));
    cr = contrastRatio(rgbRelativeLuminance2(fgR, fgB, fgG), rgbRelativeLuminance2(bgR, bgG, bgB));
  }
  return {
    css: toCss(fgR, fgG, fgB),
    rgba: toRgba(fgR, fgG, fgB)
  };
}

export function increaseLuminance(bg: IColor, fg: IColor, ratio: number): IColor {
  // This is a naive but fast approach to increasing luminance as converting to
  // HSL and back is expensive
  const bgR = (bg.rgba >> 24) & 0xFF;
  const bgG = (bg.rgba >> 16) & 0xFF;
  const bgB = (bg.rgba >>  8) & 0xFF;
  let fgR = (fg.rgba >> 24) & 0xFF;
  let fgG = (fg.rgba >> 16) & 0xFF;
  let fgB = (fg.rgba >>  8) & 0xFF;
  let cr = contrastRatio(rgbRelativeLuminance2(fgR, fgB, fgG), rgbRelativeLuminance2(bgR, bgG, bgB));
  while (cr < ratio && (fgR < 0xFF || fgG < 0xFF || fgB < 0xFF)) {
    // Increase by 10% until the ratio is hit
    fgR = Math.min(0xFF, fgR + Math.floor((255 - fgR) * 0.1));
    fgG = Math.min(0xFF, fgG + Math.floor((255 - fgG) * 0.1));
    fgB = Math.min(0xFF, fgB + Math.floor((255 - fgB) * 0.1));
    cr = contrastRatio(rgbRelativeLuminance2(fgR, fgB, fgG), rgbRelativeLuminance2(bgR, bgG, bgB));
  }
  return {
    css: toCss(fgR, fgG, fgB),
    rgba: toRgba(fgR, fgG, fgB)
  };
}
