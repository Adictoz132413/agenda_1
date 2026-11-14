/**
 * Compresión de fotos en el dispositivo: redimensiona al lado máximo
 * indicado y codifica como WebP (o JPEG si WebP no está disponible).
 */
import { getDb } from '@/db/db';
import { newId } from '@/db/repo';
import type { Photo } from '@/domain/types';

export const MAX_INPUT_BYTES = 25 * 1024 * 1024;

async function loadBitmap(file: Blob): Promise<{ img: CanvasImageSource; w: number; h: number; close?: () => void }> {
  if ('createImageBitmap' in window) {
    try {
      const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' } as ImageBitmapOptions);
      return { img: bmp, w: bmp.width, h: bmp.height, close: () => bmp.close() };
    } catch {
      /* continuar con <img> */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await img.decode();
    return { img, w: img.naturalWidth, h: img.naturalHeight };
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((res) => canvas.toBlob(res, type, quality));
}

export async function compressImage(file: File, maxSide = 1024, quality = 0.72): Promise<Omit<Photo, 'id' | 'createdAt'>> {
  if (!file.type.startsWith('image/')) throw new Error('El archivo seleccionado no es una imagen');
  if (file.size > MAX_INPUT_BYTES) throw new Error('La imagen es demasiado grande (máximo 25 MB)');
  const { img, w, h, close } = await loadBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(w, h));
  const cw = Math.max(1, Math.round(w * scale));
  const ch = Math.max(1, Math.round(h * scale));
  const canvas = document.createElement('canvas');
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No se pudo procesar la imagen');
  ctx.drawImage(img, 0, 0, cw, ch);
  close?.();
  let blob = await toBlob(canvas, 'image/webp', quality);
  if (!blob || blob.type !== 'image/webp') blob = await toBlob(canvas, 'image/jpeg', quality);
  if (!blob) throw new Error('No se pudo comprimir la imagen');
  return { data: await blob.arrayBuffer(), mime: blob.type, size: blob.size, width: cw, height: ch };
}

/** Comprime y guarda una foto; devuelve su id. */
export async function storePhoto(file: File, maxSide: number): Promise<string> {
  const p = await compressImage(file, maxSide);
  const id = newId();
  await getDb().photos.put({ ...p, id, createdAt: Date.now() });
  return id;
}

export async function photoStorageUsage(): Promise<{ count: number; bytes: number }> {
  let bytes = 0;
  let count = 0;
  await getDb().photos.each((p) => {
    bytes += p.size;
    count++;
  });
  return { count, bytes };
}

export function formatBytes(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
  if (b < 1024 * 1024 * 1024) return `${(b / 1024 / 1024).toFixed(1)} MB`;
  return `${(b / 1024 / 1024 / 1024).toFixed(2)} GB`;
}
