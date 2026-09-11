export const compressImage = (
  file: File,
  maxDimension = 800,
  quality = 0.8
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new window.Image();
      img.onload = () => {
        const scale = Math.min(
          maxDimension / img.width,
          maxDimension / img.height,
          1
        );
        const canvas = document.createElement("canvas");
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject("Canvas context creation failed");
          return;
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

export const processUploadFile = async (
  file: File
): Promise<{ dataUrl: string; compressed: boolean }> => {
  if (file.size > 2097152 || file.type !== "image/gif") {
    try {
      const compressedUrl = await compressImage(file);
      return { dataUrl: compressedUrl, compressed: true };
    } catch {
      // fallback to raw reader
    }
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      resolve({ dataUrl: reader.result as string, compressed: false });
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};
