import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';

export const CameraService = {
  /**
   * Invokes the device camera to perform a discrete visual compliance check ("The Gaze").
   * @returns {Promise<string|null>} Base64 dataURL of the captured image, or null if failed/cancelled.
   */
  captureGazeImage: async () => {
    try {
      // We request the front camera for Chastity/CEI/Facial expression checks
      const image = await Camera.getPhoto({
        quality: 70,
        allowEditing: false,
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Camera,
        promptLabelHeader: "Submit to The Gaze",
        promptLabelPhoto: "Take Photo",
        promptLabelPicture: "Take Picture"
      });
      
      return image.dataUrl;
    } catch (e) {
      console.warn("User evaded The Gaze or hardware failed:", e);
      return null; // A null return acts as a DEFIANCE event to the AI
    }
  }
};
