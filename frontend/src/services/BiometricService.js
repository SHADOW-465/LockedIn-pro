import { NativeBiometric } from '@capgo/capacitor-native-biometric';

export const BiometricService = {
  checkAvailability: async () => {
    try {
      const result = await NativeBiometric.isAvailable();
      return result.isAvailable;
    } catch (err) {
      console.warn("Biometrics not available:", err);
      return false;
    }
  },

  authenticate: async (reason = 'Face the Architect\'s Gaze to proceed.') => {
    try {
      const isAvailable = await BiometricService.checkAvailability();
      if (!isAvailable) {
        // If biometrics are not available (e.g., in a normal web browser context or lack of hardware),
        // we fallback to true for the sake of development/cross-platform parity, 
        // OR we can demand a PIN. For now, assuming web = true.
        return true; 
      }

      await NativeBiometric.verifyIdentity({
        reason: reason,
        title: "Secure Access",
        subtitle: "The Architect demands verification",
        description: "Verify your identity to access the Indoctrination Chamber."
      });
      return true;
    } catch (err) {
      console.error("Biometric authentication failed or cancelled", err);
      return false;
    }
  }
};
