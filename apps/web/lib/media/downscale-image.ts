/**
 * A phone camera photo is eight megabytes; the largest derivative the API builds
 * is 1600px wide. Sending the original over a rural connection would cost a host
 * minutes and buy nothing, so the browser resizes before it asks for an upload
 * URL — and the server's size limit is then a backstop rather than the thing
 * hosts run into.
 */
const MAX_EDGE_PX = 1600;
const JPEG_QUALITY = 0.82;
const OUTPUT_TYPE = "image/jpeg";

export interface DownscaledImage {
  blob: Blob;
  contentType: typeof OUTPUT_TYPE;
  width: number;
  height: number;
}

export async function downscaleImage(file: File): Promise<DownscaledImage> {
  // `from-image` applies the EXIF rotation a phone writes instead of rotating
  // pixels, which is what stops portrait photos arriving on their side.
  const source = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(
    1,
    MAX_EDGE_PX / Math.max(source.width, source.height),
  );
  const width = Math.round(source.width * scale);
  const height = Math.round(source.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("This browser did not provide a 2D canvas context.");
  }
  context.drawImage(source, 0, 0, width, height);
  source.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, OUTPUT_TYPE, JPEG_QUALITY),
  );
  if (!blob) {
    throw new Error("The browser could not encode the resized photo.");
  }

  return { blob, contentType: OUTPUT_TYPE, width, height };
}
