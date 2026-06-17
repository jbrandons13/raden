// Resize + compress an image File to a JPEG Blob, capping the longest side.
// Checklist proof photos don't need full resolution — this keeps a ~3 MB phone
// photo down to ~100-200 KB so Supabase storage (1 GB free) lasts a long time.
export async function compressImage(file: File, maxDim = 1000, quality = 0.6): Promise<Blob> {
  const dataUrl: string = await new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => res(fr.result as string);
    fr.onerror = () => rej(new Error('read failed'));
    fr.readAsDataURL(file);
  });
  const img: HTMLImageElement = await new Promise((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = () => rej(new Error('decode failed'));
    i.src = dataUrl;
  });

  let { width, height } = img;
  if (width >= height && width > maxDim) { height = Math.round((height * maxDim) / width); width = maxDim; }
  else if (height > width && height > maxDim) { width = Math.round((width * maxDim) / height); height = maxDim; }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas unsupported');
  ctx.drawImage(img, 0, 0, width, height);

  const blob: Blob | null = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', quality));
  if (!blob) throw new Error('compress failed');
  return blob;
}
